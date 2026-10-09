// Builds the daily "what needs attention" message (expiring food, low staples, today's meals).

export interface DigestInput {
  inventory: any[];
  plannedMeals: any[];
  today: string; // YYYY-MM-DD
  daysAhead: number;
}

const dayDiff = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000);

export function buildDigest({ inventory, plannedMeals, today, daysAhead }: DigestInput): { title: string; lines: string[] } | null {
  const lines: string[] = [];

  const expired: string[] = [];
  const soon: string[] = [];
  for (const item of inventory) {
    if (!item.expirationDate || !(item.quantity > 0)) continue;
    const d = dayDiff(today, item.expirationDate);
    if (d < 0) expired.push(`${item.name} (expired ${-d}d ago)`);
    else if (d <= daysAhead) soon.push(`${item.name} (${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`})`);
  }
  if (expired.length) lines.push(`Expired: ${expired.join(', ')}`);
  if (soon.length) lines.push(`Use soon: ${soon.join(', ')}`);

  const low = inventory
    .filter(i => typeof i.parLevel === 'number' && i.parLevel > 0 && i.quantity < i.parLevel)
    .map(i => `${i.name} (${Number(i.quantity.toFixed(2))} of ${i.parLevel} ${i.unit})`);
  if (low.length) lines.push(`Running low: ${low.join(', ')}`);

  const meals = plannedMeals.filter(m => m.date === today && !m.isLeftover).map(m => `${m.slot}: ${m.customName}`);
  const leftovers = plannedMeals.filter(m => m.date === today && m.isLeftover).map(m => `${m.slot}: leftover ${m.customName}`);
  if (meals.length || leftovers.length) lines.push(`Today: ${[...meals, ...leftovers].join(', ')}`);

  if (lines.length === 0) return null;
  return { title: 'PantryPal: today', lines };
}
