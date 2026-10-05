import { InventoryItem, Recipe, PlannedMeal, CookedMealLog, BarcodeLookupResult, ReceiptScanResult } from '../types';

// Clean initial data - completely empty for user production usage
export const INITIAL_INVENTORY: InventoryItem[] = [];

export const INITIAL_RECIPES: Recipe[] = [];

export const INITIAL_PLANNED_MEALS: PlannedMeal[] = [];

export const INITIAL_COOKED_LOGS: CookedMealLog[] = [];

export const SAMPLE_RECEIPTS: { id: string; name: string; store: string; date: string; itemsCount: number; data: ReceiptScanResult }[] = [];

// Standard reference barcode catalog for product recognition
export const COMMON_BARCODES_DATABASE: Record<string, BarcodeLookupResult> = {
  '076808500138': {
    barcode: '076808500138',
    name: 'Barilla Penne Rigate Pasta',
    brand: 'Barilla',
    category: 'Pantry & Grains',
    averagePrice: 1.99,
    standardQuantity: 16,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 730,
    storageLocation: 'Pantry',
    foundInDatabase: true,
    confidence: 'Verified'
  },
  '071430009214': {
    barcode: '071430009214',
    name: 'Fresh Organic Baby Spinach Clamshell',
    brand: 'Earthbound Farm',
    category: 'Produce',
    averagePrice: 3.99,
    standardQuantity: 16,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 6,
    storageLocation: 'Fridge',
    foundInDatabase: true,
    confidence: 'Verified'
  },
  '021000658832': {
    barcode: '021000658832',
    name: 'Organic Boneless Skinless Chicken Breast',
    brand: 'Perdue Farms',
    category: 'Meat & Seafood',
    averagePrice: 10.99,
    standardQuantity: 2.0,
    standardUnit: 'lb',
    estimatedShelfLifeDays: 5,
    storageLocation: 'Fridge',
    foundInDatabase: true,
    confidence: 'Verified'
  },
  '070380001015': {
    barcode: '070380001015',
    name: 'Cage-Free Grade A Large Brown Eggs',
    brand: 'Vital Farms',
    category: 'Dairy & Eggs',
    averagePrice: 4.49,
    standardQuantity: 12,
    standardUnit: 'count',
    estimatedShelfLifeDays: 28,
    storageLocation: 'Fridge',
    foundInDatabase: true,
    confidence: 'Verified'
  },
  '011110852014': {
    barcode: '011110852014',
    name: 'Thai Hom Mali Jasmine Rice (5 lb)',
    brand: 'Royal',
    category: 'Pantry & Grains',
    averagePrice: 7.99,
    standardQuantity: 5,
    standardUnit: 'lb',
    estimatedShelfLifeDays: 365,
    storageLocation: 'Pantry',
    foundInDatabase: true,
    confidence: 'Verified'
  },
  '037600106254': {
    barcode: '037600106254',
    name: 'San Marzano Style Crushed Tomatoes (28 oz)',
    brand: 'Cento',
    category: 'Canned & Jarred',
    averagePrice: 3.89,
    standardQuantity: 1,
    standardUnit: 'can',
    estimatedShelfLifeDays: 730,
    storageLocation: 'Pantry',
    foundInDatabase: true,
    confidence: 'Verified'
  },
  '041790001222': {
    barcode: '041790001222',
    name: 'Cold Pressed Extra Virgin Olive Oil (25.4 oz)',
    brand: 'California Olive Ranch',
    category: 'Spices & Condiments',
    averagePrice: 12.99,
    standardQuantity: 25.4,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 540,
    storageLocation: 'Pantry',
    foundInDatabase: true,
    confidence: 'Verified'
  },
  '021000612230': {
    barcode: '021000612230',
    name: 'Natural Sharp Cheddar Cheese Block',
    brand: 'Kraft',
    category: 'Dairy & Eggs',
    averagePrice: 3.59,
    standardQuantity: 8,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 60,
    storageLocation: 'Fridge',
    foundInDatabase: true,
    confidence: 'Verified'
  },
  '070380004016': {
    barcode: '070380004016',
    name: 'Organic Whole Milk Half Gallon',
    brand: 'Horizon Organic',
    category: 'Dairy & Eggs',
    averagePrice: 4.29,
    standardQuantity: 64,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 14,
    storageLocation: 'Fridge',
    foundInDatabase: true,
    confidence: 'Verified'
  },
  '041390001025': {
    barcode: '041390001025',
    name: 'Naturally Brewed Less Sodium Soy Sauce',
    brand: 'Kikkoman',
    category: 'Spices & Condiments',
    averagePrice: 3.49,
    standardQuantity: 15,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 730,
    storageLocation: 'Pantry',
    foundInDatabase: true,
    confidence: 'Verified'
  },
  '894700010014': {
    barcode: '894700010014',
    name: 'Plain Greek Whole Milk Yogurt (32 oz)',
    brand: 'Chobani',
    category: 'Dairy & Eggs',
    averagePrice: 5.49,
    standardQuantity: 32,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 21,
    storageLocation: 'Fridge',
    foundInDatabase: true,
    confidence: 'Verified'
  },
  '048001711464': {
    barcode: '048001711464',
    name: 'Organic Black Beans in Sea Salt (15 oz)',
    brand: 'Bush\'s Best',
    category: 'Canned & Jarred',
    averagePrice: 1.49,
    standardQuantity: 1,
    standardUnit: 'can',
    estimatedShelfLifeDays: 730,
    storageLocation: 'Pantry',
    foundInDatabase: true,
    confidence: 'Verified'
  },
  '013000006408': {
    barcode: '013000006408',
    name: 'Heinz Tomato Ketchup (20 oz)',
    brand: 'Heinz',
    category: 'Spices & Condiments',
    averagePrice: 3.29,
    standardQuantity: 20,
    standardUnit: 'oz',
    estimatedShelfLifeDays: 365,
    storageLocation: 'Fridge',
    foundInDatabase: true,
    confidence: 'Verified'
  }
};
