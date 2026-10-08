import { InventoryItem } from '../types';
import { canonicalUnit, convertQuantity } from './units';

const nameKey = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ');

/** Pantry price for an item name (latest purchase), scaled to qty. Undefined when unknown. */
export function estimateCostFromPantry(
  name: string,
  quantity: number | undefined,
  unit: string | undefined,
  inventory: InventoryItem[]
): number | undefined {
  if (!quantity || quantity <= 0) return undefined;
  const key = nameKey(name);
  const match = inventory.find(i => nameKey(i.name) === key);
  const price = match ? match.latestUnitPrice ?? match.unitPrice : 0;
  if (!match || !(price > 0)) return undefined;
  const inPantryUnit = unit ? convertQuantity(quantity, unit, match.unit) : quantity;
  if (inPantryUnit === null) return undefined; // units can't be compared
  return Number((inPantryUnit * price).toFixed(2));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's date in the user's local time, as YYYY-MM-DD. */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** dateStr plus n days, as YYYY-MM-DD (calendar math, so time zones can't shift it). */
export const addDaysISO = (dateStr: string, n: number) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
};

/** Monday of the week containing dateStr. */
export const mondayOfWeekISO = (dateStr: string) => {
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDaysISO(dateStr, dow === 0 ? -6 : 1 - dow);
};

type Batch = { quantity: number; expirationDate: string };

/**
 * The date to show for an item: the soonest batch that has not expired yet.
 * Once that one passes, it falls to the next soonest. If everything has
 * expired, the oldest date is shown so it still gets flagged.
 */
export function effectiveExpiration(batches: Batch[], today: string): string {
  const dates = batches.filter(b => b.quantity > 0 && b.expirationDate).map(b => b.expirationDate).sort();
  if (dates.length === 0) return '';
  return dates.find(d => d >= today) ?? dates[0];
}

/** Keeps the batch list in step with the item's quantity and refreshes its expiration date. */
export function syncItemBatches(item: InventoryItem, today: string): InventoryItem {
  if (!item.batches) return item;

  let batches = item.batches
    .map(b => ({ ...b }))
    .sort((a, b) => (a.expirationDate || '9999').localeCompare(b.expirationDate || '9999'));
  const total = batches.reduce((a, b) => a + b.quantity, 0);
  const rawDiff = item.quantity - total;
  const diff = Math.abs(rawDiff) < 0.01 ? 0 : Number(rawDiff.toFixed(4)); // ignore rounding noise

  if (diff < 0) {
    // Stock was used: take it from the soonest-expiring batches first
    let remaining = -diff;
    for (const b of batches) {
      const take = Math.min(b.quantity, remaining);
      b.quantity = Number((b.quantity - take).toFixed(4));
      remaining = Number((remaining - take).toFixed(4));
      if (remaining <= 0) break;
    }
  } else if (diff > 0) {
    // Stock was added without a date: it joins the latest batch
    if (batches.length === 0) batches = [{ quantity: diff, expirationDate: item.expirationDate }];
    else batches[batches.length - 1].quantity = Number((batches[batches.length - 1].quantity + diff).toFixed(4));
  }

  batches = batches.filter(b => b.quantity > 0);
  const expirationDate = batches.length > 0 ? effectiveExpiration(batches, today) : item.expirationDate;

  const unchanged =
    expirationDate === item.expirationDate &&
    batches.length === item.batches.length &&
    batches.every((b, i) => b.quantity === item.batches![i].quantity && b.expirationDate === item.batches![i].expirationDate);
  return unchanged ? item : { ...item, batches, expirationDate };
}

/** Applies syncItemBatches to the whole list, returning the same array if nothing changed. */
export function syncInventoryBatches(inventory: InventoryItem[], today: string): InventoryItem[] {
  let changed = false;
  const next = inventory.map(item => {
    const synced = syncItemBatches(item, today);
    if (synced !== item) changed = true;
    return synced;
  });
  return changed ? next : inventory;
}

export interface MergeResult {
  inventory: InventoryItem[];
  added: number; // brand new rows
  merged: number; // quantities added onto existing rows
}

/**
 * Adds items to the inventory. An item with exactly the same name (ignoring case
 * and extra spaces) and a compatible unit is added onto the existing row instead
 * of creating a second one. Each purchase keeps its own expiration date.
 */
export function mergeIntoInventory(inventory: InventoryItem[], incoming: InventoryItem[]): MergeResult {
  const today = todayISO();
  let result = [...inventory];
  let added = 0;
  let merged = 0;

  for (const raw of incoming) {
    const item: InventoryItem = { ...raw, unit: canonicalUnit(raw.unit) || raw.unit.trim() || 'count' };
    const key = nameKey(item.name);
    const idx = result.findIndex(
      e => nameKey(e.name) === key && convertQuantity(1, item.unit, e.unit) !== null
    );

    if (idx === -1) {
      result.unshift({
        ...item,
        latestUnitPrice: item.latestUnitPrice ?? (item.unitPrice > 0 ? item.unitPrice : undefined),
      });
      added++;
      continue;
    }

    const existing = result[idx];
    const addedQty = convertQuantity(item.quantity, item.unit, existing.unit) ?? item.quantity;
    const quantity = Number((existing.quantity + addedQty).toFixed(2));
    const totalCost = Number(((existing.totalCost || 0) + (item.totalCost || 0)).toFixed(2));
    const batches: Batch[] = [
      ...(existing.batches ?? [{ quantity: existing.quantity, expirationDate: existing.expirationDate }]),
      { quantity: addedQty, expirationDate: item.expirationDate },
    ];

    result[idx] = syncItemBatches({
      ...existing,
      quantity,
      totalCost,
      unitPrice: quantity > 0 ? Number((totalCost / quantity).toFixed(2)) : existing.unitPrice,
      purchaseDate: [existing.purchaseDate, item.purchaseDate].filter(Boolean).sort().pop() || existing.purchaseDate,
      barcode: existing.barcode || item.barcode,
      latestUnitPrice: item.totalCost > 0 && addedQty > 0
        ? Number((item.totalCost / addedQty).toFixed(2))
        : existing.latestUnitPrice,
      batches,
    }, today);
    merged++;
  }

  return { inventory: result, added, merged };
}

/** One-time cleanup: standardize units and collapse existing duplicate rows. */
export function normalizeInventory(inventory: InventoryItem[]): MergeResult {
  // Rebuild from the end so the original ordering (newest first) is preserved.
  return [...inventory].reverse().reduce<MergeResult>(
    (acc, item) => {
      const r = mergeIntoInventory(acc.inventory, [item]);
      return { inventory: r.inventory, added: acc.added + r.added, merged: acc.merged + r.merged };
    },
    { inventory: [], added: 0, merged: 0 }
  );
}
