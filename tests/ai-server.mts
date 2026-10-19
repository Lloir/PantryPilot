// Starts the real server against a fake Ollama and checks the AI routes end to end.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, ChildProcess } from 'node:child_process';
import { createServer, AddressInfo } from 'node:net';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  return port;
}

let mode: 'ok' | 'missing' = 'ok';
const chats: any[] = [];
const fakeOllama = http.createServer((req, res) => {
  let raw = '';
  req.on('data', c => (raw += c));
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : null;
    const send = (status: number, data: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (req.url === '/api/tags') return send(200, { models: [{ name: 'fake-vl:latest' }] });
    if (req.url === '/api/show') return send(200, { capabilities: ['completion', 'vision'] });
    if (req.url !== '/api/chat') return send(404, {});
    chats.push(body);
    if (mode === 'missing') return send(404, { error: 'model "fake-vl" not found' });
    const prompt: string = body.messages[0].content;
    if (body.messages[0].images) {
      return send(200, { message: { content: JSON.stringify({
        storeName: 'Fake Mart', purchaseDate: '2026-10-19', subtotal: 5, tax: 0.5, total: 5.5,
        items: [{ name: 'Whole Milk', category: 'Dairy & Eggs', quantity: 1, unit: 'l', unitPrice: 1.5, totalPrice: 1.5, estimatedShelfLifeDays: 7 },
                { name: 'Bread', category: 'Bakery', quantity: 2, unit: 'count', unitPrice: 2, totalPrice: 4, estimatedShelfLifeDays: 5 }],
      }) } });
    }
    if (/Reply with JSON saying ok/.test(prompt)) return send(200, { message: { content: '{"ok":true,"word":"pantry"}' } });
    // suggest-recipes: a list wrapped in an object, one entry that is unusable
    return send(200, { message: { content: JSON.stringify({ items: [
      { name: 'Milk Toast', description: 'd', mealType: 'Breakfast', cuisine: 'Any', servings: 1, prepTimeMinutes: 1, cookTimeMinutes: 2,
        ingredients: [{ name: 'Bread', quantity: 1, unit: 'count' }], instructions: ['Toast it'] },
      { name: 'Broken', ingredients: [], instructions: [] },
    ] }) } });
  });
});
await new Promise<void>(r => fakeOllama.listen(0, '127.0.0.1', r));
const ollamaUrl = `http://127.0.0.1:${(fakeOllama.address() as AddressInfo).port}`;

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pantrypilot-ai-'));
let child: ChildProcess | undefined;
try {
  const port = await freePort();
  child = spawn(process.execPath, ['--import', 'tsx', path.resolve('server.ts')], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), HTTPS_DISABLED: 'true', DATA_DIR: tempDir,
      GEMINI_API_KEY: '', OLLAMA_URL: ollamaUrl, OLLAMA_MODEL: 'fake-vl' },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    if (child.exitCode !== null || i > 100) throw new Error('server did not start');
    try { if ((await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) })).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  const health = await (await fetch(`${base}/api/health`)).json() as any;
  assert.equal(health.hasAi, true);
  assert.deepEqual(health.aiProviders, ['ollama']);
  assert.ok(!JSON.stringify(health).includes(ollamaUrl), 'health does not reveal the AI address');

  const users = await fs.readFile(path.join(tempDir, 'users.txt'), 'utf8');
  const pw = users.match(/^admin:(.*?) \[admin\]$/m)?.[1];
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: pw }) });
  const headers = { Cookie: login.headers.get('set-cookie')!.split(';', 1)[0], 'Content-Type': 'application/json' };
  const post = (p: string, body: unknown = {}) => fetch(`${base}${p}`, { method: 'POST', headers, body: JSON.stringify(body) });

  const scan = await post('/api/scan-receipt', { imageBase64: 'data:image/jpeg;base64,QUJD', mimeType: 'image/jpeg', measureMode: 'volume', currency: 'GBP' });
  assert.equal(scan.status, 200);
  const receipt = await scan.json() as any;
  assert.equal(receipt.storeName, 'Fake Mart');
  assert.equal(receipt.items.length, 2);
  assert.ok(receipt.items.every((i: any) => i.selected === true));
  assert.equal(receipt.confidenceScore, undefined, 'no made-up confidence');
  const sent = chats[0];
  assert.equal(sent.model, 'fake-vl');
  assert.deepEqual(sent.messages[0].images, ['QUJD'], 'the data: prefix is stripped before sending');
  assert.match(sent.messages[0].content, /GBP/);

  const recipes = await (await post('/api/suggest-recipes', { inventory: [{ name: 'Bread', quantity: 1, unit: 'count', category: 'Bakery' }] })).json() as any;
  assert.deepEqual(recipes.recipes.map((r: any) => r.name), ['Milk Toast'], 'unusable recipes are dropped');
  assert.deepEqual(recipes.recipes[0].tags, []);

  const status = await (await fetch(`${base}/api/ai/status`, { headers })).json() as any;
  assert.equal(status.enabled, true);
  assert.equal(status.providers[0].provider, 'ollama');
  assert.equal(status.providers[0].ok, true);
  const test = await (await post('/api/ai/test')).json() as any;
  assert.equal(test.ok, true);

  // a broken setup gives a friendly message, not the address or the raw error
  mode = 'missing';
  const failed = await post('/api/scan-receipt', { imageBase64: 'QUJD' });
  assert.equal(failed.status, 502);
  const failure = await failed.json() as any;
  assert.match(failure.error, /not installed/);
  assert.ok(!failure.error.includes(ollamaUrl));
  const failedTest = await post('/api/ai/test');
  assert.equal(failedTest.status, 502);
  assert.equal(((await failedTest.json()) as any).code, 'model_missing');

  // members cannot see the AI details
  await post('/api/users', { username: 'sam', password: 'a-long-enough-password', role: 'member' });
  const memberLogin = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'sam', password: 'a-long-enough-password' }) });
  const memberCookie = memberLogin.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(memberCookie, 'member can sign in');
  assert.equal((await fetch(`${base}/api/ai/status`, { headers: { Cookie: memberCookie! } })).status, 403);

  console.log('AI server checks passed');
} finally {
  child?.kill();
  fakeOllama.close();
  await fs.rm(tempDir, { recursive: true, force: true });
}
