import dns from 'node:dns/promises';
import dnsCb from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

// Pulls a recipe out of a web page. Most recipe sites include it as schema.org "Recipe" JSON-LD.

export interface ExtractedRecipe {
  name: string;
  description: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: string[]; // raw lines, e.g. "1 1/2 cups flour"
  instructions: string[];
  cuisine: string;
  category: string;
  keywords: string[];
  sourceUrl?: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', frac12: '1/2', frac14: '1/4', frac34: '3/4' };
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z0-9]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const text = (v: unknown): string => decodeEntities(String(v ?? '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** "PT1H30M" -> 90 */
export function isoDurationToMinutes(v: unknown): number | null {
  const m = String(v ?? '').match(/^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!m) return null;
  const mins = Number(m[1] || 0) * 60 + Number(m[2] || 0) + Math.round(Number(m[3] || 0) / 60);
  return mins > 0 ? mins : null;
}

function firstNumber(v: unknown): number | null {
  const first = Array.isArray(v) ? v[0] : v;
  const m = String(first ?? '').match(/\d+(\.\d+)?/);
  return m ? Math.round(Number(m[0])) : null;
}

function steps(node: any): string[] {
  if (!node) return [];
  if (typeof node === 'string') {
    // a single string with line breaks, or numbered steps
    return node.split(/\r?\n+|<br\s*\/?>/i).map(text).filter(Boolean);
  }
  if (Array.isArray(node)) return node.flatMap(steps);
  if (typeof node === 'object') {
    if (node.itemListElement) return steps(node.itemListElement);
    if (node.text || node.name) return [text(node.text || node.name)].filter(Boolean);
  }
  return [];
}

const asList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []).map(text).filter(Boolean);

function findRecipeNode(node: any): any | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipeNode(n);
      if (r) return r;
    }
    return null;
  }
  const t = node['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return node;
  if (node['@graph']) return findRecipeNode(node['@graph']);
  return null;
}

export function extractRecipeFromHtml(html: string): ExtractedRecipe | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    let data: any;
    try {
      data = JSON.parse(b[1].trim());
    } catch {
      continue;
    }
    const r = findRecipeNode(data);
    if (!r) continue;

    const ingredients = asList(r.recipeIngredient ?? r.ingredients);
    const instructions = steps(r.recipeInstructions);
    const name = text(r.name);
    if (!name || ingredients.length === 0) continue;

    const total = isoDurationToMinutes(r.totalTime);
    let prep = isoDurationToMinutes(r.prepTime);
    let cook = isoDurationToMinutes(r.cookTime);
    if (prep === null && cook === null && total !== null) cook = total;

    return {
      name,
      description: text(r.description).slice(0, 400),
      servings: firstNumber(r.recipeYield),
      prepMinutes: prep,
      cookMinutes: cook,
      ingredients,
      instructions,
      cuisine: asList(r.recipeCuisine)[0] ?? '',
      category: asList(r.recipeCategory)[0] ?? '',
      keywords: asList(r.keywords).slice(0, 8),
    };
  }
  return null;
}

// --- Safe fetching: only public web addresses, never the home network or the server itself ---

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT / Tailscale
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::1' || l === '::') return true;
    if (l.startsWith('fe8') || l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb')) return true; // link-local
    if (l.startsWith('fc') || l.startsWith('fd')) return true; // unique local
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true;
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('That does not look like a web address');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http and https links are supported');
  if (url.username || url.password) throw new Error('Links with a username or password are not supported');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map(a => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error('That address is on a private network, so it was not opened');
  }
  return url;
}

interface RawResponse {
  status: number;
  location?: string;
  body: Buffer;
}

// One GET request whose DNS lookup refuses private addresses at connection time,
// so a hostname that later points inside the home network (DNS rebinding) is also refused.
function safeGet(url: URL): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      {
        method: 'GET',
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PantryPal/1.0; recipe import)', Accept: 'text/html,application/xhtml+xml' },
        lookup: (hostname: string, opts: any, cb: any) => {
          dnsCb.lookup(hostname, { ...opts, all: true }, (err: Error | null, addrs: { address: string; family: number }[]) => {
            if (err) return cb(err);
            const allowed = addrs.filter(a => !isPrivateAddress(a.address));
            if (allowed.length === 0) return cb(new Error('That address is on a private network, so it was not opened'));
            if (opts?.all) cb(null, allowed);
            else cb(null, allowed[0].address, allowed[0].family);
          });
        },
      } as any,
      res => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size <= 2_000_000) chunks.push(c);
          else res.destroy(); // recipe data is near the top of the page; use what we have
        });
        const finish = () => resolve({ status: res.statusCode ?? 0, location: res.headers.location, body: Buffer.concat(chunks) });
        res.on('end', finish);
        res.on('close', finish);
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new Error('The site took too long to answer')));
    req.on('error', reject);
    req.end();
  });
}

/** Downloads a page (max ~2 MB, 8 s, up to 3 redirects, each one re-checked). */
export async function fetchPublicHtml(raw: string): Promise<{ html: string; url: string }> {
  let current = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await safeGet(current);
    if (res.status >= 300 && res.status < 400 && res.location) {
      current = await assertPublicUrl(new URL(res.location, current).toString());
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`The site answered with an error (${res.status})`);
    return { html: res.body.toString('utf-8'), url: current.toString() };
  }
  throw new Error('Too many redirects');
}

/** Plain readable text of a page, for the AI fallback. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}
