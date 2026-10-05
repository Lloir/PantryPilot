import { InventoryItem, Recipe, RecipeIngredient } from '../types';

// Standard unit conversions
export function normalizeQuantity(quantity: number, fromUnit: string, toUnit: string): number | null {
  const f = fromUnit.toLowerCase().trim();
  const t = toUnit.toLowerCase().trim();

  if (f === t) return quantity;

  // Weight conversions
  if ((f === 'lb' || f === 'lbs' || f === 'pound' || f === 'pounds') && (t === 'oz' || t === 'ounce' || t === 'ounces')) {
    return quantity * 16;
  }
  if ((f === 'oz' || f === 'ounce' || f === 'ounces') && (t === 'lb' || t === 'lbs' || t === 'pound' || t === 'pounds')) {
    return quantity / 16;
  }
  if ((f === 'kg' || f === 'kilogram') && (t === 'g' || t === 'gram' || t === 'grams')) {
    return quantity * 1000;
  }
  if ((f === 'g' || f === 'gram' || f === 'grams') && (t === 'kg' || t === 'kilogram')) {
    return quantity / 1000;
  }
  if ((f === 'lb' || f === 'lbs') && (t === 'g' || t === 'grams')) {
    return quantity * 453.592;
  }
  if ((f === 'g' || f === 'grams') && (t === 'lb' || t === 'lbs')) {
    return quantity / 453.592;
  }

  // Volume conversions
  if ((f === 'cup' || f === 'cups') && (t === 'oz' || t === 'fl oz')) {
    return quantity * 8;
  }
  if ((f === 'oz' || f === 'fl oz') && (t === 'cup' || t === 'cups')) {
    return quantity / 8;
  }
  if ((f === 'tbsp' || f === 'tablespoon' || f === 'tablespoons') && (t === 'oz' || t === 'fl oz')) {
    return quantity * 0.5;
  }
  if ((f === 'tsp' || f === 'teaspoon' || f === 'teaspoons') && (t === 'oz' || t === 'fl oz')) {
    return quantity * 0.166667;
  }
  if ((f === 'l' || f === 'liter' || f === 'liters') && (t === 'ml' || t === 'milliliter')) {
    return quantity * 1000;
  }
  if ((f === 'ml' || t === 'milliliter') && (t === 'l' || t === 'liter')) {
    return quantity / 1000;
  }

  // Count / pack aliases
  const countUnits = ['count', 'item', 'items', 'each', 'piece', 'pieces', 'can', 'cans', 'pack', 'packs'];
  if (countUnits.includes(f) && countUnits.includes(t)) {
    return quantity;
  }

  return null; // Cannot directly convert
}

/**
 * Finds an inventory item matching a recipe ingredient name
 */
export function findMatchingInventoryItem(ingredientName: string, inventory: InventoryItem[]): InventoryItem | undefined {
  const cleanName = ingredientName.toLowerCase().trim();

  // 1. Exact match
  const exact = inventory.find(i => i.name.toLowerCase().trim() === cleanName);
  if (exact) return exact;

  // 2. Contains match
  const partial = inventory.find(i => {
    const invName = i.name.toLowerCase();
    return invName.includes(cleanName) || cleanName.includes(invName);
  });
  if (partial) return partial;

  // 3. Keyword token match
  const tokens = cleanName.split(/\s+/).filter(w => w.length > 2 && !['organic', 'fresh', 'large', 'small', 'canned', 'sliced'].includes(w));
  return inventory.find(i => {
    const invName = i.name.toLowerCase();
    return tokens.some(token => invName.includes(token));
  });
}

export interface IngredientCostDetail {
  ingredient: RecipeIngredient;
  matchedItem?: InventoryItem;
  inStock: boolean;
  stockQuantity: number;
  stockUnit: string;
  hasEnoughQuantity: boolean;
  requiredQuantity: number;
  convertedQuantityInStockUnit?: number;
  cost: number;
  isExpiringSoon: boolean;
  daysUntilExpiration?: number;
}

