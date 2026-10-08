export type ItemCategory =
  | 'Produce'
  | 'Dairy & Eggs'
  | 'Meat & Seafood'
  | 'Pantry & Grains'
  | 'Canned & Jarred'
  | 'Frozen'
  | 'Bakery'
  | 'Beverages'
  | 'Spices & Condiments'
  | 'Snacks'
  | 'Other';

export type StorageLocation = 'Fridge' | 'Freezer' | 'Pantry' | 'Counter' | 'Spice Rack';

export interface InventoryItem {
  id: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  unit: string; // e.g. 'count', 'oz', 'lb', 'g', 'kg', 'ml', 'cup', 'can', 'pack'
  unitPrice: number; // cost per unit in USD
  totalCost: number; // total price paid
  purchaseDate: string; // YYYY-MM-DD
  expirationDate: string; // YYYY-MM-DD
  location: StorageLocation;
  barcode?: string;
  notes?: string;
  isExpiringSoon?: boolean; // computed or flag
  isAbundant?: boolean;
  // Stock that was bought at different times. expirationDate always follows the
  // soonest batch that has not expired yet.
  batches?: { quantity: number; expirationDate: string }[];
  latestUnitPrice?: number; // price per unit on the most recent purchase
}

export interface RecipeIngredient {
  name: string; // e.g., "Chicken Breast"
  matchedInventoryId?: string; // ID if matched
  quantity: number;
  unit: string;
  estimatedCost?: number;
  optional?: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Dessert';
  cuisine: string; // e.g., "Italian", "Mexican", "Asian", "American", "Mediterranean"
  servings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  tags: string[];
  imageUrl?: string;
  isAiGenerated?: boolean;
}

export interface CookedMealLog {
  id: string;
  recipeId?: string;
  recipeName: string;
  cookedAt: string; // ISO string
  servingsCooked: number;
  totalMealCost: number;
  costPerServing: number;
  deductedItems: {
    inventoryItemId: string;
    itemName: string;
    quantityDeducted: number;
    unit: string;
    cost: number;
  }[];
  notes?: string;
}

export interface PlannedMeal {
  id: string;
  date: string; // YYYY-MM-DD
  slot: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  recipeId?: string;
  customName?: string;
  servings: number; // servings eaten in this slot
  ingredients: RecipeIngredient[];
  // Meal prep: one cook session fills several days.
  batchServings?: number; // on the cook entry: total servings produced
  prepGroupId?: string; // shared by the cook entry and its leftovers
  isLeftover?: boolean; // leftover slot: eating it deducts nothing
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: ItemCategory;
  quantity?: number; // optional for hand-typed items
  unit?: string;
  estimatedCost?: number; // undefined = no price known
  checked: boolean;
  notes?: string;
  reason?: string; // e.g. "Needed for Chicken Stir Fry on Wed"
  plannedDate?: string;
}

export interface ReceiptParsedItem {
  name: string;
  category: ItemCategory;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  estimatedShelfLifeDays: number;
  barcode?: string;
  selected?: boolean;
}

export interface ReceiptScanResult {
  storeName: string;
  purchaseDate: string;
  subtotal: number;
  tax: number;
  total: number;
  rewardsPoints?: number; // points earned, if printed on the receipt
  items: ReceiptParsedItem[];
  confidenceScore?: number;
}

export interface BarcodeLookupResult {
  barcode: string;
  name: string;
  brand?: string;
  category: ItemCategory;
  averagePrice: number;
  standardQuantity: number;
  standardUnit: string;
  estimatedShelfLifeDays: number;
  storageLocation: StorageLocation;
  foundInDatabase: boolean;
  confidence?: string;
}

export interface PurchaseLog {
  id: string;
  date: string; // YYYY-MM-DD
  total: number;
  categoryTotals: Partial<Record<ItemCategory, number>>;
  source: 'receipt' | 'manual' | 'barcode' | 'shopping-list' | 'history';
  store?: string;
}

export interface RewardsEntry {
  id: string;
  date: string; // YYYY-MM-DD
  points: number; // positive = earned, negative = redeemed
  store?: string;
  note?: string;
  source: 'receipt' | 'manual';
}

export interface AppSettings {
  measureMode: 'mass' | 'volume';
  currency: string; // ISO code used to display money, e.g. USD, GBP, CAD
  hiddenTags: string[]; // suggested tags the user removed from the tag bar
  migratedV4?: boolean; // one-time unit standardization / duplicate merge / purchase history seed
}

export const DEFAULT_SETTINGS: AppSettings = { measureMode: 'mass', currency: 'USD', hiddenTags: [] };
