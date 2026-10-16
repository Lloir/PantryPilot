import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate test port');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  return port;
}

async function waitForServer(base: string, child: ChildProcess) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Test server exited early (${child.exitCode})`);
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Test server did not become ready');
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pantrypilot-integration-'));
let child: ChildProcess | undefined;
try {
  const port = await freePort();
  child = spawn(process.execPath, ['--import', 'tsx', path.resolve('server.ts')], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      HTTPS_DISABLED: 'true',
      AUTH_DISABLED: 'false',
      DATA_DIR: tempDir,
    },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  await waitForServer(base, child);

  const usersFile = await fs.readFile(path.join(tempDir, 'users.txt'), 'utf8');
  const initialPassword = usersFile.match(/^admin:(.*?) \[admin\]$/m)?.[1];
  assert.ok(initialPassword, 'server creates initial admin account');
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: initialPassword }),
  });
  assert.equal(login.status, 200, 'admin can log in');
  const cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(cookie, 'login creates session cookie');
  const authHeaders = { Cookie: cookie!, 'Content-Type': 'application/json' };

  const unauthenticated = await fetch(`${base}/api/pantry-data`);
  assert.equal(unauthenticated.status, 401, 'pantry API requires login');

  const emptyResponse = await fetch(`${base}/api/pantry-data`, { headers: authHeaders });
  const empty = await emptyResponse.json() as any;
  assert.equal(empty.revision, 0, 'new server starts at revision zero');
  const item = {
    id: 'integration-item', name: 'Milk', category: 'Dairy & Eggs', quantity: 2, unit: 'l',
    unitPrice: 2, totalCost: 4, purchaseDate: '2026-10-16', expirationDate: '2026-10-20', location: 'Fridge',
  };
  const save = await fetch(`${base}/api/pantry-data`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({
      baseRevision: 0, inventory: [item], shoppingList: [{ id: 'needed-item', name: 'Rice', category: 'Pantry & Grains', checked: false }],
      settings: { currency: 'USD' },
    }),
  });
  assert.equal(save.status, 200, 'first pantry save succeeds');
  const invalidSave = await fetch(`${base}/api/pantry-data`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ baseRevision: 1, inventory: [{ ...item, quantity: 'two' }] }),
  });
  assert.equal(invalidSave.status, 400, 'malformed pantry data is rejected');
  const aiBurst = await Promise.all(Array.from({ length: 11 }, () => fetch(`${base}/api/scan-receipt`, {
    method: 'POST', headers: authHeaders, body: JSON.stringify({}),
  })));
  assert.equal(aiBurst.filter(response => response.status === 429).length, 1, 'AI endpoint burst limit is enforced');
  const staleSave = await fetch(`${base}/api/pantry-data`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ baseRevision: 0, inventory: [], settings: {} }),
  });
  assert.equal(staleSave.status, 409, 'stale simultaneous edit is rejected instead of overwriting');

  const backupResponse = await fetch(`${base}/api/backups`, { method: 'POST', headers: authHeaders });
  assert.equal(backupResponse.status, 200, 'admin can create a backup');
  const backup = await backupResponse.json() as { name: string };
  const previewResponse = await fetch(`${base}/api/backups/${encodeURIComponent(backup.name)}/preview`, { headers: authHeaders });
  assert.equal(previewResponse.status, 200, 'backup preview is available');
  assert.equal((await previewResponse.json() as any).counts.inventory.incoming, 1, 'preview reports incoming inventory');
  for (let attempt = 0; attempt < 9; attempt++) {
    const response = await fetch(`${base}/api/backups/${encodeURIComponent(backup.name)}/preview`, { headers: authHeaders });
    assert.equal(response.status, 200, 'backup preview is allowed within the rate limit');
  }
  const limitedPreview = await fetch(`${base}/api/backups/${encodeURIComponent(backup.name)}/preview`, { headers: authHeaders });
  assert.equal(limitedPreview.status, 429, 'backup previews are rate limited');
  assert.ok(limitedPreview.headers.get('retry-after'), 'rate limit communicates retry delay');

  const malformed = await fetch(`${base}/api/import/preview`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ app: 'pantrypal', version: 2, pantry: { inventory: [] } }),
  });
  assert.equal(malformed.status, 400, 'malformed current-format imports are rejected');

  const legacySnapshot = { app: 'pantrypal', version: 1, pantry: { inventory: [item] } };
  const legacyPreview = await fetch(`${base}/api/import/preview`, {
    method: 'POST', headers: authHeaders, body: JSON.stringify(legacySnapshot),
  });
  const legacyCounts = (await legacyPreview.json() as any).counts;
  assert.equal(legacyCounts.shoppingList.incoming, null, 'preview shows omitted legacy collections are preserved');
  assert.equal(legacyCounts.shoppingList.current, 1, 'preview shows current data that will be preserved');
  const legacyImport = await fetch(`${base}/api/import`, {
    method: 'POST', headers: authHeaders, body: JSON.stringify(legacySnapshot),
  });
  assert.equal(legacyImport.status, 200, 'legacy partial export remains importable');
  const afterLegacyImport = await (await fetch(`${base}/api/pantry-data`, { headers: authHeaders })).json() as any;
  assert.equal(afterLegacyImport.settings.currency, 'USD', 'legacy import preserves omitted settings');
  assert.equal(afterLegacyImport.shoppingList[0].id, 'needed-item', 'legacy import preserves omitted collections');

  const clearInventory = await fetch(`${base}/api/pantry-data`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ baseRevision: afterLegacyImport.revision, inventory: [], settings: afterLegacyImport.settings }),
  });
  assert.equal(clearInventory.status, 200, 'pantry can be cleared before restore test');
  const restore = await fetch(`${base}/api/backups/${encodeURIComponent(backup.name)}/restore`, {
    method: 'POST', headers: authHeaders,
  });
  assert.equal(restore.status, 200, 'admin can restore a backup');
  const restored = await (await fetch(`${base}/api/pantry-data`, { headers: authHeaders })).json() as any;
  assert.equal(restored.inventory.length, 1, 'backup restore restores pantry contents');
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise<void>(resolve => child!.once('exit', () => resolve())),
      new Promise<void>(resolve => setTimeout(resolve, 2000)),
    ]);
  }
  await fs.rm(tempDir, { recursive: true, force: true });
}

console.log('Integration checks passed');
