import { parseIngredientLine } from './ingredientParser';

/** What the server sends back for an imported recipe (ingredient lines are still plain text). */
export interface ImportedRecipe {
  name: string;
  description: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: string[];
  instructions: string[];
  cuisine: string;
  category: string;
  keywords: string[];
  sourceUrl?: string;
}

export interface RecipeDraft {
  name: string;
  description: string;
  mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  cuisine: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  tags: string[];
  ingredients: { name: string; quantity: number; unit: string }[];
  instructions: string;
}

function guessMealType(category: string, name: string): RecipeDraft['mealType'] {
  const t = `${category} ${name}`.toLowerCase();
  if (/breakfast|brunch|pancake|waffle|porridge|oatmeal/.test(t)) return 'Breakfast';
  if (/lunch|sandwich|salad/.test(t)) return 'Lunch';
  if (/dessert|snack|appetizer|starter|cookie|brownie|cake|dip/.test(t)) return 'Snack';
  return 'Dinner';
}

/** Turns an imported recipe into the values the "Add Custom Recipe" form needs, so it can be reviewed before saving. */
export function toRecipeDraft(r: ImportedRecipe): RecipeDraft {
  const source = r.sourceUrl ? `\n\nSource: ${r.sourceUrl}` : '';
  const tags = Array.from(new Set(['Imported', r.category, ...r.keywords].map(t => t.trim()).filter(t => t && t.length <= 24))).slice(0, 6);
  return {
    name: r.name,
    description: (r.description || 'Imported recipe.') + source,
    mealType: guessMealType(r.category, r.name),
    cuisine: r.cuisine || 'American',
    servings: r.servings && r.servings > 0 ? r.servings : 2,
    prepMinutes: r.prepMinutes ?? 10,
    cookMinutes: r.cookMinutes ?? 20,
    tags,
    ingredients: r.ingredients.map(parseIngredientLine),
    instructions: r.instructions.join('\n'),
  };
}