export interface RecipeCostBreakdown {
  recipe: Recipe;
  totalCost: number;
  costPerServing: number;
  canMakeNow: boolean; // 100% of required ingredients in stock with sufficient quantity
  inStockCount: number;
  missingCount: number;
  matchPercentage: number;
  ingredientDetails: IngredientCostDetail[];
  expiringIngredientsUsed: string[]; // names of ingredients that will expire in <= 3 days
  urgencyScore: number; // Higher if it uses ingredients close to expiry
  abundanceScore: number; // Higher if it uses abundant staples
}

export function calculateRecipeCostAndMatch(
  recipe: Recipe,
  inventory: InventoryItem[],
  customServings?: number
): RecipeCostBreakdown {
  const servings = customServings || recipe.servings;
  const servingRatio = servings / recipe.servings;

  const today = new Date('2026-10-05T00:00:00'); // current date in context

  let totalCost = 0;
  let inStockCount = 0;
  let missingCount = 0;
  const expiringIngredientsUsed: string[] = [];
  let urgencyScore = 0;
  let abundanceScore = 0;

  const ingredientDetails: IngredientCostDetail[] = recipe.ingredients.map(ing => {
    const requiredQty = ing.quantity * servingRatio;
    const matchedItem = findMatchingInventoryItem(ing.name, inventory);

    if (!matchedItem) {
      missingCount++;
      // Estimate fallback cost if not in stock (average $1.50)
      const estimatedCost = ing.estimatedCost ? ing.estimatedCost * servingRatio : 1.50 * servingRatio;
      totalCost += estimatedCost;
      return {
        ingredient: ing,
        inStock: false,
        stockQuantity: 0,
        stockUnit: ing.unit,
        hasEnoughQuantity: false,
        requiredQuantity: requiredQty,
        cost: estimatedCost,
        isExpiringSoon: false
      };
    }

    // Item found in inventory
    const convertedNeeded = normalizeQuantity(requiredQty, ing.unit, matchedItem.unit);
    const neededInStockUnit = convertedNeeded !== null ? convertedNeeded : requiredQty;
    const hasEnough = matchedItem.quantity >= neededInStockUnit;

    if (hasEnough) {
      inStockCount++;
    } else {
      missingCount++;
    }

    // Cost calculation: portion used * unit price
    const portionCost = Math.max(0.05, Number((neededInStockUnit * matchedItem.unitPrice).toFixed(2)));
    totalCost += portionCost;

    // Check expiration urgency
    let daysUntilExpiry: number | undefined = undefined;
    let isExpiringSoon = false;

    if (matchedItem.expirationDate) {
      const expDate = new Date(`${matchedItem.expirationDate}T00:00:00`);
      const diffTime = expDate.getTime() - today.getTime();
      daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 3) {
        isExpiringSoon = true;
        expiringIngredientsUsed.push(matchedItem.name);
        // Urgency score: 3 days = 30 pts, 2 days = 50 pts, 1 day = 100 pts
        const points = daysUntilExpiry <= 1 ? 100 : daysUntilExpiry === 2 ? 60 : 30;
        urgencyScore += points;
      }
    }

    // Abundance score
    if (matchedItem.quantity > 5 || matchedItem.category === 'Pantry & Grains') {
      abundanceScore += 10;
    }

    return {
      ingredient: ing,
      matchedItem,
      inStock: true,
      stockQuantity: matchedItem.quantity,
      stockUnit: matchedItem.unit,
      hasEnoughQuantity: hasEnough,
      requiredQuantity: requiredQty,
      convertedQuantityInStockUnit: neededInStockUnit,
      cost: portionCost,
      isExpiringSoon,
      daysUntilExpiration: daysUntilExpiry
    };
  });

  const totalIngredients = recipe.ingredients.length;
  const matchPercentage = totalIngredients > 0 ? Math.round((inStockCount / totalIngredients) * 100) : 0;
  const canMakeNow = missingCount === 0;
  const costPerServing = servings > 0 ? Number((totalCost / servings).toFixed(2)) : 0;

  return {
    recipe,
    totalCost: Number(totalCost.toFixed(2)),
    costPerServing,
    canMakeNow,
    inStockCount,
    missingCount,
    matchPercentage,
    ingredientDetails,
    expiringIngredientsUsed,
    urgencyScore,
    abundanceScore
  };
}
