import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import net from 'net';
import os from 'os';
import selfsigned from 'selfsigned';
import { buildIcs } from './server-lib/ics';
import { inventoryCsv } from './server-lib/csv';
import { buildDigest } from './server-lib/notify';
import { extractRecipeFromHtml, fetchPublicHtml, htmlToText } from './server-lib/recipeExtract';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
// Browsers only allow the camera on https pages (or localhost), so a second, https port is offered too
const HTTPS_PORT = process.env.HTTPS_DISABLED === 'true' ? null : Number(process.env.HTTPS_PORT || 3443);
const isProd = process.env.NODE_ENV === 'production';

// Persistent data directory (mount to /mnt/user/appdata/pantrypal on Unraid)
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'pantry-db.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize DATA_DIR:', e);
}

// Increase body parser limit for receipt image uploads
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));


// ---------------------------------------------------------------------------
// Household logins. Everyone signed in shares one pantry, planner and recipe book.
// Logins live in a plain text file in the data folder, one per line:
//     username:password [role]
// Roles: admin (manages people, edits everything), member (edits everything),
//        viewer (looks at everything and makes requests). No role = the first
//        line is admin and everyone else is a member.
// ---------------------------------------------------------------------------
type Role = 'admin' | 'member' | 'viewer';
const ROLES: Role[] = ['admin', 'member', 'viewer'];

interface UserRecord {
  username: string;
  password: string;
  role: Role;
}

const AUTH_ENABLED = process.env.AUTH_DISABLED !== 'true';
const USERS_FILE = path.join(DATA_DIR, 'users.txt');
const SECRET_FILE = path.join(DATA_DIR, '.session-secret');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
const SESSION_COOKIE = 'pantrypal_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const USERS_HEADER =
  '# PantryPal logins, one per line:  username:password [role]\n' +
  '# Roles: admin (manages people), member (edits everything), viewer (looks and makes requests)\n' +
  '# You can edit this file by hand or manage people from the menu in the app. No restart needed.\n';

function writeFileAtomic(file: string, content: string) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, file);
}

function ensureUsersFile() {
  try {
    if (fs.existsSync(USERS_FILE)) return;
    const password = crypto.randomBytes(6).toString('base64url');
    writeFileAtomic(USERS_FILE, `${USERS_HEADER}admin:${password} [admin]\n`);
    console.log('='.repeat(60));
    console.log('PantryPal created a login for you. Sign in with:');
    console.log(`   username: admin`);
    console.log(`   password: ${password}`);
    console.log(`(stored in ${USERS_FILE} - add family members from the menu in the app)`);
    console.log('='.repeat(60));
  } catch (e) {
    console.warn('Could not create users.txt:', e);
  }
}

function readUsers(): UserRecord[] {
  const users: UserRecord[] = [];
  try {
    fs.readFileSync(USERS_FILE, 'utf-8')
      .split(/\r?\n/)
      .forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const idx = trimmed.indexOf(':');
        if (idx < 1) return;
        const username = trimmed.slice(0, idx).trim().toLowerCase();
        let password = trimmed.slice(idx + 1);
        let role: Role | null = null;
        const m = password.match(/^(.*?)\s+\[(admin|member|viewer)\]\s*$/);
        if (m) {
          password = m[1];
          role = m[2] as Role;
        }
        if (users.some(u => u.username === username)) return;
        users.push({ username, password, role: role ?? (users.length === 0 ? 'admin' : 'member') });
      });
  } catch (e) {
    console.warn('Could not read users.txt:', e);
  }
  // A household always needs someone who can manage it
  if (users.length > 0 && !users.some(u => u.role === 'admin')) users[0].role = 'admin';
  return users;
}

function writeUsers(users: UserRecord[]) {
  writeFileAtomic(USERS_FILE, USERS_HEADER + users.map(u => `${u.username}:${u.password} [${u.role}]`).join('\n') + '\n');
}

function getSessionSecret(): string {
  try {
    if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, 'utf-8').trim();
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, secret, { encoding: 'utf-8', mode: 0o600 });
    return secret;
  } catch (e) {
    return crypto.randomBytes(32).toString('hex'); // sessions last until restart
  }
}

const safeEqual = (a: string, b: string) => {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

let sessionSecret = '';
const sign = (payload: string) => crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');

function createSessionToken(user: string): string {
  const payload = Buffer.from(JSON.stringify({ u: user, e: Date.now() + SESSION_MAX_AGE_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

interface Auth {
  user: string;
  role: Role;
}

// The role is looked up from users.txt on every request, so changes apply immediately
function readSession(req: Request): Auth | null {
  if (!AUTH_ENABLED) return { user: 'home', role: 'admin' };
  const header = req.headers.cookie || '';
  const match = header.split(';').map(c => c.trim()).find(c => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (typeof u !== 'string' || typeof e !== 'number' || e < Date.now()) return null;
    const record = readUsers().find(r => r.username === u);
    return record ? { user: record.username, role: record.role } : null; // a removed user is signed out
  } catch {
    return null;
  }
}

const authOf = (res: Response): Auth => res.locals.auth as Auth;
const canEdit = (auth: Auth) => auth.role === 'admin' || auth.role === 'member';

const cookieOptions = (maxAgeMs: number) =>
  `Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}`;

// Basic brute-force brake: 8 bad attempts per IP per 10 minutes
const failedLogins = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 8;

if (AUTH_ENABLED) {
  ensureUsersFile();
  sessionSecret = getSessionSecret();
} else {
  console.warn('AUTH_DISABLED=true: login is turned off. Anyone who can reach this server can use it.');
}

app.get('/api/auth/me', (req: Request, res: Response) => {
  if (!AUTH_ENABLED) return res.json({ authEnabled: false, authenticated: true, user: 'home', role: 'admin' });
  const auth = readSession(req);
  res.json({ authEnabled: true, authenticated: Boolean(auth), user: auth?.user ?? null, role: auth?.role ?? null });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  if (!AUTH_ENABLED) return res.json({ authenticated: true });
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const record = failedLogins.get(ip);
  if (record && now - record.first > WINDOW_MS) failedLogins.delete(ip);
  const current = failedLogins.get(ip);
  if (current && current.count >= MAX_FAILS) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }

  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const stored = readUsers().find(u => u.username === username);
  const ok = stored !== undefined && safeEqual(password, stored.password);

  if (!ok) {
    failedLogins.set(ip, { count: (current?.count || 0) + 1, first: current?.first || now });
    return res.status(401).json({ error: 'Wrong username or password' });
  }

  failedLogins.delete(ip);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(createSessionToken(username))}; ${cookieOptions(SESSION_MAX_AGE_MS)}`);
  res.json({ authenticated: true, user: stored.username, role: stored.role });
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${cookieOptions(0)}`);
  res.json({ authenticated: false });
});

// Everything else under /api needs a signed-in user (health check stays open for Docker)
app.use('/api', (req: Request, res: Response, next) => {
  if (req.path === '/health' || req.path.startsWith('/auth/')) return next();
  const auth = readSession(req);
  if (!auth) return res.status(401).json({ error: 'Not signed in' });
  res.locals.auth = auth;
  next();
});

const requireAdmin = (_req: Request, res: Response, next: () => void) => {
  if (authOf(res).role !== 'admin') return res.status(403).json({ error: 'Only an admin can do that' });
  next();
};

// AI calls cost money and only matter to people who can edit, so view-only members are kept out
app.use(['/api/scan-receipt', '/api/suggest-recipes', '/api/barcode-lookup', '/api/barcode-save', '/api/import-recipe', '/api/parse-recipe-text'], (_req: Request, res: Response, next) => {
  if (!canEdit(authOf(res))) return res.status(403).json({ error: 'View-only members cannot use scanning or AI suggestions' });
  next();
});

// --- People -----------------------------------------------------------------
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/;
const cleanPassword = (v: unknown) => String(v ?? '').replace(/[\r\n]/g, '');
const publicUser = (u: UserRecord) => ({ username: u.username, role: u.role });

// Names and roles only; never passwords
app.get('/api/users', (_req: Request, res: Response) => {
  res.json({ users: readUsers().map(publicUser) });
});

app.post('/api/users', requireAdmin, (req: Request, res: Response) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = cleanPassword(req.body?.password);
  const role: Role = ROLES.includes(req.body?.role) ? req.body.role : 'member';
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username: 2-32 letters, numbers, dots, dashes or underscores' });
  }
  if (password.length < 4 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be 4-128 characters' });
  }
  const users = readUsers();
  if (users.some(u => u.username === username)) return res.status(409).json({ error: 'That username is taken' });
  users.push({ username, password, role });
  writeUsers(users);
  res.json({ users: users.map(publicUser) });
});

