import { InventoryItem, Recipe, PlannedMeal, CookedMealLog, BarcodeLookupResult, ReceiptScanResult } from '../types';

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-1',
    name: 'Boneless Skinless Chicken Breasts',
    category: 'Meat & Seafood',
    quantity: 2.5,
    unit: 'lb',
    unitPrice: 4.49,
    totalCost: 11.23,
    purchaseDate: '2026-10-02',
    expirationDate: '2026-10-07', // 2 days from Oct 5
    location: 'Fridge',
    barcode: '021000658832',
    notes: 'Organic fresh chicken',
  },
  {
    id: 'inv-2',
    name: 'Organic Baby Spinach',
    category: 'Produce',
    quantity: 16,
    unit: 'oz',
    unitPrice: 0.25, // $3.99 for 16oz
    totalCost: 3.99,
    purchaseDate: '2026-10-03',
    expirationDate: '2026-10-06', // 1 day from Oct 5 - URGENT!
    location: 'Fridge',
    barcode: '071430009214',
    notes: 'Needs to be used quickly in salads or pasta',
  },
  {
    id: 'inv-3',
    name: 'Hass Avocados',
    category: 'Produce',
    quantity: 3,
    unit: 'count',
    unitPrice: 1.25,
    totalCost: 3.75,
    purchaseDate: '2026-10-01',
    expirationDate: '2026-10-07', // Ripe now!
    location: 'Counter',
    barcode: '000000042250',
    notes: 'Very ripe and soft',
  },
  {
    id: 'inv-4',
    name: 'Large Brown Eggs',
    category: 'Dairy & Eggs',
    quantity: 12,
    unit: 'count',
    unitPrice: 0.35, // $4.20 per dozen
    totalCost: 4.20,
    purchaseDate: '2026-09-28',
    expirationDate: '2026-10-24',
    location: 'Fridge',
    barcode: '070380001015',
    notes: 'Cage free grade A',
  },
  {
    id: 'inv-5',
    name: 'Jasmine Rice',
    category: 'Pantry & Grains',
    quantity: 5,
    unit: 'lb',
    unitPrice: 1.60,
    totalCost: 7.99,
    purchaseDate: '2026-09-15',
    expirationDate: '2027-06-30',
    location: 'Pantry',
    barcode: '011110852014',
    notes: 'Long grain fragrant rice',
  },
  {
    id: 'inv-6',
    name: 'Barilla Penne Pasta',
    category: 'Pantry & Grains',
    quantity: 16,
    unit: 'oz',
    unitPrice: 0.12, // $1.99 per 16oz box
    totalCost: 1.99,
    purchaseDate: '2026-09-20',
    expirationDate: '2027-12-31',
    location: 'Pantry',
    barcode: '076808500138',
  },
  {
    id: 'inv-7',
    name: 'Canned Crushed Tomatoes',
    category: 'Canned & Jarred',
    quantity: 2,
    unit: 'can',
    unitPrice: 1.89,
    totalCost: 3.78,
    purchaseDate: '2026-09-18',
    expirationDate: '2028-01-15',
    location: 'Pantry',
    barcode: '037600106254',
  },
  {
    id: 'inv-8',
    name: 'Extra Virgin Olive Oil',
    category: 'Spices & Condiments',
    quantity: 24,
    unit: 'oz',
    unitPrice: 0.45,
    totalCost: 10.99,
    purchaseDate: '2026-09-10',
    expirationDate: '2027-09-10',
    location: 'Pantry',
    barcode: '041790001222',
  },
  {
    id: 'inv-9',
    name: 'Yellow Onions',
    category: 'Produce',
    quantity: 4,
    unit: 'count',
    unitPrice: 0.70,
    totalCost: 2.80,
    purchaseDate: '2026-09-29',
    expirationDate: '2026-10-25',
    location: 'Pantry',
  },
  {
    id: 'inv-10',
    name: 'Fresh Garlic Bulbs',
    category: 'Produce',
    quantity: 3,
    unit: 'count',
    unitPrice: 0.50,
    totalCost: 1.50,
    purchaseDate: '2026-09-25',
    expirationDate: '2026-11-10',
    location: 'Pantry',
  },
  {
    id: 'inv-11',
    name: 'Red Bell Peppers',
    category: 'Produce',
    quantity: 2,
    unit: 'count',
    unitPrice: 1.49,
    totalCost: 2.98,
    purchaseDate: '2026-10-02',
    expirationDate: '2026-10-09',
    location: 'Fridge',
  },
  {
    id: 'inv-12',
    name: 'Block Sharp Cheddar Cheese',
    category: 'Dairy & Eggs',
    quantity: 8,
    unit: 'oz',
    unitPrice: 0.45,
    totalCost: 3.59,
    purchaseDate: '2026-09-26',
    expirationDate: '2026-11-20',
    location: 'Fridge',
    barcode: '021000612230',
  },
  {
    id: 'inv-13',
    name: 'Whole Milk',
    category: 'Dairy & Eggs',
    quantity: 64,
    unit: 'oz',
    unitPrice: 0.055, // ~$3.49 per half gallon
    totalCost: 3.49,
    purchaseDate: '2026-10-01',
    expirationDate: '2026-10-10',
    location: 'Fridge',
    barcode: '070380004016',
  },
  {
    id: 'inv-14',
    name: 'Soy Sauce',
    category: 'Spices & Condiments',
    quantity: 15,
    unit: 'oz',
    unitPrice: 0.22,
    totalCost: 3.29,
    purchaseDate: '2026-09-01',
    expirationDate: '2028-05-01',
    location: 'Pantry',
    barcode: '041390001025',
  },
  {
    id: 'inv-15',
    name: 'Greek Yogurt Plain',
    category: 'Dairy & Eggs',
    quantity: 32,
    unit: 'oz',
    unitPrice: 0.16,
    totalCost: 5.19,
    purchaseDate: '2026-10-02',
    expirationDate: '2026-10-18',
    location: 'Fridge',
    barcode: '894700010014',
  },
  {
    id: 'inv-16',
    name: 'Fresh Strawberries',
    category: 'Produce',
    quantity: 16,
    unit: 'oz',
    unitPrice: 0.25,
    totalCost: 3.99,
    purchaseDate: '2026-10-03',
    expirationDate: '2026-10-07', // 2 days left!
    location: 'Fridge',
    notes: 'Sweet, eat or use in parfait soon',
  },
  {
    id: 'inv-17',
    name: 'Ground Black Pepper & Sea Salt',
    category: 'Spices & Condiments',
    quantity: 10,
    unit: 'oz',
    unitPrice: 0.30,
    totalCost: 3.00,
    purchaseDate: '2026-08-01',
    expirationDate: '2028-08-01',
    location: 'Spice Rack',
  }
];

