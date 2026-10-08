import { InventoryItem, PlannedMeal, ShoppingItem, ItemCategory } from '../types';
import { findMatchingInventoryItem, normalizeQuantity } from './costCalculator';

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
        // Find matching inventory item in our simulated stock
        const matchedEntry = Object.values(simulatedStock).find(s => {
          const invName = s.item.name.toLowerCase();
          const targetName = ing.name.toLowerCase();
          return invName.includes(targetName) || targetName.includes(invName);
        });

        if (matchedEntry) {
          const matchedItem = matchedEntry.item;
          const convertedNeeded = normalizeQuantity(ing.quantity, ing.unit, matchedItem.unit);
          const neededInStockUnit = convertedNeeded !== null ? convertedNeeded : ing.quantity;

          const previousQty = matchedEntry.currentQty;
          matchedEntry.currentQty = Number((matchedEntry.currentQty - neededInStockUnit).toFixed(2));

          const isDepleted = matchedEntry.currentQty <= 0;

          if (previousQty > 0 && isDepleted) {
            const deficit = Math.abs(matchedEntry.currentQty);
            const depEvent: DepletionEvent = {
              itemId: matchedItem.id,
              itemName: matchedItem.name,
              category: matchedItem.category,
              date: dateStr,
              mealName: meal.customName || 'Planned Meal',
              slot: meal.slot,
              deficitQuantity: Number(deficit.toFixed(2)),
              unit: matchedItem.unit,
              initialStock: matchedItem.quantity,
              finalRemaining: matchedEntry.currentQty
            };
            dayDepletions.push(depEvent);
            allDepletions.push(depEvent);
          }

          if (!dayItemsUsedMap[matchedItem.id]) {
            dayItemsUsedMap[matchedItem.id] = {
              itemName: matchedItem.name,
              quantityUsed: 0,
              unit: matchedItem.unit,
              remainingAfterDay: matchedEntry.currentQty,
              depleted: matchedEntry.currentQty <= 0
            };
          }
          dayItemsUsedMap[matchedItem.id].quantityUsed += neededInStockUnit;
          dayItemsUsedMap[matchedItem.id].remainingAfterDay = matchedEntry.currentQty;
          dayItemsUsedMap[matchedItem.id].depleted = matchedEntry.currentQty <= 0;
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
  // Aggregate total required quantities by ingredient name
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
      const key = ing.name.toLowerCase().trim();
      if (!neededMap[key]) {
        // Try finding category from inventory if available
        const match = findMatchingInventoryItem(ing.name, inventory);
        const category = match ? match.category : guessCategory(ing.name);

        neededMap[key] = {
          name: ing.name,
          totalRequired: 0,
          unit: ing.unit,
          category,
          neededForMeals: []
        };
      }
      neededMap[key].totalRequired += ing.quantity;
      neededMap[key].neededForMeals.push({
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
      const neededInStockUnit = convertedNeeded !== null ? convertedNeeded : needed.totalRequired;

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