app.patch('/api/users/:name', requireAdmin, (req: Request, res: Response) => {
  const users = readUsers();
  const target = users.find(u => u.username === String(req.params.name).toLowerCase());
  if (!target) return res.status(404).json({ error: 'No such person' });

  if (req.body?.role !== undefined) {
    if (!ROLES.includes(req.body.role)) return res.status(400).json({ error: 'Unknown role' });
    if (target.role === 'admin' && req.body.role !== 'admin' && users.filter(u => u.role === 'admin').length === 1) {
      return res.status(400).json({ error: 'There must be at least one admin' });
    }
    target.role = req.body.role;
  }
  if (req.body?.password !== undefined) {
    const password = cleanPassword(req.body.password);
    if (password.length < 4 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be 4-128 characters' });
    }
    target.password = password;
  }
  writeUsers(users);
  res.json({ users: users.map(publicUser) });
});

app.delete('/api/users/:name', requireAdmin, (req: Request, res: Response) => {
  const name = String(req.params.name).toLowerCase();
  const users = readUsers();
  const target = users.find(u => u.username === name);
  if (!target) return res.status(404).json({ error: 'No such person' });
  if (name === authOf(res).user) return res.status(400).json({ error: "You can't remove yourself" });
  if (target.role === 'admin' && users.filter(u => u.role === 'admin').length === 1) {
    return res.status(400).json({ error: 'There must be at least one admin' });
  }
  const remaining = users.filter(u => u.username !== name);
  writeUsers(remaining);
  res.json({ users: remaining.map(publicUser) });
});

// Change your own password
app.post('/api/me/password', (req: Request, res: Response) => {
  const auth = authOf(res);
  const users = readUsers();
  const me = users.find(u => u.username === auth.user);
  if (!me) return res.status(400).json({ error: 'Not available when login is turned off' });
  if (!safeEqual(String(req.body?.currentPassword ?? ''), me.password)) {
    return res.status(401).json({ error: 'Current password is wrong' });
  }
  const next = cleanPassword(req.body?.newPassword);
  if (next.length < 4 || next.length > 128) return res.status(400).json({ error: 'Password must be 4-128 characters' });
  me.password = next;
  writeUsers(users);
  res.json({ success: true });
});

// --- Requests: anyone in the household can ask, editors answer ---------------
type RequestType = 'shopping' | 'meal' | 'recipe' | 'other';
interface HouseholdRequest {
  id: string;
  type: RequestType;
  text: string;
  quantity?: number;
  unit?: string;
  date?: string; // YYYY-MM-DD, for meal requests
  slot?: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  requestedBy: string;
  createdAt: string;
  status: 'open' | 'done' | 'declined';
  resolvedBy?: string;
  resolvedAt?: string;
  note?: string;
  comments?: { id: string; by: string; at: string; text: string }[];
}

function readRequests(): HouseholdRequest[] {
  try {
    if (fs.existsSync(REQUESTS_FILE)) return JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf-8'));
  } catch (e) {
    console.error('Error reading requests.json:', e);
  }
  return [];
}

const writeRequests = (list: HouseholdRequest[]) => writeFileAtomic(REQUESTS_FILE, JSON.stringify(list, null, 2));

app.get('/api/requests', (_req: Request, res: Response) => {
  res.json({ requests: readRequests() });
});

app.post('/api/requests', (req: Request, res: Response) => {
  const auth = authOf(res);
  const type: RequestType = ['shopping', 'meal', 'recipe', 'other'].includes(req.body?.type) ? req.body.type : 'other';
  const text = String(req.body?.text ?? '').trim().slice(0, 200);
  if (!text) return res.status(400).json({ error: 'Say what you would like' });

  const entry: HouseholdRequest = {
    id: `req-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    type,
    text,
    requestedBy: auth.user,
    createdAt: new Date().toISOString(),
    status: 'open',
  };
  const qty = Number(req.body?.quantity);
  if (Number.isFinite(qty) && qty > 0) entry.quantity = qty;
  if (typeof req.body?.unit === 'string' && req.body.unit.trim()) entry.unit = req.body.unit.trim().slice(0, 20);
  if (typeof req.body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)) entry.date = req.body.date;
  if (['Breakfast', 'Lunch', 'Dinner', 'Snack'].includes(req.body?.slot)) entry.slot = req.body.slot;

  const list = [entry, ...readRequests()].slice(0, 500);
  writeRequests(list);
  res.json({ requests: list });
});

// Editors answer a request; the person who asked may withdraw their own
app.patch('/api/requests/:id', (req: Request, res: Response) => {
  const auth = authOf(res);
  const list = readRequests();
  const entry = list.find(r => r.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Request not found' });
  if (!canEdit(auth)) return res.status(403).json({ error: 'View-only members can make requests but not answer them' });
  if (!['open', 'done', 'declined'].includes(req.body?.status)) return res.status(400).json({ error: 'Unknown status' });

  entry.status = req.body.status;
  entry.resolvedBy = entry.status === 'open' ? undefined : auth.user;
  entry.resolvedAt = entry.status === 'open' ? undefined : new Date().toISOString();
  if (typeof req.body?.note === 'string') entry.note = req.body.note.trim().slice(0, 200) || undefined;
  writeRequests(list);
  res.json({ requests: list });
});

app.delete('/api/requests/:id', (req: Request, res: Response) => {
  const auth = authOf(res);
  const list = readRequests();
  const entry = list.find(r => r.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Request not found' });
  const isOwnOpen = entry.requestedBy === auth.user && entry.status === 'open';
  if (!isOwnOpen && !canEdit(auth)) return res.status(403).json({ error: 'You can only withdraw your own open requests' });
  const next = list.filter(r => r.id !== entry.id);
  writeRequests(next);
  res.json({ requests: next });
});

// Healthcheck endpoint for Unraid / Docker / Kubernetes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    isProduction: isProd,
    httpsPort: HTTPS_PORT,
    hasGeminiKey: Boolean(ai),
  });
});

// Anyone in the household can add a comment to a request (even view-only people)
app.post('/api/requests/:id/comments', (req: Request, res: Response) => {
  const auth = authOf(res);
  const list = readRequests();
  const entry = list.find(r => r.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Request not found' });
  const text = String(req.body?.text ?? '').trim().slice(0, 300);
  if (!text) return res.status(400).json({ error: 'Write something first' });
  entry.comments = [...(entry.comments ?? []), {
    id: `c-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    by: auth.user,
    at: new Date().toISOString(),
    text,
  }].slice(-50);
  writeRequests(list);
  res.json({ requests: list });
});

// Shared pantry database. Everyone in the household reads and writes the same copy.
// `revision` goes up on every save; a save made from an out-of-date copy is refused (409)
// so one person can't silently overwrite what another just changed.
// Every list the app keeps in the shared copy (plus `settings`)
const LIST_KEYS = [
  'inventory', 'recipes', 'plannedMeals', 'cookedLogs', 'shoppingList', 'purchaseLogs', 'rewards',
  'wasteLogs', 'priceHistory', 'receiptLog', 'activity',
] as const;
const EMPTY_DB: Record<string, any> = { settings: null };
LIST_KEYS.forEach(k => { EMPTY_DB[k] = []; });