export const INITIAL_RECIPES: Recipe[] = [
  {
    id: 'rec-1',
    name: 'Garlic Chicken & Baby Spinach Stir-Fry',
    description: 'A savory, quick skillet meal that utilizes fresh chicken and quickly wilts down baby spinach before it expires.',
    mealType: 'Dinner',
    cuisine: 'Asian',
    servings: 2,
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    tags: ['Quick', 'High Protein', 'Expiry Saver', 'Kid-Friendly'],
    ingredients: [
      { name: 'Boneless Skinless Chicken Breasts', quantity: 0.75, unit: 'lb' },
      { name: 'Organic Baby Spinach', quantity: 6, unit: 'oz' },
      { name: 'Fresh Garlic Bulbs', quantity: 1, unit: 'count' },
      { name: 'Soy Sauce', quantity: 2, unit: 'oz' },
      { name: 'Extra Virgin Olive Oil', quantity: 1, unit: 'oz' },
      { name: 'Jasmine Rice', quantity: 0.5, unit: 'lb' }
    ],
    instructions: [
      'Cook jasmine rice in water (1:1.5 ratio) until fluffy.',
      'Slice chicken breasts into thin bite-sized strips and season with salt and pepper.',
      'Heat 1 oz olive oil in a wok or large skillet over high heat. Add minced garlic and cook for 30 seconds.',
      'Add chicken strips and sear for 5-6 minutes until golden and cooked through.',
      'Pour in soy sauce and toss in the baby spinach. Stir constantly for 90 seconds until the spinach wilts.',
      'Serve hot over steamed jasmine rice.'
    ]
  },
  {
    id: 'rec-2',
    name: 'Creamy Garlic & Tomato Penne',
    description: 'Comforting Italian pasta made with crushed tomatoes, garlic, cheese, and a handful of wilting spinach.',
    mealType: 'Dinner',
    cuisine: 'Italian',
    servings: 3,
    prepTimeMinutes: 8,
    cookTimeMinutes: 18,
    tags: ['Comfort Food', 'Vegetarian', 'Budget Friendly', 'Kid-Friendly'],
    ingredients: [
      { name: 'Barilla Penne Pasta', quantity: 10, unit: 'oz' },
      { name: 'Canned Crushed Tomatoes', quantity: 1, unit: 'can' },
      { name: 'Fresh Garlic Bulbs', quantity: 1, unit: 'count' },
      { name: 'Yellow Onions', quantity: 1, unit: 'count' },
      { name: 'Extra Virgin Olive Oil', quantity: 1, unit: 'oz' },
      { name: 'Block Sharp Cheddar Cheese', quantity: 3, unit: 'oz' },
      { name: 'Organic Baby Spinach', quantity: 4, unit: 'oz' }
    ],
    instructions: [
      'Bring a large pot of salted water to a boil and cook penne for 10-11 minutes until al dente.',
      'Finely dice onion and mince garlic. Heat olive oil in a saucepan and sauté onions for 4 minutes until translucent.',
      'Add garlic and cook for 1 minute, then pour in canned crushed tomatoes. Simmer gently for 10 minutes.',
      'Fold in baby spinach until wilted, then stir in grated cheddar cheese until sauce is rich and creamy.',
      'Drain pasta, toss with the sauce, and serve warm.'
    ]
  },
  {
    id: 'rec-3',
    name: 'Mediterranean Spinach & Cheddar Scramble',
    description: 'Fluffy eggs scrambled with fresh baby spinach, melted cheddar, and a drizzle of olive oil. Uses expiring greens!',
    mealType: 'Breakfast',
    cuisine: 'Mediterranean',
    servings: 2,
    prepTimeMinutes: 5,
    cookTimeMinutes: 7,
    tags: ['Breakfast', 'Keto', 'Expiry Saver', 'Ready in 10m'],
    ingredients: [
      { name: 'Large Brown Eggs', quantity: 4, unit: 'count' },
      { name: 'Organic Baby Spinach', quantity: 4, unit: 'oz' },
      { name: 'Block Sharp Cheddar Cheese', quantity: 2, unit: 'oz' },
      { name: 'Extra Virgin Olive Oil', quantity: 0.5, unit: 'oz' },
      { name: 'Ground Black Pepper & Sea Salt', quantity: 0.2, unit: 'oz' }
    ],
    instructions: [
      'Crack eggs into a bowl and whisk vigorously with salt and pepper.',
      'Warm olive oil in a non-stick skillet over medium-low heat.',
      'Add spinach and toss for 1 minute until wilted.',
      'Pour in whisked eggs. Use a silicone spatula to gently fold curds together.',
      'Right before eggs are fully set, sprinkle grated cheddar cheese on top. Remove from heat and serve.'
    ]
  },
  {
    id: 'rec-4',
    name: 'Fresh Avocado Smash & Fried Egg Rice Bowl',
    description: 'Creamy avocado mash over steaming jasmine rice topped with crispy-edged sunny side eggs and a splash of soy sauce.',
    mealType: 'Lunch',
    cuisine: 'Asian',
    servings: 1,
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    tags: ['Quick', 'Vegetarian', 'Uses Ripe Avocados', 'Kid-Friendly'],
    ingredients: [
      { name: 'Hass Avocados', quantity: 1, unit: 'count' },
      { name: 'Large Brown Eggs', quantity: 2, unit: 'count' },
      { name: 'Jasmine Rice', quantity: 0.3, unit: 'lb' },
      { name: 'Soy Sauce', quantity: 0.5, unit: 'oz' },
      { name: 'Extra Virgin Olive Oil', quantity: 0.5, unit: 'oz' }
    ],
    instructions: [
      'Warm up cooked jasmine rice and transfer to a serving bowl.',
      'In a small bowl, roughly mash the ripe avocado with a pinch of salt.',
      'Heat olive oil in a frying pan over medium-high heat. Fry eggs until whites are crispy and yolks remain runny.',
      'Spoon mashed avocado over the rice, top with fried eggs, and drizzle soy sauce over the yolks.'
    ]
  },
  {
    id: 'rec-5',
    name: 'Skillet Chicken & Bell Pepper Fajita Bowls',
    description: 'Juicy spiced chicken strips sautéed with sliced sweet bell peppers and onions over jasmine rice.',
    mealType: 'Dinner',
    cuisine: 'Mexican',
    servings: 2,
    prepTimeMinutes: 10,
    cookTimeMinutes: 16,
    tags: ['High Protein', 'Meal Prep Friendly', 'Flavorful', 'Quick'],
    ingredients: [
      { name: 'Boneless Skinless Chicken Breasts', quantity: 1.0, unit: 'lb' },
      { name: 'Red Bell Peppers', quantity: 2, unit: 'count' },
      { name: 'Yellow Onions', quantity: 1, unit: 'count' },
      { name: 'Extra Virgin Olive Oil', quantity: 1, unit: 'oz' },
      { name: 'Hass Avocados', quantity: 1, unit: 'count' },
      { name: 'Jasmine Rice', quantity: 0.5, unit: 'lb' }
    ],
    instructions: [
      'Slice chicken, bell peppers, and onion into thin strips.',
      'Heat olive oil in a heavy skillet over high heat. Sear chicken strips for 6 minutes until cooked through. Remove to a plate.',
      'In the same skillet, blister peppers and onions for 5-6 minutes until charred on edges but still crisp-tender.',
      'Return chicken to the skillet to combine seasonings.',
      'Serve over rice with sliced fresh avocado on top.'
    ]
  },
  {
    id: 'rec-6',
    name: 'Greek Yogurt Strawberry Parfait Bowl',
    description: 'Thick, creamy Greek yogurt topped with fresh sliced strawberries and a hint of honey or sweetener.',
    mealType: 'Breakfast',
    cuisine: 'American',
    servings: 1,
    prepTimeMinutes: 4,
    cookTimeMinutes: 0,
    tags: ['No Cook', 'High Protein', 'Expiry Saver', 'Quick', 'Kid-Friendly'],
    ingredients: [
      { name: 'Greek Yogurt Plain', quantity: 8, unit: 'oz' },
      { name: 'Fresh Strawberries', quantity: 6, unit: 'oz' }
    ],
    instructions: [
      'Wash, hull, and slice fresh strawberries.',
      'Spoon creamy Greek yogurt into a bowl or wide glass.',
      'Arrange strawberries generously over the top.',
      'Enjoy immediately as a high-protein, zero-waste breakfast!'
    ]
  },
  {
    id: 'rec-7',
    name: 'Simple Golden Egg Fried Rice',
    description: 'Transform abundant jasmine rice, eggs, onions, and garlic into a fragrant, savory staple dinner.',
    mealType: 'Lunch',
    cuisine: 'Asian',
    servings: 2,
    prepTimeMinutes: 8,
    cookTimeMinutes: 12,
    tags: ['Pantry Staple', 'Budget Meal', 'Abundant Ingredients', 'Kid-Friendly', 'Quick'],
    ingredients: [
      { name: 'Jasmine Rice', quantity: 0.75, unit: 'lb' },
      { name: 'Large Brown Eggs', quantity: 3, unit: 'count' },
      { name: 'Yellow Onions', quantity: 1, unit: 'count' },
      { name: 'Fresh Garlic Bulbs', quantity: 1, unit: 'count' },
      { name: 'Soy Sauce', quantity: 1.5, unit: 'oz' },
      { name: 'Extra Virgin Olive Oil', quantity: 1, unit: 'oz' }
    ],
    instructions: [
      'Use cold, day-old jasmine rice or spread warm rice on a plate to cool slightly.',
      'Beat eggs in a bowl. Heat half the oil in a wok and soft-scramble the eggs; set aside.',
      'Add remaining oil, minced garlic, and diced onion. Sauté until fragrant.',
      'Add the rice, breaking up any clumps with a spatula. Fry on high heat for 3-4 minutes.',
      'Pour soy sauce around the edge of the wok so it caramelizes.',
      'Toss scrambled eggs back into the rice, mix thoroughly, and serve.'
    ]
  },
  {
    id: 'rec-8',
    name: 'Crispy Cheddar Quesadilla with Guac',
    description: 'Gooey melted cheddar folded in a pan with quick fresh avocado guacamole and diced sweet peppers.',
    mealType: 'Lunch',
    cuisine: 'Mexican',
    servings: 1,
    prepTimeMinutes: 6,
    cookTimeMinutes: 8,
    tags: ['Quick', 'Comfort Food', 'Uses Avocados', 'Kid-Friendly'],
    ingredients: [
      { name: 'Block Sharp Cheddar Cheese', quantity: 3, unit: 'oz' },
      { name: 'Hass Avocados', quantity: 1, unit: 'count' },
      { name: 'Red Bell Peppers', quantity: 0.5, unit: 'count' },
      { name: 'Extra Virgin Olive Oil', quantity: 0.3, unit: 'oz' }
    ],
    instructions: [
      'Mash avocado with a squeeze of salt and finely diced bell pepper to make quick guacamole.',
      'Grate cheddar cheese.',
      'Heat oil in a skillet, melt cheese into a crispy golden lace crust or fold into tortillas if available.',
      'Serve crispy cheese with fresh guacamole on the side.'
    ]
  },
  {
    id: 'rec-9',
    name: 'Garlic Spinach & Avocado Jasmine Rice Bowl',
    description: 'A 100% plant-based, nutrient-packed warm rice bowl layered with wilted garlic spinach, creamy sliced avocado, and toasted sesame soy dressing.',
    mealType: 'Dinner',
    cuisine: 'Asian',
    servings: 2,
    prepTimeMinutes: 8,
    cookTimeMinutes: 10,
    tags: ['Vegan', 'Quick', 'Gluten-Free', 'Expiry Saver', 'Vegetarian'],
    ingredients: [
      { name: 'Organic Baby Spinach', quantity: 6, unit: 'oz' },
      { name: 'Hass Avocados', quantity: 1, unit: 'count' },
      { name: 'Fresh Garlic Bulbs', quantity: 1, unit: 'count' },
      { name: 'Jasmine Rice', quantity: 0.5, unit: 'lb' },
      { name: 'Soy Sauce', quantity: 1.5, unit: 'oz' },
      { name: 'Extra Virgin Olive Oil', quantity: 1, unit: 'oz' }
    ],
    instructions: [
      'Steam or warm jasmine rice and divide into two bowls.',
      'Heat olive oil in a skillet over medium heat. Sauté minced garlic for 30 seconds until fragrant.',
      'Add fresh baby spinach and toss vigorously for 1-2 minutes until just wilted.',
      'Remove from heat, season with soy sauce, and spoon hot garlic spinach over the rice.',
      'Top with ripe sliced avocado and serve immediately.'
    ]
  }
];

