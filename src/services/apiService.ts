import { BarcodeLookupResult, InventoryItem, Recipe, ReceiptScanResult } from '../types';
import { MeasureMode, canonicalUnit } from '../utils/units';

export async function scanReceiptApi(imageBase64: string, mimeType: string = 'image/jpeg', measureMode: MeasureMode = 'mass', currency: string = 'USD'): Promise<ReceiptScanResult> {
  const response = await fetch('/api/scan-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType, measureMode, currency }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to scan receipt' }));
    throw new Error(err.error || 'Failed to scan receipt');
  }

  return response.json();
}

export async function lookupBarcodeApi(barcode: string): Promise<BarcodeLookupResult> {
  const response = await fetch('/api/barcode-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to lookup barcode' }));
    throw new Error(err.error || 'Failed to lookup barcode');
  }

  return response.json();
}

export async function suggestRecipesApi(
  inventory: InventoryItem[],
  mealType?: string,
  cuisine?: string,
  preferences?: string,
  existingRecipeNames?: string[],
  measureMode: MeasureMode = 'mass'
): Promise<Recipe[]> {
  const response = await fetch('/api/suggest-recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inventory, mealType, cuisine, preferences, existingRecipeNames, measureMode }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to suggest recipes' }));
    throw new Error(err.error || 'Failed to suggest recipes');
  }

  const data = await response.json();
  const recipes: Recipe[] = data.recipes || [];
  return recipes.map(r => ({
    ...r,
    ingredients: (r.ingredients || []).map(i => ({ ...i, unit: canonicalUnit(i.unit) || i.unit })),
  }));
}