function readDb(): any | null {
  try {
    if (fs.existsSync(DB_FILE)) {
      const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      if (typeof db.revision !== 'number') db.revision = 1; // saved before revisions existed
      return db;
    }
  } catch (err) {
    console.error('Error reading pantry-db.json:', err);
  }
  return null;
}

app.get('/api/pantry-data', (_req: Request, res: Response) => {
  // revision 0 = nothing saved on the server yet (a brand new install)
  res.json(readDb() ?? { ...EMPTY_DB, revision: 0 });
});

app.post('/api/pantry-data', (req: Request, res: Response) => {
  if (!canEdit(authOf(res))) {
    return res.status(403).json({ error: 'You have view-only access. Use Requests to ask for changes.' });
  }
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const current = readDb();
    const currentRevision = current?.revision ?? 0;
    if (req.body.baseRevision !== currentRevision) {
      return res.status(409).json({ error: 'Someone else changed the pantry first', current: current ?? { ...EMPTY_DB, revision: 0 } });
    }
    // A list the sender didn't include (an older cached copy of the app) keeps its current value
    const data: Record<string, any> = {};
    for (const key of LIST_KEYS) {
      data[key] = Array.isArray(req.body[key]) ? req.body[key] : (current?.[key] ?? []);
    }
    data.settings = req.body.settings || null;
    data.revision = currentRevision + 1;
    data.updatedBy = authOf(res).user;
    data.updatedAt = new Date().toISOString();
    writeFileAtomic(DB_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, revision: data.revision, savedAt: data.updatedAt });
  } catch (err: any) {
    console.error('Error saving pantry-db.json:', err);
    res.status(500).json({ error: 'Failed to persist pantry data' });
  }
});

// Units the AI may use, depending on whether the app measures by weight or volume
const UNIT_RULES = {
  mass: 'Use ONLY these units: g, kg, oz, lb (weight), or count, can, pack, bottle, bag, box, jar, bunch, clove. Never use cups, tbsp, tsp, ml, or any volume unit.',
  volume: 'Use ONLY these units: ml, l, fl oz, tsp, tbsp, cup, pt, qt, gal (volume), or count, can, pack, bottle, bag, box, jar, bunch, clove. Never use g, kg, oz or lb weight units.',
} as const;
const unitRule = (mode: unknown) => (mode === 'volume' ? UNIT_RULES.volume : UNIT_RULES.mass);

// Server-side Gemini initialization
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Model names move around; try the configured one, then moving alias, then stable.
const GEMINI_MODELS = [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash'].filter(
  (m, i, a): m is string => Boolean(m) && a.indexOf(m) === i,
);
let workingModel: string | null = null;
async function generateWithFallback(params: any): Promise<any> {
  if (!ai) throw new Error('AI is not configured');
  const models = workingModel ? [workingModel, ...GEMINI_MODELS.filter(m => m !== workingModel)] : GEMINI_MODELS;
  let lastErr: any;
  for (const model of models) {
    try {
      const out = await generateWithFallback({ ...params, model });
      workingModel = model;
      return out;
    } catch (e: any) {
      lastErr = e;
      console.error(`Gemini call failed on ${model}:`, e?.message || e);
      const msg = String(e?.message || '');
      // Only try the next model when this one looks missing/unsupported
      if (!/not found|404|not supported|unsupported|NOT_FOUND/i.test(msg)) break;
    }
  }
  throw lastErr;
}

// In-memory barcode catalog
const SERVER_BARCODE_DATABASE: Record<string, any> = {
  '076808500138': {
    barcode: '076808500138',
    name: 'Barilla Penne Rigate Pasta',
    brand: 'Barilla',
    category: 'Pantry & Grains',
    averagePrice: 1.99,
    standardQuantity: 16,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 730,
    storageLocation: 'Pantry',
    foundInDatabase: true,
  },
  '071430009214': {
    barcode: '071430009214',
    name: 'Fresh Organic Baby Spinach Clamshell',
    brand: 'Earthbound Farm',
    category: 'Produce',
    averagePrice: 3.99,
    standardQuantity: 16,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 6,
    storageLocation: 'Fridge',
    foundInDatabase: true,
  },
  '021000658832': {
    barcode: '021000658832',
    name: 'Organic Boneless Skinless Chicken Breast',
    brand: 'Perdue Farms',
    category: 'Meat & Seafood',
    averagePrice: 10.99,
    standardQuantity: 2.0,
    standardUnit: 'lb',
    estimatedShelfLifeDays: 5,
    storageLocation: 'Fridge',
    foundInDatabase: true,
  },
  '070380001015': {
    barcode: '070380001015',
    name: 'Cage-Free Grade A Large Brown Eggs',
    brand: 'Vital Farms',
    category: 'Dairy & Eggs',
    averagePrice: 4.49,
    standardQuantity: 12,
    standardUnit: 'count',
    estimatedShelfLifeDays: 28,
    storageLocation: 'Fridge',
    foundInDatabase: true,
  },
  '011110852014': {
    barcode: '011110852014',
    name: 'Thai Hom Mali Jasmine Rice (5 lb)',
    brand: 'Royal',
    category: 'Pantry & Grains',
    averagePrice: 7.99,
    standardQuantity: 5,
    standardUnit: 'lb',
    estimatedShelfLifeDays: 365,
    storageLocation: 'Pantry',
    foundInDatabase: true,
  },
  '037600106254': {
    barcode: '037600106254',
    name: 'San Marzano Style Crushed Tomatoes (28 oz)',
    brand: 'Cento',
    category: 'Canned & Jarred',
    averagePrice: 3.89,
    standardQuantity: 1,
    standardUnit: 'can',
    estimatedShelfLifeDays: 730,
    storageLocation: 'Pantry',
    foundInDatabase: true,
  },
  '041790001222': {
    barcode: '041790001222',
    name: 'Cold Pressed Extra Virgin Olive Oil (25.4 oz)',
    brand: 'California Olive Ranch',
    category: 'Spices & Condiments',
    averagePrice: 12.99,
    standardQuantity: 25.4,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 540,
    storageLocation: 'Pantry',
    foundInDatabase: true,
  },
  '021000612230': {
    barcode: '021000612230',
    name: 'Natural Sharp Cheddar Cheese Block',
    brand: 'Kraft',
    category: 'Dairy & Eggs',
    averagePrice: 3.59,
    standardQuantity: 8,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 60,
    storageLocation: 'Fridge',
    foundInDatabase: true,
  },
  '070380004016': {
    barcode: '070380004016',
    name: 'Organic Whole Milk Half Gallon',
    brand: 'Horizon Organic',
    category: 'Dairy & Eggs',
    averagePrice: 4.29,
    standardQuantity: 64,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 14,
    storageLocation: 'Fridge',
    foundInDatabase: true,
  },
  '041390001025': {
    barcode: '041390001025',
    name: 'Naturally Brewed Less Sodium Soy Sauce',
    brand: 'Kikkoman',
    category: 'Spices & Condiments',
    averagePrice: 3.49,
    standardQuantity: 15,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 730,
    storageLocation: 'Pantry',
    foundInDatabase: true,
  },
  '894700010014': {
    barcode: '894700010014',
    name: 'Plain Greek Whole Milk Yogurt (32 oz)',
    brand: 'Chobani',
    category: 'Dairy & Eggs',
    averagePrice: 5.49,
    standardQuantity: 32,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 21,
    storageLocation: 'Fridge',
    foundInDatabase: true,
  },
  '048001711464': {
    barcode: '048001711464',
    name: 'Organic Black Beans in Sea Salt (15 oz)',
    brand: 'Bush\'s Best',
    category: 'Canned & Jarred',
    averagePrice: 1.49,
    standardQuantity: 1,
    standardUnit: 'can',
    estimatedShelfLifeDays: 730,
    storageLocation: 'Pantry',
    foundInDatabase: true,
  },
  '013000006408': {
    barcode: '013000006408',
    name: 'Heinz Tomato Ketchup (20 oz)',
    brand: 'Heinz',
    category: 'Spices & Condiments',
    averagePrice: 3.29,
    standardQuantity: 20,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 365,
    storageLocation: 'Fridge',
    foundInDatabase: true,
  },
};