export const INITIAL_PLANNED_MEALS: PlannedMeal[] = [
  {
    id: 'plan-1',
    date: '2026-10-05', // Today
    slot: 'Dinner',
    recipeId: 'rec-1',
    customName: 'Garlic Chicken & Baby Spinach Stir-Fry',
    servings: 2,
    ingredients: [
      { name: 'Boneless Skinless Chicken Breasts', quantity: 0.75, unit: 'lb' },
      { name: 'Organic Baby Spinach', quantity: 6, unit: 'oz' },
      { name: 'Fresh Garlic Bulbs', quantity: 1, unit: 'count' },
      { name: 'Soy Sauce', quantity: 2, unit: 'oz' },
      { name: 'Extra Virgin Olive Oil', quantity: 1, unit: 'oz' },
      { name: 'Jasmine Rice', quantity: 0.5, unit: 'lb' }
    ]
  },
  {
    id: 'plan-2',
    date: '2026-10-06',
    slot: 'Breakfast',
    recipeId: 'rec-3',
    customName: 'Mediterranean Spinach & Cheddar Scramble',
    servings: 2,
    ingredients: [
      { name: 'Large Brown Eggs', quantity: 4, unit: 'count' },
      { name: 'Organic Baby Spinach', quantity: 4, unit: 'oz' },
      { name: 'Block Sharp Cheddar Cheese', quantity: 2, unit: 'oz' },
      { name: 'Extra Virgin Olive Oil', quantity: 0.5, unit: 'oz' }
    ]
  },
  {
    id: 'plan-3',
    date: '2026-10-07',
    slot: 'Dinner',
    recipeId: 'rec-5',
    customName: 'Skillet Chicken & Bell Pepper Fajita Bowls',
    servings: 2,
    ingredients: [
      { name: 'Boneless Skinless Chicken Breasts', quantity: 1.0, unit: 'lb' },
      { name: 'Red Bell Peppers', quantity: 2, unit: 'count' },
      { name: 'Yellow Onions', quantity: 1, unit: 'count' },
      { name: 'Extra Virgin Olive Oil', quantity: 1, unit: 'oz' },
      { name: 'Hass Avocados', quantity: 1, unit: 'count' },
      { name: 'Jasmine Rice', quantity: 0.5, unit: 'lb' }
    ]
  },
  {
    id: 'plan-4',
    date: '2026-10-08',
    slot: 'Dinner',
    recipeId: 'rec-2',
    customName: 'Creamy Garlic & Tomato Penne',
    servings: 3,
    ingredients: [
      { name: 'Barilla Penne Pasta', quantity: 10, unit: 'oz' },
      { name: 'Canned Crushed Tomatoes', quantity: 1, unit: 'can' },
      { name: 'Fresh Garlic Bulbs', quantity: 1, unit: 'count' },
      { name: 'Yellow Onions', quantity: 1, unit: 'count' },
      { name: 'Extra Virgin Olive Oil', quantity: 1, unit: 'oz' },
      { name: 'Block Sharp Cheddar Cheese', quantity: 3, unit: 'oz' },
      { name: 'Organic Baby Spinach', quantity: 4, unit: 'oz' }
    ]
  }
];

