// Builds an iCalendar (.ics) feed of the meal plan, so phones and calendars can subscribe to it.

export interface PlannedMealLike {
  id: string;
  date: string; // YYYY-MM-DD
  slot: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  customName?: string;
  servings?: number;
  batchServings?: number;
  isLeftover?: boolean;
}

// start time and length (minutes) of each slot in the calendar
const SLOT_TIMES: Record<string, { start: [number, number]; minutes: number }> = {
  Breakfast: { start: [8, 0], minutes: 45 },
  Lunch: { start: [12, 0], minutes: 45 },
  Dinner: { start: [18, 0], minutes: 60 },
  Snack: { start: [15, 30], minutes: 15 },
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Escapes text per RFC 5545. */
export const icsEscape = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Folds a content line to 75 octets, continuing with a leading space. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch, 'utf-8');
    if (bytes + size > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

function stamp(date: string, h: number, m: number, addMinutes = 0): string {
  const [y, mo, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, m + addMinutes));
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00`;
}

export function buildIcs(meals: PlannedMealLike[], now: Date = new Date()): string {
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PantryPal//Meal Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:PantryPal Meal Plan',
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];

  for (const meal of meals) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meal.date)) continue;
    const t = SLOT_TIMES[meal.slot] ?? SLOT_TIMES.Dinner;
    const name = meal.customName || 'Meal';
    const title = meal.isLeftover ? `Leftovers: ${name}` : meal.batchServings ? `Cook batch: ${name}` : name;
    const details = [
      `${meal.slot}`,
      meal.batchServings ? `Cook ${meal.batchServings} servings` : meal.servings ? `${meal.servings} serving${meal.servings === 1 ? '' : 's'}` : '',
    ].filter(Boolean).join(' · ');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${meal.id}@pantrypal`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${stamp(meal.date, t.start[0], t.start[1])}`,
      `DTEND:${stamp(meal.date, t.start[0], t.start[1], t.minutes)}`,
      `SUMMARY:${icsEscape(title)}`,
      `DESCRIPTION:${icsEscape(details)}`,
      `CATEGORIES:${icsEscape(meal.slot)}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