// API: Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(apiKey),
    timestamp: new Date().toISOString(),
  });
});

// --- Backups, export and restore -------------------------------------------
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const BACKUP_NAME_RE = /^(auto|manual|before-restore)-[\w.-]+\.json$/;
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function snapshotEverything() {
  return {
    app: 'pantrypal',
    version: 1,
    exportedAt: new Date().toISOString(),
    pantry: readDb() ?? { ...EMPTY_DB, revision: 0 },
    requests: readRequests(),
    barcodes: readBarcodeCache(),
  };
}

function pruneBackups(prefix: string, keep: number) {
  try {
    fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith(`${prefix}-`))
      .sort()
      .reverse()
      .slice(keep)
      .forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
  } catch (e) {
    console.warn('Could not prune backups:', e);
  }
}

function writeBackup(kind: 'auto' | 'manual' | 'before-restore'): string {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const now = new Date();
  const stamp = kind === 'auto'
    ? localDate(now)
    : `${localDate(now)}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const name = `${kind}-${stamp}.json`;
  writeFileAtomic(path.join(BACKUP_DIR, name), JSON.stringify(snapshotEverything()));
  pruneBackups(kind, kind === 'auto' ? 14 : kind === 'manual' ? 10 : 5);
  return name;
}

function ensureDailyBackup() {
  try {
    if (!readDb()) return;
    if (!fs.existsSync(path.join(BACKUP_DIR, `auto-${localDate()}.json`))) writeBackup('auto');
  } catch (e) {
    console.warn('Daily backup failed:', e);
  }
}

function validSnapshot(snap: any): boolean {
  return Boolean(
    snap && snap.app === 'pantrypal' && snap.pantry && typeof snap.pantry === 'object' &&
    LIST_KEYS.every(k => snap.pantry[k] === undefined || Array.isArray(snap.pantry[k]))
  );
}

function restoreSnapshot(snap: any, by: string) {
  writeBackup('before-restore');
  const current = readDb();
  const data: Record<string, any> = {};
  for (const key of LIST_KEYS) data[key] = Array.isArray(snap.pantry[key]) ? snap.pantry[key] : [];
  data.settings = snap.pantry.settings ?? null;
  data.revision = (current?.revision ?? 0) + 1; // everyone's open copy refreshes
  data.updatedBy = by;
  data.updatedAt = new Date().toISOString();
  writeFileAtomic(DB_FILE, JSON.stringify(data, null, 2));
  if (Array.isArray(snap.requests)) writeRequests(snap.requests);
  if (snap.barcodes && typeof snap.barcodes === 'object') writeFileAtomic(BARCODE_CACHE_FILE, JSON.stringify(snap.barcodes, null, 2));
}

// Downloads (no passwords are ever included)
app.get('/api/export', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="pantrypal-export-${localDate()}.json"`);
  res.send(JSON.stringify(snapshotEverything(), null, 2));
});

app.get('/api/export/inventory.csv', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pantry-${localDate()}.csv"`);
  res.send('﻿' + inventoryCsv(readDb()?.inventory ?? []));
});

app.get('/api/backups', requireAdmin, (_req: Request, res: Response) => {
  try {
    const files = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter(f => BACKUP_NAME_RE.test(f)) : [];
    const list = files.map(name => {
      const st = fs.statSync(path.join(BACKUP_DIR, name));
      return { name, size: st.size, createdAt: st.mtime.toISOString(), kind: name.split('-')[0] };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ backups: list });
  } catch (e) {
    res.status(500).json({ error: 'Could not list backups' });
  }
});

app.post('/api/backups', requireAdmin, (_req: Request, res: Response) => {
  try {
    res.json({ name: writeBackup('manual') });
  } catch (e) {
    res.status(500).json({ error: 'Could not create the backup' });
  }
});

app.get('/api/backups/:name', requireAdmin, (req: Request, res: Response) => {
  const name = String(req.params.name);
  const file = path.join(BACKUP_DIR, name);
  if (!BACKUP_NAME_RE.test(name) || !fs.existsSync(file)) return res.status(404).json({ error: 'No such backup' });
  res.download(file, name);
});

app.post('/api/backups/:name/restore', requireAdmin, (req: Request, res: Response) => {
  const name = String(req.params.name);
  const file = path.join(BACKUP_DIR, name);
  if (!BACKUP_NAME_RE.test(name) || !fs.existsSync(file)) return res.status(404).json({ error: 'No such backup' });
  try {
    const snap = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!validSnapshot(snap)) return res.status(400).json({ error: 'That backup file is not valid' });
    restoreSnapshot(snap, authOf(res).user);
    res.json({ success: true });
  } catch (e) {
    console.error('Restore failed:', e);
    res.status(500).json({ error: 'Could not restore the backup' });
  }
});

app.post('/api/import', requireAdmin, (req: Request, res: Response) => {
  if (!validSnapshot(req.body)) return res.status(400).json({ error: "That file isn't a PantryPal export" });
  try {
    restoreSnapshot(req.body, authOf(res).user);
    res.json({ success: true });
  } catch (e) {
    console.error('Import failed:', e);
    res.status(500).json({ error: 'Could not import that file' });
  }
});

// --- Calendar feed of the meal plan ------------------------------------------
// Phones subscribe to a private link (the long random token is the password, so no login is needed).
const CALENDAR_FILE = path.join(DATA_DIR, 'calendar.json');

function getCalendarToken(regenerate = false): string {
  try {
    if (!regenerate && fs.existsSync(CALENDAR_FILE)) {
      const t = JSON.parse(fs.readFileSync(CALENDAR_FILE, 'utf-8')).token;
      if (typeof t === 'string' && /^[a-f0-9]{48}$/.test(t)) return t;
    }
  } catch (e) {}
  const token = crypto.randomBytes(24).toString('hex');
  writeFileAtomic(CALENDAR_FILE, JSON.stringify({ token }));
  return token;
}

app.get('/api/calendar-link', (_req: Request, res: Response) => {
  res.json({ path: `/calendar/${getCalendarToken()}.ics` });
});

app.post('/api/calendar-link/regenerate', requireAdmin, (_req: Request, res: Response) => {
  res.json({ path: `/calendar/${getCalendarToken(true)}.ics` });
});

app.get('/calendar/:file', (req: Request, res: Response) => {
  const m = String(req.params.file).match(/^([a-f0-9]{48})\.ics$/);
  if (!m || !safeEqual(m[1], getCalendarToken())) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(buildIcs(readDb()?.plannedMeals ?? []));
});

// --- Daily alerts to a phone (ntfy, or any webhook) --------------------------
interface NotifyConfig {
  enabled: boolean;
  url: string;
  format: 'ntfy' | 'json';
  time: string; // HH:MM, server time
  daysAhead: number;
  lastSent?: string;
}
const NOTIFY_FILE = path.join(DATA_DIR, 'notify.json');
const NOTIFY_DEFAULTS: NotifyConfig = { enabled: false, url: '', format: 'ntfy', time: '08:00', daysAhead: 3 };

function readNotify(): NotifyConfig {
  try {
    if (fs.existsSync(NOTIFY_FILE)) return { ...NOTIFY_DEFAULTS, ...JSON.parse(fs.readFileSync(NOTIFY_FILE, 'utf-8')) };
  } catch (e) {}
  return { ...NOTIFY_DEFAULTS };
}

