// Generates src/dark-theme.css: dark-mode overrides for every Tailwind color class used in the app.
// Runs automatically before `npm run dev` and `npm run build`, so new classes are picked up.
// Dark mode is switched on by the `dark` class on <html> (see src/utils/theme.ts).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const theme = fs.readFileSync(path.join(root, 'node_modules/tailwindcss/theme.css'), 'utf-8');

// --color-emerald-950: oklch(...)  ->  palette.emerald[950]
const palette = {};
for (const m of theme.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) {
  (palette[m[1]] ||= {})[m[2]] = m[3].trim();
}

const SURFACE = '#1c1917'; // cards (was white)
const COLORS = ['stone', 'emerald', 'amber', 'red', 'sky', 'orange', 'purple', 'teal', 'blue', 'green', 'yellow', 'rose', 'indigo', 'violet'];
const PREFIXES = ['bg', 'text', 'border', 'ring', 'divide', 'from', 'via', 'to', 'placeholder', 'fill', 'stroke', 'outline', 'decoration', 'accent', 'caret'];
const PROPERTY = {
  bg: 'background-color', text: 'color', border: 'border-color', ring: '--tw-ring-color', divide: 'border-color',
  placeholder: 'color', fill: 'fill', stroke: 'stroke', outline: 'outline-color', decoration: 'text-decoration-color',
  accent: 'accent-color', caret: 'caret-color', from: '--tw-gradient-from', via: '--tw-gradient-via', to: '--tw-gradient-to',
};

const stone = (shade) => palette.stone[shade];

// Neutral greys: each shade maps to a dark-theme equivalent depending on what the class is used for
const STONE_BG = { 50: '#231f1d', 100: stone(800), 200: stone(700), 300: stone(600), 400: stone(500), 500: stone(500), 600: stone(500), 700: stone(600), 800: stone(500), 900: stone(600), 950: stone(950) };
const STONE_TEXT = { 50: stone(800), 100: stone(700), 200: stone(600), 300: stone(600), 400: stone(500), 500: stone(400), 600: stone(300), 700: stone(200), 800: stone(100), 900: stone(50), 950: stone(50) };
const STONE_LINE = { 50: stone(800), 100: stone(800), 200: '#3b3633', 300: stone(600), 400: stone(500), 500: stone(500), 600: stone(400), 700: stone(400), 800: stone(300), 900: stone(300) };

const textLike = new Set(['text', 'placeholder', 'fill', 'stroke', 'decoration', 'caret', 'accent']);
const lineLike = new Set(['border', 'divide', 'ring', 'outline']);

function darkColor(prefix, color, shade) {
  if (color === 'stone') {
    if (prefix === 'placeholder') return stone(500);
    if (textLike.has(prefix)) return STONE_TEXT[shade];
    if (lineLike.has(prefix)) return STONE_LINE[shade];
    return STONE_BG[shade];
  }
  const p = palette[color];
  if (!p) return null;
  const n = Number(shade);
  if (prefix === 'bg' || prefix === 'from' || prefix === 'via' || prefix === 'to') {
    // pale tints become deep tints; strong colors (buttons, badges) stay as they are
    const map = { 50: 950, 100: 900, 200: 800, 300: 700 };
    return map[n] ? p[map[n]] : null;
  }
  if (lineLike.has(prefix)) {
    const map = { 50: 950, 100: 900, 200: 800, 300: 700 };
    return map[n] ? p[map[n]] : null;
  }
  // text / icons: dark colors on a light page become light colors on a dark page
  const map = { 500: 400, 600: 400, 700: 300, 800: 200, 900: 100, 950: 50 };
  return map[n] ? p[map[n]] : null;
}

// Collect every class token used in the app
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) walk(full);
    else if (/\.(tsx?|html)$/.test(f.name)) files.push(full);
  }
})(path.join(root, 'src'));
files.push(path.join(root, 'index.html'));

