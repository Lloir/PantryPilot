import { BarcodeLookupResult, HouseholdRequest, HouseholdUser, InventoryItem, Recipe, ReceiptScanResult, RequestType, Role } from '../types';
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

// --- Household: people and requests -----------------------------------------
async function jsonOrThrow<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: fallback }));
    throw new Error(err.error || fallback);
  }
  return response.json();
}

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export async function fetchUsersApi(): Promise<HouseholdUser[]> {
  const data = await jsonOrThrow<{ users: HouseholdUser[] }>(await fetch('/api/users'), 'Could not load people');
  return data.users;
}

export async function addUserApi(username: string, password: string, role: Role): Promise<HouseholdUser[]> {
  const data = await jsonOrThrow<{ users: HouseholdUser[] }>(
    await fetch('/api/users', jsonInit('POST', { username, password, role })), 'Could not add person');
  return data.users;
}

export async function updateUserApi(username: string, changes: { role?: Role; password?: string }): Promise<HouseholdUser[]> {
  const data = await jsonOrThrow<{ users: HouseholdUser[] }>(
    await fetch(`/api/users/${encodeURIComponent(username)}`, jsonInit('PATCH', changes)), 'Could not update person');
  return data.users;
}

export async function removeUserApi(username: string): Promise<HouseholdUser[]> {
  const data = await jsonOrThrow<{ users: HouseholdUser[] }>(
    await fetch(`/api/users/${encodeURIComponent(username)}`, jsonInit('DELETE')), 'Could not remove person');
  return data.users;
}

export async function changeMyPasswordApi(currentPassword: string, newPassword: string): Promise<void> {
  await jsonOrThrow(await fetch('/api/me/password', jsonInit('POST', { currentPassword, newPassword })), 'Could not change password');
}

export async function fetchRequestsApi(): Promise<HouseholdRequest[]> {
  const data = await jsonOrThrow<{ requests: HouseholdRequest[] }>(await fetch('/api/requests'), 'Could not load requests');
  return data.requests;
}

export async function createRequestApi(request: {
  type: RequestType; text: string; quantity?: number; unit?: string; date?: string; slot?: string;
}): Promise<HouseholdRequest[]> {
  const data = await jsonOrThrow<{ requests: HouseholdRequest[] }>(
    await fetch('/api/requests', jsonInit('POST', request)), 'Could not send request');
  return data.requests;
}

export async function answerRequestApi(id: string, status: 'open' | 'done' | 'declined', note?: string): Promise<HouseholdRequest[]> {
  const data = await jsonOrThrow<{ requests: HouseholdRequest[] }>(
    await fetch(`/api/requests/${encodeURIComponent(id)}`, jsonInit('PATCH', { status, note })), 'Could not update request');
  return data.requests;
}

export async function deleteRequestApi(id: string): Promise<HouseholdRequest[]> {
  const data = await jsonOrThrow<{ requests: HouseholdRequest[] }>(
    await fetch(`/api/requests/${encodeURIComponent(id)}`, jsonInit('DELETE')), 'Could not remove request');
  return data.requests;
}

/** Remember a barcode's details (as corrected by the household) so the next scan is right. */
export async function saveBarcodeApi(details: {
  barcode: string; name: string; category: string; averagePrice: number; standardQuantity: number;
  standardUnit: string; estimatedShelfLifeDays: number; storageLocation: string;
}): Promise<void> {
  await fetch('/api/barcode-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(details),
  });
}
