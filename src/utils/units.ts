// Single source of truth for units. Every unit the app stores is one of the
// canonical values below, so "oz", "Ounce" and "ounces" all become "oz".
//
// The app runs in one measurement mode at a time ("mass" or "volume"). Mass and
// volume are never converted into each other (that needs a per-food density).

export type MeasureMode = 'mass' | 'volume';
export type UnitKind = 'mass' | 'volume' | 'count';

interface UnitDef {
  value: string;
  label: string;
  kind: UnitKind;
  /** Multiplier to the base unit of its kind (g for mass, ml for volume). Count units are 1. */
  factor: number;
  aliases: string[];
}

const UNIT_DEFS: UnitDef[] = [
  { value: 'g', label: 'g (gram)', kind: 'mass', factor: 1, aliases: ['gram', 'grams', 'gr', 'gm'] },
  { value: 'kg', label: 'kg (kilogram)', kind: 'mass', factor: 1000, aliases: ['kilogram', 'kilograms', 'kilo', 'kilos'] },
  { value: 'oz', label: 'oz (ounce)', kind: 'mass', factor: 28.3495, aliases: ['ounce', 'ounces', 'ozs'] },
  { value: 'lb', label: 'lb (pound)', kind: 'mass', factor: 453.592, aliases: ['lbs', 'pound', 'pounds', '#'] },

  { value: 'ml', label: 'ml (milliliter)', kind: 'volume', factor: 1, aliases: ['milliliter', 'milliliters', 'millilitre', 'millilitres', 'cc'] },
  { value: 'l', label: 'l (liter)', kind: 'volume', factor: 1000, aliases: ['liter', 'liters', 'litre', 'litres', 'ltr'] },
  { value: 'fl oz', label: 'fl oz (fluid ounce)', kind: 'volume', factor: 29.5735, aliases: ['floz', 'fl. oz', 'fl.oz', 'fluid ounce', 'fluid ounces', 'fl ounce', 'fl ounces'] },
  { value: 'tsp', label: 'tsp (teaspoon)', kind: 'volume', factor: 4.92892, aliases: ['teaspoon', 'teaspoons', 'tsps'] },
  { value: 'tbsp', label: 'tbsp (tablespoon)', kind: 'volume', factor: 14.7868, aliases: ['tablespoon', 'tablespoons', 'tbsps', 'tbs'] },
  { value: 'cup', label: 'cup', kind: 'volume', factor: 236.588, aliases: ['cups', 'c'] },
  { value: 'pt', label: 'pt (pint)', kind: 'volume', factor: 473.176, aliases: ['pint', 'pints'] },
  { value: 'qt', label: 'qt (quart)', kind: 'volume', factor: 946.353, aliases: ['quart', 'quarts'] },
  { value: 'gal', label: 'gal (gallon)', kind: 'volume', factor: 3785.41, aliases: ['gallon', 'gallons'] },

  { value: 'count', label: 'count / each', kind: 'count', factor: 1, aliases: ['item', 'items', 'each', 'ea', 'piece', 'pieces', 'pc', 'pcs', 'unit', 'units', 'whole', 'ct'] },
  { value: 'can', label: 'can', kind: 'count', factor: 1, aliases: ['cans', 'tin', 'tins'] },
  { value: 'pack', label: 'pack', kind: 'count', factor: 1, aliases: ['packs', 'package', 'packages', 'pkg', 'packet', 'packets'] },
  { value: 'bottle', label: 'bottle', kind: 'count', factor: 1, aliases: ['bottles', 'btl'] },
  { value: 'bag', label: 'bag', kind: 'count', factor: 1, aliases: ['bags'] },
  { value: 'box', label: 'box', kind: 'count', factor: 1, aliases: ['boxes'] },
  { value: 'jar', label: 'jar', kind: 'count', factor: 1, aliases: ['jars'] },
  { value: 'dozen', label: 'dozen', kind: 'count', factor: 1, aliases: ['doz', 'dozens'] },
  { value: 'bunch', label: 'bunch', kind: 'count', factor: 1, aliases: ['bunches'] },
  { value: 'clove', label: 'clove', kind: 'count', factor: 1, aliases: ['cloves'] },
  { value: 'slice', label: 'slice', kind: 'count', factor: 1, aliases: ['slices'] },
];

const BY_VALUE = new Map(UNIT_DEFS.map(u => [u.value, u]));
const BY_ALIAS = new Map<string, UnitDef>();
UNIT_DEFS.forEach(u => {
  BY_ALIAS.set(u.value, u);
  u.aliases.forEach(a => BY_ALIAS.set(a, u));
});

function clean(raw: string): string {
  return (raw || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Maps any spelling ("Ounce", "OZ.", "lbs") to its canonical unit, or null if unknown. */
export function canonicalUnit(raw: string): string | null {
  const key = clean(raw);
  const def = BY_ALIAS.get(key) || BY_ALIAS.get(key.replace(/\.$/, ''));
  return def ? def.value : null;
}

/** Like canonicalUnit but unknown units fall back to 'count' (used when ingesting free text). */
export function normalizeUnit(raw: string): string {
  return canonicalUnit(raw) || 'count';
}

export function unitKind(raw: string): UnitKind | null {
  const c = canonicalUnit(raw);
  return c ? BY_VALUE.get(c)!.kind : null;
}

/** Units offered in dropdowns for the given mode: that mode's units plus the count-style units. */
export function unitOptions(mode: MeasureMode, current?: string): { value: string; label: string }[] {
  const opts = UNIT_DEFS.filter(u => u.kind === 'count' || u.kind === mode);
  const currentCanon = current ? canonicalUnit(current) : null;
  if (currentCanon && !opts.some(o => o.value === currentCanon)) {
    // Keep an existing value (e.g. a volume item after switching to mass mode) selectable.
    const def = BY_VALUE.get(currentCanon)!;
    return [...opts, { value: def.value, label: `${def.label} (other mode)` }];
  }
  return opts.map(({ value, label }) => ({ value, label }));
}

export function unitSupportedInMode(raw: string, mode: MeasureMode): boolean {
  const kind = unitKind(raw);
  return kind === 'count' || kind === mode;
}

/**
 * Converts between units of the same kind (mass↔mass, volume↔volume, count↔count).
 * Returns null when the units cannot be converted (including mass↔volume).
 */
export function convertQuantity(quantity: number, fromUnit: string, toUnit: string): number | null {
  const f = canonicalUnit(fromUnit);
  const t = canonicalUnit(toUnit);
  if (!f || !t) return clean(fromUnit) === clean(toUnit) ? quantity : null;
  if (f === t) return quantity;
  const fd = BY_VALUE.get(f)!;
  const td = BY_VALUE.get(t)!;
  if (fd.kind !== td.kind) return null;
  if (fd.kind === 'count') return quantity; // can/pack/count are treated as interchangeable
  return (quantity * fd.factor) / td.factor;
}

export function canMergeUnits(a: string, b: string): boolean {
  return convertQuantity(1, a, b) !== null;
}
