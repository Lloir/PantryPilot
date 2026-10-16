import { InventoryItem, PlannedMeal, ShoppingItem, ItemCategory } from '../types';
import { findMatchingInventoryItem, normalizeQuantity } from './costCalculator';
import { canonicalUnit } from './units';

export interface DepletionEvent {
  itemId: string;
  itemName: string;
  category: ItemCategory;
  date: string;
  mealName: string;
  slot: string;
  deficitQuantity: number;
  unit: string;
  initialStock: number;
  finalRemaining: number;
}

export interface DayForecast {
  date: string;
  dayName: string;
  plannedMeals: PlannedMeal[];
  itemsUsed: {
    itemName: string;
    quantityUsed: number;
    unit: string;
    remainingAfterDay: number;
    depleted: boolean;
  }[];
  depletions: DepletionEvent[];
}

export interface ForecastResult {
  dailyForecasts: DayForecast[];
  allDepletions: DepletionEvent[];
  projectedEndingStock: Record<string, { itemName: string; remainingQuantity: number; unit: string; initialQuantity: number }>;
}

export function forecastInventoryDeductions(
  inventory: InventoryItem[],
  plannedMeals: PlannedMeal[]
): ForecastResult {
  // Deep clone inventory for simulation
  const simulatedStock: Record<string, { item: InventoryItem; currentQty: number }> = {};
  inventory.forEach(item => {
    simulatedStock[item.id] = {
      item,
      currentQty: item.quantity
    };
  });

  // Sort meals chronologically by date
  const sortedMeals = [...plannedMeals].sort((a, b) => a.date.localeCompare(b.date));

  // Group by date
  const mealsByDate: Record<string, PlannedMeal[]> = {};
  sortedMeals.forEach(meal => {
    if (!mealsByDate[meal.date]) {
      mealsByDate[meal.date] = [];
    }
    mealsByDate[meal.date].push(meal);
  });

  const allDepletions: DepletionEvent[] = [];
  const dailyForecasts: DayForecast[] = [];

  const dateKeys = Object.keys(mealsByDate).sort();

  dateKeys.forEach(dateStr => {
    const meals = mealsByDate[dateStr];
    const dateObj = new Date(`${dateStr}T12:00:00`);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const dayItemsUsedMap: Record<string, { itemName: string; quantityUsed: number; unit: string; remainingAfterDay: number; depleted: boolean }> = {};
    const dayDepletions: DepletionEvent[] = [];

    meals.forEach(meal => {
      meal.ingredients.forEach(ing => {
        const matchedItem = findMatchingInventoryItem(ing.name, inventory);
        const matchedEntry = matchedItem ? simulatedStock[matchedItem.id] : undefined;

        if (matchedEntry) {
          const item = matchedEntry.item;
          const convertedNeeded = normalizeQuantity(ing.quantity, ing.unit, item.unit);
          if (convertedNeeded === null) {
            const depEvent: DepletionEvent = {
              itemId: `missing-${ing.name}`,
              itemName: ing.name,
              category: item.category,
              date: dateStr,
              mealName: meal.customName || 'Planned Meal',
              slot: meal.slot,
              deficitQuantity: ing.quantity,
              unit: ing.unit,
              initialStock: 0,
              finalRemaining: -ing.quantity
            };
            dayDepletions.push(depEvent);
            allDepletions.push(depEvent);
            return;
          }
          const neededInStockUnit = convertedNeeded;
          const previousQty = matchedEntry.currentQty;
          matchedEntry.currentQty = Number((matchedEntry.currentQty - neededInStockUnit).toFixed(2));

          const isDepleted = matchedEntry.currentQty <= 0;

          if (previousQty > 0 && isDepleted) {
            const deficit = Math.abs(matchedEntry.currentQty);
            const depEvent: DepletionEvent = {
              itemId: item.id,
              itemName: item.name,
              category: item.category,
              date: dateStr,
              mealName: meal.customName || 'Planned Meal',
              slot: meal.slot,
              deficitQuantity: Number(deficit.toFixed(2)),
              unit: item.unit,
              initialStock: item.quantity,
              finalRemaining: matchedEntry.currentQty
            };
            dayDepletions.push(depEvent);
            allDepletions.push(depEvent);
          }

          if (!dayItemsUsedMap[item.id]) {
            dayItemsUsedMap[item.id] = {
              itemName: item.name,
              quantityUsed: 0,
              unit: item.unit,
              remainingAfterDay: matchedEntry.currentQty,
              depleted: matchedEntry.currentQty <= 0
            };
          }
          dayItemsUsedMap[item.id].quantityUsed += neededInStockUnit;
          dayItemsUsedMap[item.id].remainingAfterDay = matchedEntry.currentQty;
          dayItemsUsedMap[item.id].depleted = matchedEntry.currentQty <= 0;
        } else {
          // Item not even in inventory at all!
          const depEvent: DepletionEvent = {
            itemId: `missing-${ing.name}`,
            itemName: ing.name,
            category: 'Pantry & Grains',
            date: dateStr,
            mealName: meal.customName || 'Planned Meal',
            slot: meal.slot,
            deficitQuantity: ing.quantity,
            unit: ing.unit,
            initialStock: 0,
            finalRemaining: -ing.quantity
          };
          dayDepletions.push(depEvent);
          allDepletions.push(depEvent);
        }
      });
    });

    dailyForecasts.push({
      date: dateStr,
      dayName,
      plannedMeals: meals,
      itemsUsed: Object.values(dayItemsUsedMap),
      depletions: dayDepletions
    });
  });

  const projectedEndingStock: Record<string, { itemName: string; remainingQuantity: number; unit: string; initialQuantity: number }> = {};
  Object.values(simulatedStock).forEach(entry => {
    projectedEndingStock[entry.item.id] = {
      itemName: entry.item.name,
      remainingQuantity: entry.currentQty,
      unit: entry.item.unit,
      initialQuantity: entry.item.quantity
    };
  });

  return {
    dailyForecasts,
    allDepletions,
    projectedEndingStock
  };
}

