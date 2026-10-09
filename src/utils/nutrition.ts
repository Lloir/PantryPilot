import { InventoryItem, Recipe } from '../types';
import { canonicalUnit, convertQuantity, unitKind } from './units';

export interface RecipeNutrition {
  kcalPerServing: number;
  proteinPerServing?: number;
  covered: number; // ingredients that had nutrition data and a weight/volume
  total: number;
}

/** Rough calories per serving from the stocked items that have nutrition data. Missing ingredients are left out, and `covered` says how many counted. */
export function estimateRecipeNutrition(
  recipe: Recipe,
  findItem: (ingredientName: string) => InventoryItem | undefined,
  servings: number = recipe.servings
): RecipeNutrition | null {
  let kcal = 0;
  let protein = 0;
  let covered = 0;
  for (const ing of recipe.ingredients) {
    const item = findItem(ing.name);
    const n = item?.nutrition;
    if (!n || n.kcal === undefined) continue;
    const kind = unitKind(ing.unit);
    // 100 g / 100 ml bases: weights count as grams, volumes as millilitres
    const base = n.per === '100g' ? (kind === 'mass' ? convertQuantity(ing.quantity, ing.unit, 'g') : null)
      : (kind === 'volume' ? convertQuantity(ing.quantity, ing.unit, 'ml') : null);
    if (base === null || base === undefined || !canonicalUnit(ing.unit)) continue;
    kcal += (base / 100) * n.kcal;
    protein += (base / 100) * (n.protein ?? 0);
    covered++;
  }
  if (covered === 0 || servings <= 0) return null;
  return {
    kcalPerServing: Math.round(kcal / servings),
    proteinPerServing: protein > 0 ? Math.round(protein / servings) : undefined,
    covered,
    total: recipe.ingredients.length,
  };
}
