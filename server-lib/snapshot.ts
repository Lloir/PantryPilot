const LIST_KEYS = [
  'inventory', 'recipes', 'plannedMeals', 'cookedLogs', 'shoppingList', 'purchaseLogs', 'rewards',
  'wasteLogs', 'priceHistory', 'receiptLog', 'activity',
] as const;
const MAX_PANTRY_RECORDS = 10_000;

const isObject = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
const hasStrings = (value: Record<string, any>, keys: string[]) =>
  keys.every(key => typeof value[key] === 'string');
const hasNumbers = (value: Record<string, any>, keys: string[]) =>
  keys.every(key => typeof value[key] === 'number' && Number.isFinite(value[key]));
const isStringArray = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === 'string');
const validIngredients = (value: unknown) =>
  Array.isArray(value) && value.every(ingredient =>
    isObject(ingredient) && hasStrings(ingredient, ['name', 'unit']) &&
    hasNumbers(ingredient, ['quantity'])
  );
const validDeductedItems = (value: unknown) =>
  Array.isArray(value) && value.every(item =>
    isObject(item) && hasStrings(item, ['inventoryItemId', 'itemName', 'unit']) &&
    hasNumbers(item, ['quantityDeducted', 'cost'])
  );

const recordValidators: Record<typeof LIST_KEYS[number], (value: unknown) => boolean> = {
  inventory: value => isObject(value) && hasStrings(value, ['id', 'name', 'category', 'unit']) &&
    hasNumbers(value, ['quantity', 'unitPrice', 'totalCost']) &&
    (value.batches === undefined || (Array.isArray(value.batches) && value.batches.every(batch =>
      isObject(batch) && hasStrings(batch, ['expirationDate']) && hasNumbers(batch, ['quantity'])
    ))) &&
    (value.allergens === undefined || isStringArray(value.allergens)),
  recipes: value => isObject(value) && hasStrings(value, ['id', 'name']) &&
    hasNumbers(value, ['servings']) && validIngredients(value.ingredients) &&
    isStringArray(value.instructions) && isStringArray(value.tags),
  plannedMeals: value => isObject(value) && hasStrings(value, ['id', 'date', 'slot']) &&
    hasNumbers(value, ['servings']) && validIngredients(value.ingredients),
  cookedLogs: value => isObject(value) && hasStrings(value, ['id', 'recipeName']) &&
    hasNumbers(value, ['servingsCooked', 'totalMealCost', 'costPerServing']) && validDeductedItems(value.deductedItems),
  shoppingList: value => isObject(value) && hasStrings(value, ['id', 'name']) &&
    hasStrings(value, ['category']) && typeof value.checked === 'boolean' &&
    (value.quantity === undefined || (typeof value.quantity === 'number' && Number.isFinite(value.quantity))),
  purchaseLogs: value => isObject(value) && hasStrings(value, ['id', 'date']) &&
    hasNumbers(value, ['total']) && isObject(value.categoryTotals) &&
    Object.values(value.categoryTotals).every(total => typeof total === 'number' && Number.isFinite(total)),
  rewards: value => isObject(value) && hasStrings(value, ['id', 'date', 'source']) && hasNumbers(value, ['points']),
  wasteLogs: value => isObject(value) && hasStrings(value, ['id', 'date', 'itemName', 'category', 'unit']) &&
    hasNumbers(value, ['quantity', 'cost']),
  priceHistory: value => isObject(value) && hasStrings(value, ['id', 'date', 'key', 'name', 'unit']) &&
    hasNumbers(value, ['unitPrice']),
  receiptLog: value => isObject(value) && hasStrings(value, ['id', 'key', 'date', 'store']) &&
    hasNumbers(value, ['total', 'itemCount']),
  activity: value => isObject(value) && hasStrings(value, ['id', 'at', 'user', 'text']),
};

export function isValidSnapshot(snap: unknown): boolean {
  if (!isObject(snap) || snap.app !== 'pantrypal' || !isObject(snap.pantry)) return false;
  const version = snap.version === undefined ? 1 : snap.version;
  if (version !== 1 && version !== 2) return false;
  const pantry = snap.pantry;
  if (!LIST_KEYS.every(key =>
    (version === 1 && pantry[key] === undefined) ||
    (Array.isArray(pantry[key]) && pantry[key].every(record => recordValidators[key](record)))
  )) return false;
  if (pantry.settings !== undefined && pantry.settings !== null && !isObject(pantry.settings)) return false;
  if (snap.requests !== undefined && (!Array.isArray(snap.requests) || !snap.requests.every(request =>
    isObject(request) && hasStrings(request, ['id', 'type', 'text', 'requestedBy', 'createdAt', 'status']) &&
    (request.comments === undefined || (Array.isArray(request.comments) && request.comments.every(comment =>
      isObject(comment) && hasStrings(comment, ['id', 'by', 'at', 'text'])
    )))
  ))) return false;
  if (snap.barcodes !== undefined && !isObject(snap.barcodes)) return false;
  return true;
}

export function isValidPantryWrite(body: unknown): boolean {
  if (!isObject(body) || !Number.isSafeInteger(body.baseRevision) || body.baseRevision < 0) return false;
  if (LIST_KEYS.some(key => Array.isArray(body[key]) && body[key].length > MAX_PANTRY_RECORDS)) return false;
  return isValidSnapshot({ app: 'pantrypal', version: 1, pantry: body });
}

export function summarizeSnapshot(
  snapshot: any,
  current: any,
  extras: { requests?: unknown[]; barcodes?: Record<string, unknown> } = {}
): Record<string, { incoming: number | null; current: number }> {
  const counts: Record<string, { incoming: number | null; current: number }> = Object.fromEntries(LIST_KEYS.map(key => [
    key,
    {
      incoming: Array.isArray(snapshot.pantry[key]) ? snapshot.pantry[key].length : null,
      current: Array.isArray(current?.[key]) ? current[key].length : 0,
    },
  ]));
  return {
    ...counts,
    settings: { incoming: snapshot.pantry.settings === undefined ? null : Number(snapshot.pantry.settings !== null), current: Number(current?.settings != null) },
    requests: { incoming: Array.isArray(snapshot.requests) ? snapshot.requests.length : null, current: extras.requests?.length ?? 0 },
    barcodes: { incoming: isObject(snapshot.barcodes) ? Object.keys(snapshot.barcodes).length : null, current: Object.keys(extras.barcodes ?? {}).length },
  };
}
