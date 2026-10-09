// Spreadsheet-friendly exports. Cells starting with = + - @ are prefixed so a spreadsheet never runs them as formulas.

export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function inventoryCsv(items: any[]): string {
  return toCsv(
    ['Name', 'Category', 'Quantity', 'Unit', 'Unit price', 'Total cost', 'Purchased', 'Expires', 'Location', 'Minimum to keep', 'Barcode', 'Notes'],
    items.map(i => [i.name, i.category, i.quantity, i.unit, i.unitPrice, i.totalCost, i.purchaseDate, i.expirationDate, i.location, i.parLevel ?? '', i.barcode ?? '', i.notes ?? ''])
  );
}