const colorAlt = ['white', 'black', ...COLORS].join('|');
const tokenRe = new RegExp(
  `(?<![\\w:/\\[-])((?:(?:hover|focus|focus-within|active|disabled|group-hover|sm|md|lg|xl):)*)(${PREFIXES.join('|')})-(${colorAlt})(?:-(\\d{2,3}))?(?:/(\\d{1,3}))?(?![\\w-])`,
  'g'
);

const tokens = new Set();
for (const file of files) {
  const text = fs.readFileSync(file, 'utf-8');
  for (const m of text.matchAll(tokenRe)) tokens.add(m[0]);
}

const BREAKPOINTS = { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem' };
const esc = (s) => s.replace(/([^a-zA-Z0-9_-])/g, '\\$1');

// Exact-class overrides that don't follow the generic rules
const EXACT = {
  'bg-stone-100/60': '#0c0a09', // page background
};

const rules = [];
for (const token of Array.from(tokens).sort()) {
  const m = token.match(new RegExp(`^((?:[a-z-]+:)*)(${PREFIXES.join('|')})-(${colorAlt})(?:-(\\d{2,3}))?(?:/(\\d{1,3}))?$`));
  if (!m) continue;
  const [, variantStr, prefix, color, shade, opacity] = m;
  const variants = variantStr ? variantStr.split(':').filter(Boolean) : [];
  const base = token.slice(variantStr.length);

  let value = null;
  if (EXACT[base]) value = EXACT[base];
  else if (color === 'white') {
    // white surfaces go dark; translucent white highlights on colored areas (<=40%) are left alone
    if (prefix === 'bg' || prefix === 'to' || prefix === 'from' || prefix === 'via') {
      if (!opacity || Number(opacity) >= 70) value = SURFACE;
    } else if (lineLike.has(prefix) && (!opacity || Number(opacity) >= 70)) value = stone(700);
  } else if (color === 'black') {
    continue;
  } else if (shade) {
    value = darkColor(prefix, color, shade);
  }
  if (!value) continue;
  if (opacity && !EXACT[base]) value = `color-mix(in oklab, ${value} ${opacity}%, transparent)`;

  // Build the selector: .dark .hover\:bg-x:hover, group-hover variants, etc.
  let selector = `.dark .${esc(token)}`;
  let media = null;
  for (const v of variants) {
    if (BREAKPOINTS[v]) media = BREAKPOINTS[v];
    else if (v === 'group-hover') selector = `.dark .group:hover .${esc(token)}`;
    else selector += `:${v}`;
  }
  const prop = PROPERTY[prefix];
  const decl = prefix === 'divide' ? `${selector} > :not(:last-child)` : selector;
  const body =
    prefix === 'from' || prefix === 'via' || prefix === 'to'
      ? `${prop}: ${value};`
      : prefix === 'divide'
        ? `${prop}: ${value};`
        : `${prop}: ${value};`;
  const rule = `${decl} { ${body} }`;
  rules.push(media ? `@media (min-width: ${media}) { ${rule} }` : rule);
}

const header = `/* GENERATED by scripts/generate-dark-theme.mjs. Do not edit by hand.
 * Dark-mode overrides for the Tailwind color classes used in src/. Active when <html class="dark">. */
`;
const base = `
html.dark { background-color: #0c0a09; color-scheme: dark; }
html.dark body { background-color: #0c0a09; color: ${stone(200)}; }
.dark ::selection { background-color: ${palette.emerald[700]}; color: #fff; }
.dark input::placeholder, .dark textarea::placeholder { color: ${stone(500)}; }
.dark .shadow-2xs, .dark .shadow-xs, .dark .shadow-md, .dark .shadow-xl, .dark .shadow-2xl { --tw-shadow-color: rgb(0 0 0 / 0.5); }
`;
fs.writeFileSync(path.join(root, 'src/dark-theme.css'), header + base + '\n' + rules.join('\n') + '\n');
console.log(`dark theme: ${rules.length} rules from ${tokens.size} color classes`);
