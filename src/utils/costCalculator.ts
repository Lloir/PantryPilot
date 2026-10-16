import { InventoryItem, Recipe, RecipeIngredient } from '../types';
import { convertQuantity } from './units';
import { todayISO } from './inventoryMerge';

// Unit conversion lives in utils/units.ts (same-kind only: no mass <-> volume).
export function normalizeQuantity(quantity: number, fromUnit: string, toUnit: string): number | null {
  return convertQuantity(quantity, fromUnit, toUnit);
}

/**
 * Finds an inventory item matching a recipe ingredient name
 */
export function findMatchingInventoryItem(ingredientName: string, inventory: InventoryItem[]): InventoryItem | undefined {
  const normalizeToken = (token: string) => {
    if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
    if (token.length > 4 && token.endsWith('oes')) return token.slice(0, -2);
    if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss') && !token.endsWith('us')) return token.slice(0, -1);
    return token;
  };
  const tokensFor = (name: string) => name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(token => token && !['organic', 'fresh', 'large', 'small', 'canned', 'sliced', 'chopped', 'diced', 'boneless', 'skinless'].includes(token));
  const tokens = new Set(tokensFor(ingredientName).map(normalizeToken));
  if (!tokens.size) return undefined;
  const exactMatches = inventory.filter(i => {
    const itemTokens = tokensFor(i.name).map(normalizeToken);
    return itemTokens.length === tokens.size && itemTokens.every(token => tokens.has(token));
  });
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) return undefined;

  const matches = inventory.flatMap(item => {
    const itemTokens = new Set(tokensFor(item.name).map(normalizeToken));
    if (!itemTokens.size) return [];
    const smaller = tokens.size <= itemTokens.size ? tokens : itemTokens;
    const larger = tokens.size <= itemTokens.size ? itemTokens : tokens;
    if (![...smaller].every(token => larger.has(token))) return [];
    const extras = [...larger].filter(token => !smaller.has(token));
    if (extras.some(token => ['soup', 'sauce', 'stock', 'broth', 'powder', 'extract', 'juice'].includes(token))) return [];
    return [{ item, score: smaller.size / larger.size }];
  }).sort((a, b) => b.score - a.score);
  if (!matches.length || (matches.length > 1 && matches[0].score === matches[1].score)) return undefined;
  return matches[0].item;
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

  const today = new Date(`${todayISO()}T00:00:00`);

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
    if (convertedNeeded === null) {
      missingCount++;
      const estimatedCost = ing.estimatedCost ? ing.estimatedCost * servingRatio : 1.50 * servingRatio;
      totalCost += estimatedCost;
      return {
        ingredient: ing,
        matchedItem,
        inStock: false,
        stockQuantity: matchedItem.quantity,
        stockUnit: matchedItem.unit,
        hasEnoughQuantity: false,
        requiredQuantity: requiredQty,
        cost: estimatedCost,
        isExpiringSoon: false
      };
    }
    const neededInStockUnit = convertedNeeded;
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
