import { InventoryItem, Recipe } from '../types';

// Foods a household might avoid. Matching uses what a product database says, plus the words in the name.
export const ALLERGEN_OPTIONS: { key: string; label: string }[] = [
  { key: 'gluten', label: 'Gluten' },
  { key: 'milk', label: 'Milk / dairy' },
  { key: 'eggs', label: 'Eggs' },
  { key: 'peanuts', label: 'Peanuts' },
  { key: 'nuts', label: 'Tree nuts' },
  { key: 'soy', label: 'Soy' },
  { key: 'fish', label: 'Fish' },
  { key: 'shellfish', label: 'Shellfish' },
  { key: 'sesame', label: 'Sesame' },
  { key: 'meat', label: 'Meat' },
];

export const allergenLabel = (key: string) => ALLERGEN_OPTIONS.find(o => o.key === key)?.label ?? key;

const NAME_RULES: [string, RegExp][] = [
  ['milk', /\b(milk|cheese|cheddar|mozzarella|parmesan|butter|cream|yogh?urt|whey|ghee|custard|ice cream|paneer|feta|ricotta)\b/i],
  ['eggs', /\b(eggs?|mayonnaise|mayo|meringue)\b/i],
  ['gluten', /\b(wheat|flour|bread|pasta|spaghetti|noodles?|barley|rye|couscous|bun|bagel|tortilla|cracker|biscuit|cereal|seitan|pizza|pastry|pie)\b/i],
  ['peanuts', /\bpeanuts?\b/i],
  ['nuts', /\b(almonds?|walnuts?|cashews?|pecans?|hazelnuts?|pistachios?|macadamia|brazil nuts?)\b/i],
  ['soy', /\b(soy|soya|tofu|edamame|miso|tempeh)\b/i],
  ['fish', /\b(fish|salmon|tuna|cod|haddock|anchov(y|ies)|sardines?|mackerel|trout|tilapia)\b/i],
  ['shellfish', /\b(shrimp|prawns?|crab|lobster|clams?|mussels?|oysters?|scallops?|squid|calamari)\b/i],
  ['sesame', /\b(sesame|tahini)\b/i],
  ['meat', /\b(chicken|beef|pork|lamb|turkey|bacon|sausages?|ham|steak|mince|veal|duck|salami|chorizo|burger)\b/i],
];

/** Allergen keys suggested by the words in a food's name. */
export function allergensFromName(name: string): string[] {
  return NAME_RULES.filter(([, re]) => re.test(name)).map(([k]) => k);
}

/** What a stocked item contains: the product database's list if it gave one, plus its name. */
export function itemAllergens(item: Pick<InventoryItem, 'name' | 'allergens'>): string[] {
  return Array.from(new Set([...(item.allergens ?? []), ...allergensFromName(item.name)]));
}

/** What a recipe contains, from its ingredient names and any matching stocked items. */
export function recipeAllergens(recipe: Recipe, findItem: (ingredientName: string) => InventoryItem | undefined): string[] {
  const found = new Set<string>();
  for (const ing of recipe.ingredients) {
    allergensFromName(ing.name).forEach(k => found.add(k));
    const item = findItem(ing.name);
    // a database's list only counts when the match is the same product, so use exact-name matches
    if (item && item.name.toLowerCase().trim() === ing.name.toLowerCase().trim()) item.allergens?.forEach(k => found.add(k));
  }
  return Array.from(found);
}

export const avoidedIn = (contains: string[], avoidList: string[]) => contains.filter(k => avoidList.includes(k));