export const INITIAL_COOKED_LOGS: CookedMealLog[] = [
  {
    id: 'log-1',
    recipeId: 'rec-6',
    recipeName: 'Greek Yogurt Strawberry Parfait Bowl',
    cookedAt: '2026-10-04T08:30:00Z',
    servingsCooked: 1,
    totalMealCost: 2.78,
    costPerServing: 2.78,
    deductedItems: [
      { inventoryItemId: 'inv-15', itemName: 'Greek Yogurt Plain', quantityDeducted: 8, unit: 'oz', cost: 1.28 },
      { inventoryItemId: 'inv-16', itemName: 'Fresh Strawberries', quantityDeducted: 6, unit: 'oz', cost: 1.50 }
    ],
    notes: 'Delicious breakfast, saved strawberries from going soft!'
  },
  {
    id: 'log-2',
    recipeId: 'rec-7',
    recipeName: 'Simple Golden Egg Fried Rice',
    cookedAt: '2026-10-03T19:15:00Z',
    servingsCooked: 2,
    totalMealCost: 3.42,
    costPerServing: 1.71,
    deductedItems: [
      { inventoryItemId: 'inv-5', itemName: 'Jasmine Rice', quantityDeducted: 0.75, unit: 'lb', cost: 1.20 },
      { inventoryItemId: 'inv-4', itemName: 'Large Brown Eggs', quantityDeducted: 3, unit: 'count', cost: 1.05 },
      { inventoryItemId: 'inv-9', itemName: 'Yellow Onions', quantityDeducted: 1, unit: 'count', cost: 0.70 },
      { inventoryItemId: 'inv-14', itemName: 'Soy Sauce', quantityDeducted: 1.5, unit: 'oz', cost: 0.33 },
      { inventoryItemId: 'inv-8', itemName: 'Extra Virgin Olive Oil', quantityDeducted: 0.5, unit: 'oz', cost: 0.14 }
    ],
    notes: 'Super cheap dinner, restaurant quality for $1.71 a portion!'
  }
];

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

