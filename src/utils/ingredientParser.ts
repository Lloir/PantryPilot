import { canonicalUnit } from './units';

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8', '⅕': '1/5',
};

function parseNumber(raw: string): number | null {
  let s = raw.trim();
  for (const [u, f] of Object.entries(UNICODE_FRACTIONS)) s = s.split(u).join(` ${f}`);
  s = s.trim().replace(/\s+/g, ' ');
  // "1 1/2", "1/2", "2", "2.5", and ranges like "2-3" / "2 to 3" (the first number)
  const range = s.match(/^(\d+\/\d+|\d+(?:\.\d+)?(?: \d+\/\d+)?)\s*(?:-|–|to)\s*\d/);
  const first = range ? range[1] : s.match(/^(\d+\/\d+|\d+(?:\.\d+)?(?: \d+\/\d+)?)/)?.[1];
  if (!first) return null;
  const parts = first.split(' ');
  let total = 0;
  for (const p of parts) {
    if (p.includes('/')) {
      const [a, b] = p.split('/').map(Number);
      if (!b) return null;
      total += a / b;
    } else {
      total += Number(p);
    }
  }
  return Number.isFinite(total) && total > 0 ? Number(total.toFixed(3)) : null;
}

export interface ParsedIngredient {
  name: string;
  quantity: number;
  unit: string;
}

/** "1 1/2 cups all-purpose flour, sifted" -> { quantity: 1.5, unit: 'cup', name: 'all-purpose flour' } */
export function parseIngredientLine(line: string): ParsedIngredient {
  let text = line.replace(/\s+/g, ' ').trim();
  // drop notes in brackets and anything after a comma ("chopped", "to taste")
  text = text.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const comma = text.indexOf(',');
  if (comma > 2) text = text.slice(0, comma).trim();

  const qtyMatch = text.match(/^((?:\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|[½¼¾⅓⅔⅛⅜⅝⅞⅕])(?:\s*[½¼¾⅓⅔⅛⅜⅝⅞⅕])?(?:\s*(?:-|–|to)\s*\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)?)\s*(.*)$/);
  if (!qtyMatch) {
    // "a pinch of salt", "salt to taste"
    const cleaned = text.replace(/^(a|an|some)\s+(pinch|dash|handful|splash)\s+of\s+/i, '').replace(/\s+to taste$/i, '').trim();
    return { name: cleaned || text, quantity: 1, unit: 'count' };
  }
  const quantity = parseNumber(qtyMatch[1]) ?? 1;
  let rest = qtyMatch[2].replace(/^of\s+/i, '').trim();

  // the next word (or two, for "fl oz") might be a unit
  const words = rest.split(' ');
  let unit = 'count';
  for (const take of [2, 1]) {
    const candidate = words.slice(0, take).join(' ').replace(/[.,]$/, '');
    const canon = candidate ? canonicalUnit(candidate) : null;
    if (canon && canon !== 'count') {
      unit = canon;
      rest = words.slice(take).join(' ').replace(/^of\s+/i, '').trim();
      break;
    }
  }
  return { name: rest || text, quantity, unit };
}