async function sendNotification(cfg: NotifyConfig, title: string, lines: string[]) {
  const message = lines.join('\n');
  const res = cfg.format === 'ntfy'
    ? await fetch(cfg.url, { method: 'POST', headers: { Title: title, Tags: 'shopping_cart' }, body: message, signal: AbortSignal.timeout(8000) })
    : await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, message, lines }), signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`The alert service answered ${res.status}`);
}

async function runDailyAlert() {
  const cfg = readNotify();
  if (!cfg.enabled || !cfg.url) return;
  const now = new Date();
  const today = localDate(now);
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (cfg.lastSent === today || hhmm < cfg.time) return;
  try {
    const db = readDb();
    const digest = db ? buildDigest({ inventory: db.inventory ?? [], plannedMeals: db.plannedMeals ?? [], today, daysAhead: cfg.daysAhead }) : null;
    if (digest) await sendNotification(cfg, digest.title, digest.lines);
    writeFileAtomic(NOTIFY_FILE, JSON.stringify({ ...cfg, lastSent: today }, null, 2));
  } catch (e) {
    console.warn('Daily alert failed (will retry in a minute):', (e as Error).message);
  }
}

app.get('/api/notify', requireAdmin, (_req: Request, res: Response) => {
  const { lastSent, ...cfg } = readNotify();
  res.json({ ...cfg, lastSent: lastSent ?? null });
});

app.put('/api/notify', requireAdmin, (req: Request, res: Response) => {
  const b = req.body || {};
  const url = String(b.url ?? '').trim();
  if (b.enabled && !/^https?:\/\/\S+$/.test(url)) return res.status(400).json({ error: 'Enter the full alert address, starting with http:// or https://' });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(b.time ?? ''))) return res.status(400).json({ error: 'Time should look like 08:00' });
  const daysAhead = Math.min(14, Math.max(0, Math.round(Number(b.daysAhead))));
  const cfg: NotifyConfig = {
    enabled: Boolean(b.enabled),
    url: url.slice(0, 500),
    format: b.format === 'json' ? 'json' : 'ntfy',
    time: b.time,
    daysAhead: Number.isFinite(daysAhead) ? daysAhead : 3,
    lastSent: readNotify().lastSent,
  };
  writeFileAtomic(NOTIFY_FILE, JSON.stringify(cfg, null, 2));
  res.json({ success: true });
});

app.post('/api/notify/test', requireAdmin, async (req: Request, res: Response) => {
  const cfg = { ...readNotify(), ...(req.body && typeof req.body.url === 'string' ? { url: req.body.url.trim(), format: req.body.format === 'json' ? 'json' : 'ntfy' } : {}) } as NotifyConfig;
  if (!/^https?:\/\/\S+$/.test(cfg.url)) return res.status(400).json({ error: 'Enter the full alert address first' });
  try {
    const db = readDb();
    const digest = db ? buildDigest({ inventory: db.inventory ?? [], plannedMeals: db.plannedMeals ?? [], today: localDate(), daysAhead: cfg.daysAhead }) : null;
    await sendNotification(cfg, digest?.title ?? 'PantryPal test', digest?.lines ?? ['This is a test alert. Nothing needs attention right now.']);
    res.json({ success: true });
  } catch (e) {
    res.status(502).json({ error: `Could not send: ${(e as Error).message}` });
  }
});