export const SAMPLE_RECEIPTS: { id: string; name: string; store: string; date: string; itemsCount: number; data: ReceiptScanResult }[] = [
  {
    id: 'rec-sample-1',
    name: 'Trader Joe\'s Healthy Haul',
    store: 'Trader Joe\'s (#142)',
    date: '2026-10-04',
    itemsCount: 7,
    data: {
      storeName: 'Trader Joe\'s',
      purchaseDate: '2026-10-04',
      subtotal: 24.33,
      tax: 1.82,
      total: 26.15,
      confidenceScore: 0.96,
      items: [
        { name: 'Organic Baby Spinach', category: 'Produce', quantity: 1, unit: 'pack', unitPrice: 2.99, totalPrice: 2.99, estimatedShelfLifeDays: 5, selected: true },
        { name: 'Avocados Hass 4-Pack', category: 'Produce', quantity: 4, unit: 'count', unitPrice: 0.99, totalPrice: 3.96, estimatedShelfLifeDays: 5, selected: true },
        { name: 'Pasture Raised Eggs (1 Dozen)', category: 'Dairy & Eggs', quantity: 12, unit: 'count', unitPrice: 0.35, totalPrice: 4.29, estimatedShelfLifeDays: 24, selected: true },
        { name: 'Greek Whole Milk Yogurt', category: 'Dairy & Eggs', quantity: 32, unit: 'oz', unitPrice: 0.14, totalPrice: 4.49, estimatedShelfLifeDays: 18, selected: true },
        { name: 'Organic Sliced Strawberries', category: 'Produce', quantity: 16, unit: 'oz', unitPrice: 0.22, totalPrice: 3.49, estimatedShelfLifeDays: 4, selected: true },
        { name: 'Garlic Bulbs (3 Pack)', category: 'Produce', quantity: 3, unit: 'count', unitPrice: 0.53, totalPrice: 1.59, estimatedShelfLifeDays: 45, selected: true },
        { name: 'Organic Black Beans Can', category: 'Canned & Jarred', quantity: 2, unit: 'can', unitPrice: 1.19, totalPrice: 2.38, estimatedShelfLifeDays: 730, selected: true }
      ]
    }
  },
  {
    id: 'rec-sample-2',
    name: 'Whole Foods Market Weekly Stockup',
    store: 'Whole Foods Market',
    date: '2026-10-03',
    itemsCount: 6,
    data: {
      storeName: 'Whole Foods Market',
      purchaseDate: '2026-10-03',
      subtotal: 38.65,
      tax: 2.89,
      total: 41.54,
      confidenceScore: 0.98,
      items: [
        { name: 'Organic Boneless Chicken Breast', category: 'Meat & Seafood', quantity: 2.2, unit: 'lb', unitPrice: 5.99, totalPrice: 13.18, estimatedShelfLifeDays: 4, selected: true },
        { name: 'Organic Bell Peppers Trio', category: 'Produce', quantity: 3, unit: 'count', unitPrice: 1.66, totalPrice: 4.99, estimatedShelfLifeDays: 7, selected: true },
        { name: 'Barilla Artisan Pasta Penne', category: 'Pantry & Grains', quantity: 16, unit: 'oz', unitPrice: 0.16, totalPrice: 2.49, estimatedShelfLifeDays: 700, selected: true },
        { name: 'San Marzano Canned Tomatoes', category: 'Canned & Jarred', quantity: 2, unit: 'can', unitPrice: 3.99, totalPrice: 7.98, estimatedShelfLifeDays: 700, selected: true },
        { name: 'Organic Sharp Cheddar Cheese', category: 'Dairy & Eggs', quantity: 8, unit: 'oz', unitPrice: 0.56, totalPrice: 4.49, estimatedShelfLifeDays: 50, selected: true },
        { name: 'Organic Yellow Onions Bag', category: 'Produce', quantity: 3, unit: 'lb', unitPrice: 1.84, totalPrice: 5.52, estimatedShelfLifeDays: 25, selected: true }
      ]
    }
  },
  {
    id: 'rec-sample-3',
    name: 'Kroger Neighborhood Grocer',
    store: 'Kroger Fresh',
    date: '2026-10-01',
    itemsCount: 5,
    data: {
      storeName: 'Kroger Fresh',
      purchaseDate: '2026-10-01',
      subtotal: 18.20,
      tax: 1.15,
      total: 19.35,
      confidenceScore: 0.94,
      items: [
        { name: 'Whole Milk Vitamin D', category: 'Dairy & Eggs', quantity: 64, unit: 'oz', unitPrice: 0.05, totalPrice: 3.29, estimatedShelfLifeDays: 12, selected: true },
        { name: 'Jasmine Fragrant Rice', category: 'Pantry & Grains', quantity: 5, unit: 'lb', unitPrice: 1.40, totalPrice: 6.99, estimatedShelfLifeDays: 365, selected: true },
        { name: 'Kikkoman Soy Sauce', category: 'Spices & Condiments', quantity: 15, unit: 'oz', unitPrice: 0.22, totalPrice: 3.29, estimatedShelfLifeDays: 700, selected: true },
        { name: 'Fresh Russet Potatoes', category: 'Produce', quantity: 5, unit: 'lb', unitPrice: 0.70, totalPrice: 3.49, estimatedShelfLifeDays: 30, selected: true },
        { name: 'Ground Sea Salt Grinder', category: 'Spices & Condiments', quantity: 1, unit: 'pack', unitPrice: 2.14, totalPrice: 2.14, estimatedShelfLifeDays: 700, selected: true }
      ]
    }
  }
];
