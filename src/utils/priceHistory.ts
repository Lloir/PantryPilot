import { InventoryItem, PricePoint } from '../types';
import { convertQuantity } from './units';

export const priceKey = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ');

/** Price points for items that were just bought (skips anything without a real price). */
export function pricePointsFor(
  items: Pick<InventoryItem, 'name' | 'quantity' | 'unit' | 'totalCost' | 'purchaseDate'>[],
  store?: string
): Omit<PricePoint, 'id'>[] {
  return items
    .filter(i => i.totalCost > 0 && i.quantity > 0)
    .map(i => ({
      date: i.purchaseDate,
      key: priceKey(i.name),
      name: i.name,
      unit: i.unit,
      unitPrice: Number((i.totalCost / i.quantity).toFixed(4)),
      store: store?.trim() || undefined,
    }));
}

export interface PriceSummary {
  points: { date: string; price: number; store?: string }[]; // newest first, all in `unit`
  latest?: number;
  average?: number;
  changePct?: number; // latest vs the average of earlier purchases
  cheapest?: { store: string; price: number };
}

/** Price history for one item, expressed per `unit` so different pack sizes compare fairly. */
export function summarizePrices(history: PricePoint[], name: string, unit: string): PriceSummary {
  const key = priceKey(name);
  const points = history
    .filter(p => p.key === key)
    .map(p => {
      const factor = convertQuantity(1, p.unit, unit); // 1 of the old unit = factor of the new one
      return factor && factor > 0 ? { date: p.date, price: p.unitPrice / factor, store: p.store } : null;
    })
    .filter((p): p is { date: string; price: number; store: string | undefined } => p !== null)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (points.length === 0) return { points };
  const latest = points[0].price;
  const earlier = points.slice(1);
  const average = points.reduce((a, p) => a + p.price, 0) / points.length;
  const changePct = earlier.length > 0
    ? ((latest - earlier.reduce((a, p) => a + p.price, 0) / earlier.length) / (earlier.reduce((a, p) => a + p.price, 0) / earlier.length)) * 100
    : undefined;

  const byStore = new Map<string, number[]>();
  points.forEach(p => p.store && byStore.set(p.store, [...(byStore.get(p.store) ?? []), p.price]));
  let cheapest: PriceSummary['cheapest'];
  byStore.forEach((prices, store) => {
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    if (!cheapest || avg < cheapest.price) cheapest = { store, price: avg };
  });
  if (byStore.size < 2) cheapest = undefined; // "cheapest" only means something when stores can be compared

  return { points, latest, average, changePct, cheapest };
}