// --- Recipe import (from a link, or pasted text with the AI) ------------------
async function parseRecipeTextWithAi(text: string) {
  if (!ai) throw new Error('AI recipe reading needs a GEMINI_API_KEY set on the server');
  const response = await generateWithFallback({
    contents: `Extract the recipe from this text. Copy the ingredient lines as written (e.g. "1 1/2 cups flour"). If something is not stated, use null or an empty list; do not invent it.\n\n${text}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          servings: { type: Type.INTEGER },
          prepMinutes: { type: Type.INTEGER },
          cookMinutes: { type: Type.INTEGER },
          ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
          cuisine: { type: Type.STRING },
          category: { type: Type.STRING },
          keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['name', 'ingredients', 'instructions'],
      },
    },
  });
  const parsed = JSON.parse(response.text || '{}');
  if (!parsed.name || !Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) {
    throw new Error("Couldn't find a recipe in that text");
  }
  return {
    name: String(parsed.name),
    description: String(parsed.description ?? ''),
    servings: parsed.servings ?? null,
    prepMinutes: parsed.prepMinutes ?? null,
    cookMinutes: parsed.cookMinutes ?? null,
    ingredients: parsed.ingredients.map(String),
    instructions: (parsed.instructions ?? []).map(String),
    cuisine: String(parsed.cuisine ?? ''),
    category: String(parsed.category ?? ''),
    keywords: (parsed.keywords ?? []).map(String).slice(0, 8),
  };
}

app.post('/api/import-recipe', async (req: Request, res: Response) => {
  const url = String(req.body?.url ?? '').trim();
  if (!url) return res.status(400).json({ error: 'Paste a link to a recipe' });
  try {
    const { html, url: finalUrl } = await fetchPublicHtml(url);
    const recipe = extractRecipeFromHtml(html);
    if (recipe) return res.json({ recipe: { ...recipe, sourceUrl: finalUrl }, via: 'page' });
    // No structured recipe on the page: let the AI read it, if it is set up
    if (ai) {
      const viaAi = await parseRecipeTextWithAi(htmlToText(html).slice(0, 15000));
      return res.json({ recipe: { ...viaAi, sourceUrl: finalUrl }, via: 'ai' });
    }
    res.status(404).json({ error: "That page doesn't include recipe details PantryPal can read. Try copying the recipe text instead." });
  } catch (e) {
    const msg = (e as Error).message;
    res.status(400).json({ error: /fetch failed|ENOTFOUND|ECONN|EAI_AGAIN/i.test(msg) ? "Couldn't open that link" : msg });
  }
});

app.post('/api/parse-recipe-text', async (req: Request, res: Response) => {
  const text = String(req.body?.text ?? '').trim().slice(0, 15000);
  if (text.length < 20) return res.status(400).json({ error: 'Paste the recipe text first' });
  try {
    res.json({ recipe: await parseRecipeTextWithAi(text), via: 'ai' });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// --- Barcode lookup ---------------------------------------------------------
// Order: what your household saved -> built-in list -> Open Food Facts (free, worldwide)
//        -> barcodelookup.com (if BARCODE_LOOKUP_API_KEY is set) -> UPCitemdb (free, limited)
//        -> Gemini guess -> "not found"
const BARCODE_CACHE_FILE = path.join(DATA_DIR, 'barcode-cache.json');
// "0012345678905", "012345678905" and "12345678905" are the same product, so ignore leading zeros
const barcodeKey = (code: string) => code.replace(/\D/g, '').replace(/^0+/, '');

function readBarcodeCache(): Record<string, any> {
  try {
    if (fs.existsSync(BARCODE_CACHE_FILE)) return JSON.parse(fs.readFileSync(BARCODE_CACHE_FILE, 'utf-8'));
  } catch (e) {
    console.warn('Could not read barcode-cache.json:', e);
  }
  return {};
}

type CategoryGuess = { category: string; location: string; shelfDays: number };
const CATEGORY_RULES: { test: RegExp; guess: CategoryGuess }[] = [
  { test: /\b(frozen|ice[- ]?cream)\b/i, guess: { category: 'Frozen', location: 'Freezer', shelfDays: 180 } },
  { test: /\b(eggs?)\b/i, guess: { category: 'Dairy & Eggs', location: 'Fridge', shelfDays: 28 } },
  { test: /\b(dair|milk|cheese|yogh?urt|butter|cream|kefir)/i, guess: { category: 'Dairy & Eggs', location: 'Fridge', shelfDays: 14 } },
  { test: /\b(meat|beef|pork|poultry|chicken|turkey|lamb|bacon|sausage|fish|seafood|salmon|tuna|shrimp|prawn)/i, guess: { category: 'Meat & Seafood', location: 'Fridge', shelfDays: 4 } },
  { test: /\b(fruit|vegetable|produce|salad|herb|potato|tomato|apple|banana|berr(y|ies))/i, guess: { category: 'Produce', location: 'Fridge', shelfDays: 7 } },
  { test: /\b(bread|bakery|pastr|bun|bagel|cake|tortilla|wrap)/i, guess: { category: 'Bakery', location: 'Counter', shelfDays: 5 } },
  { test: /\b(canned|tinned|jar|preserve|beans?|soup)/i, guess: { category: 'Canned & Jarred', location: 'Pantry', shelfDays: 730 } },
  { test: /\b(spice|sauce|condiment|oil|vinegar|ketchup|mustard|mayo|dressing|seasoning|salt|pepper)/i, guess: { category: 'Spices & Condiments', location: 'Pantry', shelfDays: 365 } },
  { test: /\b(beverage|drink|water|juice|soda|cola|tea|coffee|beer|wine)/i, guess: { category: 'Beverages', location: 'Pantry', shelfDays: 180 } },
  { test: /\b(snack|crisps?|chips|biscuit|cookie|chocolate|candy|sweet|confection|nut)/i, guess: { category: 'Snacks', location: 'Pantry', shelfDays: 180 } },
  { test: /\b(cereal|pasta|rice|flour|grain|noodle|oat|sugar|baking)/i, guess: { category: 'Pantry & Grains', location: 'Pantry', shelfDays: 365 } },
];

function guessCategory(text: string): CategoryGuess {
  return CATEGORY_RULES.find(r => r.test.test(text))?.guess ?? { category: 'Other', location: 'Pantry', shelfDays: 60 };
}

// "500 g", "1.5 L", "75cl", "12 eggs", "6" -> { quantity, unit }
function parsePackSize(raw: unknown): { quantity: number; unit: string } {
  const m = String(raw ?? '').toLowerCase().replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l|oz|lb|fl\.? ?oz)?/);
  if (!m) return { quantity: 1, unit: 'count' };
  let quantity = Number(m[1]);
  let unit = (m[2] || 'count').replace(/\./g, '').replace(/\s/g, ' ');
  if (unit === 'cl') { quantity *= 10; unit = 'ml'; }
  if (unit === 'floz') unit = 'fl oz';
  return { quantity, unit };
}

const lookupHeaders = { 'User-Agent': 'PantryPal/1.0 (self-hosted pantry app)' };

// Open Food Facts allergen tags -> the keys the app uses
const OFF_ALLERGENS: Record<string, string> = {
  gluten: 'gluten', milk: 'milk', eggs: 'eggs', peanuts: 'peanuts', nuts: 'nuts', soybeans: 'soy',
  fish: 'fish', crustaceans: 'shellfish', molluscs: 'shellfish', 'sesame-seeds': 'sesame',
};

function toResult(code: string, base: {
  name: string; brand?: string; categoryText: string; pack?: unknown; price?: number; source: string;
  nutriments?: any; nutriscore?: string; allergenTags?: string[];
}) {
  const g = guessCategory(base.categoryText || base.name);
  const { quantity, unit } = parsePackSize(base.pack);
  return {
    barcode: code,
    name: base.name,
    brand: base.brand || undefined,
    category: g.category,
    averagePrice: base.price && base.price > 0 ? Number(base.price.toFixed(2)) : 0, // never invent a price
    standardQuantity: quantity,
    standardUnit: unit,
    estimatedShelfLifeDays: g.shelfDays,
    storageLocation: g.location,
    foundInDatabase: true,
    source: base.source,
    ...(extras(base, unit)),
  };
}

// Calories and allergens, when the database has them
function extras(base: { nutriments?: any; nutriscore?: string; allergenTags?: string[] }, unit: string) {
  const out: Record<string, unknown> = {};
  const n = base.nutriments;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(1)) : undefined);
  if (n && num(n['energy-kcal_100g']) !== undefined) {
    out.nutrition = {
      per: ['ml', 'l', 'fl oz'].includes(unit) ? '100ml' : '100g',
      kcal: num(n['energy-kcal_100g']),
      protein: num(n['proteins_100g']),
      carbs: num(n['carbohydrates_100g']),
      fat: num(n['fat_100g']),
      nutriscore: /^[a-e]$/.test(base.nutriscore ?? '') ? base.nutriscore : undefined,
    };
  }
  if (base.allergenTags?.length) {
    out.allergens = Array.from(new Set(base.allergenTags.map(t => OFF_ALLERGENS[t.replace(/^[a-z]{2}:/, '')]).filter(Boolean)));
  }
  return out;
}

async function lookupOpenFoodFacts(code: string) {
  // Try the code as typed, plus the UPC-A/EAN-13 forms of the same number
  const digits = code.replace(/\D/g, '');
  const variants = Array.from(new Set([digits, digits.length === 12 ? `0${digits}` : '', digits.length === 13 && digits.startsWith('0') ? digits.slice(1) : '']))
    .filter(Boolean);
  for (const v of variants) {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${v}.json?fields=product_name,generic_name,brands,categories_tags,quantity,nutriments,nutriscore_grade,allergens_tags`,
      { headers: lookupHeaders, signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) continue;
    const data: any = await r.json();
    const p = data?.product;
    const name = (p?.product_name || p?.generic_name || '').trim();
    if (data?.status === 1 && name) {
      const brand = String(p.brands || '').split(',')[0].trim();
      const tags = Array.isArray(p.categories_tags) ? p.categories_tags.map((t: string) => t.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')).join(' ') : '';
      return toResult(code, { name, brand, categoryText: `${tags} ${name}`, pack: p.quantity, source: 'open_food_facts', nutriments: p.nutriments, nutriscore: p.nutriscore_grade, allergenTags: p.allergens_tags });
    }
  }
  return null;
}

async function lookupBarcodeLookupCom(code: string) {
  const key = process.env.BARCODE_LOOKUP_API_KEY;
  if (!key) return null;
  const r = await fetch(`https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(code)}&formatted=y&key=${encodeURIComponent(key)}`, {
    headers: lookupHeaders, signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) return null;
  const p: any = ((await r.json()) as any)?.products?.[0];
  if (!p?.title) return null;
  const price = Number(p.stores?.map((s: any) => Number(s.price)).find((n: number) => n > 0)) || 0;
  return toResult(code, { name: p.title, brand: p.brand, categoryText: `${p.category || ''} ${p.title}`, pack: p.size || p.title, price, source: 'barcodelookup_com' });
}

async function lookupUpcItemDb(code: string) {
  const r = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, {
    headers: lookupHeaders, signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) return null;
  const p: any = ((await r.json()) as any)?.items?.[0];
  if (!p?.title) return null;
  const price = Number(p.lowest_recorded_price) || 0;
  return toResult(code, { name: p.title, brand: p.brand, categoryText: `${p.category || ''} ${p.title}`, pack: p.size || p.title, price, source: 'upcitemdb' });
}

// Remember what your household corrected, so the same barcode is right next time
app.post('/api/barcode-save', (req: Request, res: Response) => {
  const b = req.body || {};
  const code = String(b.barcode || '').trim();
  const name = String(b.name || '').trim().slice(0, 200);
  if (!barcodeKey(code) || !name) return res.status(400).json({ error: 'Barcode and name are required' });
  const cache = readBarcodeCache();
  cache[barcodeKey(code)] = {
    barcode: code,
    name,
    brand: undefined,
    category: String(b.category || 'Other'),
    averagePrice: Number(b.averagePrice) > 0 ? Number(b.averagePrice) : 0,
    standardQuantity: Number(b.standardQuantity) > 0 ? Number(b.standardQuantity) : 1,
    standardUnit: String(b.standardUnit || 'count').slice(0, 20),
    estimatedShelfLifeDays: Number(b.estimatedShelfLifeDays) > 0 ? Math.round(Number(b.estimatedShelfLifeDays)) : 30,
    storageLocation: String(b.storageLocation || 'Pantry'),
    foundInDatabase: true,
    source: 'saved',
    nutrition: b.nutrition && typeof b.nutrition === 'object' ? b.nutrition : undefined,
    allergens: Array.isArray(b.allergens) ? b.allergens.map(String).slice(0, 12) : undefined,
  };
  try {
    writeFileAtomic(BARCODE_CACHE_FILE, JSON.stringify(cache, null, 2));
    res.json({ success: true });
  } catch (e) {
    console.error('Could not save barcode-cache.json:', e);
    res.status(500).json({ error: 'Could not save the barcode' });
  }
});

// API: Barcode Lookup
app.post('/api/barcode-lookup', async (req: Request, res: Response) => {
  try {
    const { barcode } = req.body;
    if (!barcode || typeof barcode !== 'string') {
      res.status(400).json({ error: 'Missing barcode parameter' });
      return;
    }

    const cleanBarcode = barcode.trim();

    // 0. Anything this household saved before
    const saved = readBarcodeCache()[barcodeKey(cleanBarcode)];
    if (saved) {
      res.json({ ...saved, barcode: cleanBarcode });
      return;
    }

    // 1. Check local catalog first
    if (SERVER_BARCODE_DATABASE[cleanBarcode]) {
      res.json({
        ...SERVER_BARCODE_DATABASE[cleanBarcode],
        source: 'local_database',
      });
      return;
    }

    // 1b. Real product databases (each is skipped quietly if it is unreachable)
    for (const lookup of [lookupOpenFoodFacts, lookupBarcodeLookupCom, lookupUpcItemDb]) {
      try {
        const found = await lookup(cleanBarcode);
        if (found) {
          res.json(found);
          return;
        }
      } catch (e) {
        console.warn(`Barcode lookup via ${lookup.name} failed:`, (e as Error).message);
      }
    }

    // 2. If Gemini is available, query Gemini to identify or enrich the barcode
    if (ai) {
      try {
        const response = await generateWithFallback({
          contents: `Look up or infer the grocery product for barcode / UPC code "${cleanBarcode}".
Return a JSON object with:
- name: realistic item name (e.g. "Honey Nut Cheerios Cereal")
- brand: brand name if recognized or generic
- category: one of ["Produce", "Dairy & Eggs", "Meat & Seafood", "Pantry & Grains", "Canned & Jarred", "Frozen", "Bakery", "Beverages", "Spices & Condiments", "Snacks", "Other"]
- averagePrice: reasonable US grocery price number (e.g. 3.99)
- standardQuantity: quantity number (e.g. 16 or 1)
- standardUnit: unit like "oz", "lb", "count", "can", "bottle", "pack"
- estimatedShelfLifeDays: integer days shelf life
- storageLocation: one of ["Fridge", "Freezer", "Pantry", "Counter", "Spice Rack"]`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                brand: { type: Type.STRING },
                category: { type: Type.STRING },
                averagePrice: { type: Type.NUMBER },
                standardQuantity: { type: Type.NUMBER },
                standardUnit: { type: Type.STRING },
                estimatedShelfLifeDays: { type: Type.INTEGER },
                storageLocation: { type: Type.STRING },
              },
              required: ['name', 'category', 'averagePrice', 'standardQuantity', 'standardUnit', 'estimatedShelfLifeDays', 'storageLocation'],
            },
          },
        });

        const text = response.text;
        if (text) {
          const parsed = JSON.parse(text);
          res.json({
            barcode: cleanBarcode,
            ...parsed,
            foundInDatabase: true,
            source: 'gemini_guess',
          });
          return;
        }
      } catch (geminiErr) {
        console.error('Gemini barcode lookup error:', geminiErr);
      }
    }

    // 3. Not found anywhere: say so, and leave the details for the person to fill in
    res.json({
      barcode: cleanBarcode,
      name: '',
      category: 'Other',
      averagePrice: 0,
      standardQuantity: 1,
      standardUnit: 'count',
      estimatedShelfLifeDays: 30,
      storageLocation: 'Pantry',
      foundInDatabase: false,
      source: 'not_found',
    });
  } catch (err: any) {
    console.error('Error in barcode lookup:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// API: Scan Receipt (Multimodal Gemini 3.8 Flash)
app.post('/api/scan-receipt', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', measureMode, currency } = req.body;
    const currencyCode = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : 'USD';

    if (!imageBase64) {
      res.status(400).json({ error: 'Missing imageBase64 payload' });
      return;
    }

    // Clean base64 prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    if (!ai) {
      res.status(503).json({ error: 'Receipt scanning needs a Gemini API key. Set GEMINI_API_KEY on the server and restart.' });
      return;
    }
    {
      try {
        const response = await generateWithFallback({
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: `You are an expert grocery receipt OCR engine.
Read this receipt photo carefully and extract EVERY line item, top to bottom. Never invent or guess items that are not printed. Receipt text may be abbreviated (e.g. "ORG BNLS CHKN BRST"): expand to a readable product name. Skip totals, payment, change, discounts-only lines and loyalty lines. Multi-buy lines (e.g. "2 @ 1.50") are one item with quantity 2. Weighed items use the weight as quantity.\nExtract all details from this receipt:
1. Store name (e.g. "Trader Joe's", "Costco", "Whole Foods", "Kroger", "Safeway", or whatever is shown).
2. Purchase date in YYYY-MM-DD format (if unclear, use today's date, ${new Date().toISOString().split('T')[0]}).
3. Subtotal, tax, and total amount paid.
4. Itemized list of grocery items purchased:
   - name: clear food/product name (e.g. "Organic Baby Spinach", "Boneless Chicken Breasts", "Whole Milk")
   - category: strictly one of ["Produce", "Dairy & Eggs", "Meat & Seafood", "Pantry & Grains", "Canned & Jarred", "Frozen", "Bakery", "Beverages", "Spices & Condiments", "Snacks", "Other"]
   - quantity: number (e.g. 1, 2, 2.5)
   - unit: ${unitRule(measureMode)}
   - unitPrice: unit price number, exactly as printed (the user's currency is ${currencyCode}; do not convert)
   - totalPrice: total price number for this item line
   - estimatedShelfLifeDays: typical days it stays fresh (e.g. spinach: 5, chicken: 4, milk: 10, canned beans: 700)
   - barcode: optional UPC if visible
5. rewardsPoints: loyalty / rewards points EARNED on this purchase, if the receipt prints them (e.g. "Points earned: 120", "Fuel points", "You earned 45 pts"). Use the points earned this trip, not the running balance. Omit if not shown.
Return clean JSON matching the schema.`,
              },
            ],
          },
          config: {
            temperature: 0,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                storeName: { type: Type.STRING },
                purchaseDate: { type: Type.STRING },
                subtotal: { type: Type.NUMBER },
                tax: { type: Type.NUMBER },
                total: { type: Type.NUMBER },
                rewardsPoints: { type: Type.INTEGER },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      category: { type: Type.STRING },
                      quantity: { type: Type.NUMBER },
                      unit: { type: Type.STRING },
                      unitPrice: { type: Type.NUMBER },
                      totalPrice: { type: Type.NUMBER },
                      estimatedShelfLifeDays: { type: Type.INTEGER },
                      barcode: { type: Type.STRING },
                    },
                    required: ['name', 'category', 'quantity', 'unit', 'unitPrice', 'totalPrice', 'estimatedShelfLifeDays'],
                  },
                },
              },
              required: ['storeName', 'purchaseDate', 'total', 'items'],
            },
          },
        });

        const text = response.text;
        if (!text) throw new Error('empty response');
        const parsed = JSON.parse(text);
        const items = (parsed.items || []).filter((it: any) => it && String(it.name || '').trim());
        if (items.length === 0) {
          res.status(422).json({ error: 'No items could be read from that photo. Try a sharper, well-lit, flat photo of the whole receipt.' });
          return;
        }
        res.json({
          ...parsed,
          items: items.map((it: any) => ({ ...it, selected: true })),
          source: 'gemini_multimodal_vision',
        });
        return;
      } catch (geminiError: any) {
        console.error('Gemini vision receipt parsing error:', geminiError);
        res.status(502).json({ error: 'The AI could not read this receipt: ' + (String(geminiError?.message || '').slice(0, 200) || 'unknown error') });
        return;
      }
    }
  } catch (err: any) {
    console.error('Error scanning receipt:', err);
    res.status(500).json({ error: err.message || 'Failed to scan receipt' });
  }
});

