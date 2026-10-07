import { InventoryItem } from '../types';
import { canonicalUnit, convertQuantity } from './units';

const nameKey = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ');

export interface MergeResult {
  inventory: InventoryItem[];
  added: number; // brand new rows
  merged: number; // quantities added onto existing rows
}

/**
 * Adds items to the inventory. An item with the same name (ignoring case) and a
 * compatible unit is added onto the existing row instead of creating a second one.
 */
export function mergeIntoInventory(inventory: InventoryItem[], incoming: InventoryItem[]): MergeResult {
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
      result.unshift(item);
      added++;
      continue;
    }

    const existing = result[idx];
    const addedQty = convertQuantity(item.quantity, item.unit, existing.unit) ?? item.quantity;
    const quantity = Number((existing.quantity + addedQty).toFixed(2));
    const totalCost = Number(((existing.totalCost || 0) + (item.totalCost || 0)).toFixed(2));
    // Keep the earlier expiration so the older stock is still flagged in time.
    const dates = [existing.expirationDate, item.expirationDate].filter(Boolean).sort();

    result[idx] = {
      ...existing,
      quantity,
      totalCost,
      unitPrice: quantity > 0 ? Number((totalCost / quantity).toFixed(2)) : existing.unitPrice,
      purchaseDate: [existing.purchaseDate, item.purchaseDate].filter(Boolean).sort().pop() || existing.purchaseDate,
      expirationDate: dates[0] || '',
      barcode: existing.barcode || item.barcode,
    };
    merged++;
  }

  return { inventory: result, added, merged };
}

/** One-time cleanup: standardize units and collapse existing duplicate rows. */
export function normalizeInventory(inventory: InventoryItem[]): MergeResult {
  const seed = inventory;
  // Rebuild from the end so the original ordering (newest first) is preserved.
  return [...seed].reverse().reduce<MergeResult>(
    (acc, item) => {
      const r = mergeIntoInventory(acc.inventory, [item]);
      return { inventory: r.inventory, added: acc.added + r.added, merged: acc.merged + r.merged };
    },
    { inventory: [], added: 0, merged: 0 }
  );
}