/**
 * Automatically generates a shopping list for ingredients needed for planned meals but not currently in stock
 */
export function generateShoppingListFromMealPlan(
  inventory: InventoryItem[],
  plannedMeals: PlannedMeal[]
): ShoppingItem[] {
  // Aggregate compatible quantities by ingredient name and unit.
  interface NeededAgg {
    name: string;
    totalRequired: number;
    unit: string;
    category: ItemCategory;
    neededForMeals: { mealName: string; date: string }[];
  }

  const neededMap: Record<string, NeededAgg> = {};

  plannedMeals.forEach(meal => {
    meal.ingredients.forEach(ing => {
      const nameKey = ing.name.toLowerCase().trim();
      let key = nameKey;
      let existing = neededMap[key];
      if (existing) {
        const converted = normalizeQuantity(ing.quantity, ing.unit, existing.unit);
        if (converted !== null) {
          existing.totalRequired += converted;
          existing.neededForMeals.push({ mealName: meal.customName || 'Planned Meal', date: meal.date });
          return;
        }
        key = `${nameKey}\u0000${canonicalUnit(ing.unit) || ing.unit.toLowerCase().trim()}`;
        existing = neededMap[key];
      }
      if (!existing) {
        // Try finding category from inventory if available
        const match = findMatchingInventoryItem(ing.name, inventory);
        const category = match ? match.category : guessCategory(ing.name);

        existing = neededMap[key] = {
          name: ing.name,
          totalRequired: 0,
          unit: ing.unit,
          category,
          neededForMeals: []
        };
      }
      existing.totalRequired += ing.quantity;
      existing.neededForMeals.push({
        mealName: meal.customName || 'Planned Meal',
        date: meal.date
      });
    });
  });

  const shoppingItems: ShoppingItem[] = [];

  Object.values(neededMap).forEach(needed => {
    const matchedItem = findMatchingInventoryItem(needed.name, inventory);

    if (!matchedItem) {
      // Completely missing from inventory
      const mealList = Array.from(new Set(needed.neededForMeals.map(m => m.mealName))).join(', ');

      shoppingItems.push({
        id: `shop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: needed.name,
        category: needed.category,
        quantity: Math.ceil(needed.totalRequired * 10) / 10,
        unit: needed.unit,
        // Not in the pantry, so there is no real price to show
        checked: false,
        reason: `Needed for: ${mealList}`,
        plannedDate: needed.neededForMeals[0]?.date
      });
    } else {
      // In inventory: check if total required exceeds current stock
      const convertedNeeded = normalizeQuantity(needed.totalRequired, needed.unit, matchedItem.unit);
      if (convertedNeeded === null) {
        const mealList = Array.from(new Set(needed.neededForMeals.map(m => m.mealName))).join(', ');
        shoppingItems.push({
          id: `shop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: needed.name,
          category: matchedItem.category,
          quantity: Math.ceil(needed.totalRequired * 10) / 10,
          unit: needed.unit,
          checked: false,
          reason: `Could not compare ${matchedItem.unit} in stock with ${needed.unit} needed for: ${mealList}`,
          plannedDate: needed.neededForMeals[0]?.date
        });
        return;
      }
      const neededInStockUnit = convertedNeeded;

      if (matchedItem.quantity < neededInStockUnit) {
        const deficit = Number((neededInStockUnit - matchedItem.quantity).toFixed(2));
        const estTotal = Number((deficit * (matchedItem.latestUnitPrice ?? matchedItem.unitPrice)).toFixed(2));
        const mealList = Array.from(new Set(needed.neededForMeals.map(m => m.mealName))).join(', ');

        shoppingItems.push({
          id: `shop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: matchedItem.name,
          category: matchedItem.category,
          quantity: Math.ceil(deficit * 10) / 10,
          unit: matchedItem.unit,
          estimatedCost: estTotal > 0 ? estTotal : undefined,
          checked: false,
          reason: `Current stock (${matchedItem.quantity} ${matchedItem.unit}) will run out for: ${mealList}`,
          plannedDate: needed.neededForMeals[0]?.date
        });
      }
    }
  });

  return shoppingItems;
}

function guessCategory(name: string): ItemCategory {
  const n = name.toLowerCase();
  if (n.includes('chicken') || n.includes('beef') || n.includes('pork') || n.includes('salmon') || n.includes('fish') || n.includes('shrimp')) {
    return 'Meat & Seafood';
  }
  if (n.includes('spinach') || n.includes('avocado') || n.includes('pepper') || n.includes('onion') || n.includes('garlic') || n.includes('tomato') || n.includes('strawberry') || n.includes('lettuce')) {
    return 'Produce';
  }
  if (n.includes('egg') || n.includes('milk') || n.includes('cheese') || n.includes('yogurt') || n.includes('butter') || n.includes('cream')) {
    return 'Dairy & Eggs';
  }
  if (n.includes('rice') || n.includes('pasta') || n.includes('flour') || n.includes('oats') || n.includes('quinoa')) {
    return 'Pantry & Grains';
  }
  if (n.includes('can') || n.includes('beans') || n.includes('crushed tomato') || n.includes('soup')) {
    return 'Canned & Jarred';
  }
  if (n.includes('oil') || n.includes('sauce') || n.includes('salt') || n.includes('pepper') || n.includes('spice') || n.includes('vinegar')) {
    return 'Spices & Condiments';
  }
  return 'Produce';
}