// API: Suggest Recipes (Gemini 3.8 Flash)
app.post('/api/suggest-recipes', async (req: Request, res: Response) => {
  try {
    const { inventory, mealType, cuisine, preferences, existingRecipeNames, measureMode } = req.body;
    const existingNames: string[] = Array.isArray(existingRecipeNames)
      ? existingRecipeNames.filter((n: unknown): n is string => typeof n === 'string')
      : [];

    if (!Array.isArray(inventory)) {
      res.status(400).json({ error: 'inventory must be an array' });
      return;
    }

    if (ai) {
      try {
        const inventorySummary = inventory.map(item =>
          `- ${item.name} (${item.quantity} ${item.unit}, exp: ${item.expirationDate || 'N/A'}, cat: ${item.category})`
        ).join('\n');

        const prompt = `You are a culinary chef and smart food waste reduction advisor.
Here is the user's current kitchen inventory:
${inventorySummary}

Current Date: ${new Date().toISOString().split('T')[0]}.
${mealType ? `Desired Meal Type: ${mealType}` : ''}
${cuisine ? `Desired Cuisine: ${cuisine}` : ''}
${preferences ? `Extra Request: ${preferences}` : ''}

Generate 2 to 3 delicious, realistic recipes that:
1. PRIORITIZE ingredients that expire the soonest (urgency to prevent food waste!).
2. Utilize abundant ingredients currently in stock.
3. Clearly specify exact quantities with units matching typical cooking and inventory units.
4. Provide step-by-step cooking instructions.
5. Provide realistic prep and cook times in minutes.
6. ${unitRule(measureMode)}
7. Every recipe must be clearly different from the others you return.
${existingNames.length ? `8. The user already has these recipes, so do NOT suggest them or close variations of them:\n${existingNames.map(n => `- ${n}`).join('\n')}` : ''}`;

        const response = await generateWithFallback({
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  mealType: { type: Type.STRING },
                  cuisine: { type: Type.STRING },
                  servings: { type: Type.INTEGER },
                  prepTimeMinutes: { type: Type.INTEGER },
                  cookTimeMinutes: { type: Type.INTEGER },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  ingredients: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        quantity: { type: Type.NUMBER },
                        unit: { type: Type.STRING },
                      },
                      required: ['name', 'quantity', 'unit'],
                    },
                  },
                  instructions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['name', 'description', 'mealType', 'cuisine', 'servings', 'prepTimeMinutes', 'cookTimeMinutes', 'ingredients', 'instructions', 'tags'],
              },
            },
          },
        });

        const text = response.text;
        if (text) {
          const parsedRecipes = JSON.parse(text);
          // Drop repeats of recipes the user already has and repeats within this batch
          const seenNames = new Set(existingNames.map(n => n.toLowerCase().trim()));
          const recipes = parsedRecipes.filter((r: any) => {
            const key = String(r.name || '').toLowerCase().trim();
            if (!key || seenNames.has(key)) return false;
            seenNames.add(key);
            return true;
          });
          // Assign unique IDs
          const formattedRecipes = recipes.map((r: any, idx: number) => ({
            id: `ai-rec-${Date.now()}-${idx}`,
            ...r,
            isAiGenerated: true,
          }));
          res.json({ recipes: formattedRecipes });
          return;
        }
      } catch (geminiError) {
        console.error('Gemini recipe suggestion error:', geminiError);
      }
    }

    // No canned recipe: returning the same fallback every click is what produced duplicates
    res.status(503).json({
      error: ai
        ? 'The AI could not generate recipes right now. Please try again.'
        : 'AI recipes need a GEMINI_API_KEY set on the server.',
    });
  } catch (err: any) {
    console.error('Error in suggest-recipes:', err);
    res.status(500).json({ error: err.message || 'Failed to suggest recipes' });
  }
});

// Self-signed certificate for the https port. Kept in the data folder so it stays the same
// across restarts, and re-made when it is about to expire or the addresses change.
async function loadOrCreateCertificate(): Promise<{ key: string; cert: string }> {
  const dir = path.join(DATA_DIR, 'tls');
  const keyFile = path.join(dir, 'key.pem');
  const certFile = path.join(dir, 'cert.pem');
  const hostsFile = path.join(dir, 'hosts.txt');

  const ips = new Set<string>(['127.0.0.1', '::1']);
  const names = new Set<string>(['localhost', os.hostname()]);
  Object.values(os.networkInterfaces()).forEach(list =>
    (list ?? []).forEach(i => { if (!i.internal) ips.add(i.address); })
  );
  // Add the address you type into the browser (the Unraid server's IP or name) here if it is not detected
  (process.env.HTTPS_HOSTNAMES || '').split(',').map(h => h.trim()).filter(Boolean).forEach(h => {
    (net.isIP(h) ? ips : names).add(h);
  });
  const wanted = [...ips, ...names].sort().join(',');

  try {
    if (fs.existsSync(keyFile) && fs.existsSync(certFile) && fs.existsSync(hostsFile) && fs.readFileSync(hostsFile, 'utf-8') === wanted) {
      const cert = fs.readFileSync(certFile, 'utf-8');
      const daysLeft = (new Date(new crypto.X509Certificate(cert).validTo).getTime() - Date.now()) / 86400000;
      if (daysLeft > 30) return { key: fs.readFileSync(keyFile, 'utf-8'), cert };
    }
  } catch (e) {
    // fall through and make a new one
  }

  const altNames = [
    ...[...names].map(value => ({ type: 2 as const, value })),
    ...[...ips].map(ip => ({ type: 7 as const, ip })),
  ];
  const now = new Date();
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'PantryPal' }], {
    keyType: 'ec',
    curve: 'P-256',
    algorithm: 'sha256',
    notBeforeDate: now,
    notAfterDate: new Date(now.getTime() + 365 * 86400000),
    extensions: [{ name: 'subjectAltName', altNames }],
  });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(keyFile, pems.private, { encoding: 'utf-8', mode: 0o600 });
  fs.writeFileSync(certFile, pems.cert, 'utf-8');
  fs.writeFileSync(hostsFile, wanted, 'utf-8');
  return { key: pems.private, cert: pems.cert };
}

// Configure Vite middleware in development or static serving in production
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  http.createServer(app).listen(Number(PORT), () => {
    console.log(`Server running on port ${PORT} (isProd: ${isProd})`);
  });

  // Daily backup and the morning alert
  ensureDailyBackup();
  setInterval(ensureDailyBackup, 30 * 60 * 1000);
  setInterval(() => { runDailyAlert(); }, 60 * 1000);

  if (HTTPS_PORT) {
    try {
      const tls = await loadOrCreateCertificate();
      https.createServer(tls, app).listen(HTTPS_PORT, () => {
        console.log(`Secure (https) server on port ${HTTPS_PORT}. Use this address on phones so the camera works.`);
      });
    } catch (e) {
      console.warn('Could not start the https server (the camera will only work on localhost):', e);
    }
  }
}

startServer();
