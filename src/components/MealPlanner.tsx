import React, { useState, useMemo } from 'react';
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  AlertTriangle, 
  ShoppingCart, 
  Check, 
  Trash2, 
  Sparkles, 
  Layers, 
  Utensils, 
  Clock, 
  TrendingDown, 
  PackageCheck,
  PackageX
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { InventoryItem, PlannedMeal, Recipe, ShoppingItem } from '../types';
import { mondayOfWeekISO, todayISO } from '../utils/inventoryMerge';
import { forecastInventoryDeductions, generateShoppingListFromMealPlan } from '../utils/inventoryForecaster';

interface MealPlannerProps {
  inventory: InventoryItem[];
  recipes: Recipe[];
  plannedMeals: PlannedMeal[];
  onAddPlannedMeal: (meal: Omit<PlannedMeal, 'id'>) => void;
  onAddPlannedMeals: (meals: Omit<PlannedMeal, 'id'>[]) => void;
  onRemovePlannedMeal: (id: string) => void;
  onAutoGenerateShoppingList: (shoppingItems: ShoppingItem[]) => void;
  onCookPlannedMeal: (meal: PlannedMeal) => void;
}

const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;

export const MealPlanner: React.FC<MealPlannerProps> = ({
  inventory,
  recipes,
  plannedMeals,
  onAddPlannedMeal,
  onAddPlannedMeals,
  onRemovePlannedMeal,
  onAutoGenerateShoppingList,
  onCookPlannedMeal,
}) => {
  // The planner opens on the Monday of the current week
  const currentWeekStart = () => new Date(`${mondayOfWeekISO(todayISO())}T00:00:00`);
  const [weekStartDate, setWeekStartDate] = useState<Date>(currentWeekStart);
  const [selectedSlotForAdd, setSelectedSlotForAdd] = useState<{ date: string; slot: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' } | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [customMealName, setCustomMealName] = useState<string>('');
  const [servings, setServings] = useState<number>(2);
  const [repeatDays, setRepeatDays] = useState<number>(1);

  // Generate 7 days of the week starting from weekStartDate
  const weekDays = useMemo(() => {
    const days: { dateStr: string; dayName: string; dayNum: number; isToday: boolean }[] = [];
    const todayStr = todayISO();

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStartDate);
      d.setDate(d.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      days.push({
        dateStr,
        dayName,
        dayNum,
        isToday: dateStr === todayStr
      });
    }
    return days;
  }, [weekStartDate]);

  // Forecast calculations
  const forecast = useMemo(() => {
    return forecastInventoryDeductions(inventory, plannedMeals);
  }, [inventory, plannedMeals]);

  // Generated shopping list preview
  const neededShoppingItems = useMemo(() => {
    return generateShoppingListFromMealPlan(inventory, plannedMeals);
  }, [inventory, plannedMeals]);

  const handlePrevWeek = () => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() - 7);
    setWeekStartDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + 7);
    setWeekStartDate(d);
  };

  const handleResetToCurrentWeek = () => {
    setWeekStartDate(currentWeekStart());
  };

  const handleConfirmAddMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotForAdd) return;

    const days = Math.min(14, Math.max(1, repeatDays));
    const totalServings = servings * days;
    const groupId = days > 1 ? `prep-${Date.now()}` : undefined;
    const addDays = (dateStr: string, n: number) => {
      const d = new Date(`${dateStr}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().split('T')[0];
    };

    let name = '';
    let recipeId: string | undefined;
    let ingredients: PlannedMeal['ingredients'] = [];

    if (selectedRecipeId) {
      const rec = recipes.find(r => r.id === selectedRecipeId);
      if (!rec) return;
      // Cook once for every day: ingredients are deducted a single time for the whole batch
      const ratio = totalServings / rec.servings;
      ingredients = rec.ingredients.map(ing => ({ ...ing, quantity: Number((ing.quantity * ratio).toFixed(2)) }));
      name = rec.name;
      recipeId = rec.id;
    } else if (customMealName.trim()) {
      name = customMealName.trim();
    } else {
      return;
    }

    const meals: Omit<PlannedMeal, 'id'>[] = [];
    for (let i = 0; i < days; i++) {
      meals.push({
        date: addDays(selectedSlotForAdd.date, i),
        slot: selectedSlotForAdd.slot,
        recipeId,
        customName: name,
        servings,
        ingredients: i === 0 ? ingredients : [],
        ...(groupId ? { prepGroupId: groupId, isLeftover: i > 0 } : {}),
        ...(groupId && i === 0 ? { batchServings: totalServings } : {}),
      });
    }
    onAddPlannedMeals(meals);

    setSelectedSlotForAdd(null);
    setSelectedRecipeId('');
    setCustomMealName('');
    setServings(2);
    setRepeatDays(1);
  };

  const handleTriggerAutoShopping = () => {
    if (neededShoppingItems.length === 0) {
      alert('All planned meals are 100% in stock! No additional grocery items needed.');
      return;
    }
    onAutoGenerateShoppingList(neededShoppingItems);
    try {
      confetti({ particleCount: 40, spread: 40 });
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Forecast Banner & Shopping List Trigger */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-stone-500 uppercase tracking-wider">
              <TrendingDown className="w-4 h-4 text-emerald-600" />
              <span>Inventory Deduction Forecast Engine</span>
            </div>
            <h2 className="text-lg font-bold text-stone-900 mt-1">
              Weekly Meal Plan & Stock Depletion Forecast
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              The engine simulates day-by-day ingredient consumption and predicts when items run low.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={handleTriggerAutoShopping}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center space-x-2"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Auto-Generate Shopping List ({neededShoppingItems.length})</span>
            </button>
          </div>
        </div>

        {/* Depletion Warnings Highlight Box */}
        {forecast.allDepletions.length > 0 ? (
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Forecasted Stock Shortages ({forecast.allDepletions.length} warnings detected):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
              {forecast.allDepletions.map((dep, idx) => (
                <div key={idx} className="bg-white p-2.5 rounded-lg border border-amber-200 text-xs shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900">{dep.itemName}</span>
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded">
                      Short by {dep.deficitQuantity} {dep.unit}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    Will run out on <strong>{dep.date}</strong> for <em>{dep.mealName}</em>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center space-x-2.5 text-xs text-emerald-800">
            <PackageCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              Healthy Stock! All planned ingredients are available in inventory for the selected week.
            </span>
          </div>
        )}
      </div>

      {/* Week Navigation Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="flex items-center space-x-2">
          <CalendarDays className="w-5 h-5 text-emerald-600" />
          <h3 className="text-base font-bold text-stone-900">
            Week of {weekDays[0].dayName} {weekDays[0].dayNum} - {weekDays[6].dayName} {weekDays[6].dayNum}
          </h3>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleResetToCurrentWeek}
            className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={handlePrevWeek}
            className="p-1.5 text-stone-600 hover:bg-stone-100 rounded-lg border border-stone-200"
            title="Previous Week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNextWeek}
            className="p-1.5 text-stone-600 hover:bg-stone-100 rounded-lg border border-stone-200"
            title="Next Week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 7-Day Weekly Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map(day => {
          const dayMeals = plannedMeals.filter(m => m.date === day.dateStr);
          const dayDepletions = forecast.allDepletions.filter(d => d.date === day.dateStr);

          return (
            <div
              key={day.dateStr}
              className={`bg-white rounded-2xl border flex flex-col min-h-[460px] shadow-2xs ${
                day.isToday ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-stone-200'
              }`}
            >
              {/* Day Header */}
              <div className={`p-3 border-b text-center rounded-t-2xl ${
                day.isToday ? 'bg-emerald-600 text-white' : 'bg-stone-50 text-stone-800 border-stone-200'
              }`}>
                <span className="text-xs font-bold uppercase tracking-wider block opacity-80">
                  {day.dayName}
                </span>
                <span className="text-lg font-extrabold block">
                  {day.dayNum}
                </span>
                {day.isToday && (
                  <span className="text-[10px] bg-white/20 px-2 py-0.2 rounded-full font-bold inline-block mt-0.5">
                    Today
                  </span>
                )}
              </div>

              {/* Day Shortage Warning Pill if any */}
              {dayDepletions.length > 0 && (
                <div className="m-2 p-1.5 bg-amber-100 border border-amber-300 rounded-lg text-[10px] font-bold text-amber-900 flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                  <span className="truncate">Deficit: {dayDepletions[0].itemName}</span>
                </div>
              )}

              {/* Meal Slots */}
              <div className="p-2 space-y-2 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  {SLOTS.map(slot => {
                    const slotMeals = dayMeals.filter(m => m.slot === slot);

                    return (
                      <div key={slot} className="space-y-1">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                            {slot}
                          </span>
                          <button
                            onClick={() => setSelectedSlotForAdd({ date: day.dateStr, slot })}
                            className="text-stone-400 hover:text-emerald-700 p-0.5 rounded"
                            title={`Add ${slot}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {slotMeals.length > 0 ? (
                          slotMeals.map(meal => (
                            <div
                              key={meal.id}
                              className="p-2 bg-stone-50 hover:bg-emerald-50/50 rounded-xl border border-stone-200 text-xs space-y-1 group transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <span className="font-bold text-stone-900 leading-tight">
                                  {meal.customName}
                                  {meal.isLeftover && (
                                    <span className="ml-1 text-[9px] font-bold uppercase text-sky-700 bg-sky-50 border border-sky-200 px-1 rounded">
                                      Leftover
                                    </span>
                                  )}
                                </span>
                                <button
                                  onClick={() => onRemovePlannedMeal(meal.id)}
                                  className="text-stone-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                  title="Remove from plan"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-stone-500 pt-0.5">
                                <span>{meal.batchServings ? `${meal.servings}/day · cook ${meal.batchServings}` : `${meal.servings} serv`}</span>
                                <button
                                  onClick={() => onCookPlannedMeal(meal)}
                                  className="font-bold text-emerald-700 hover:underline"
                                  title={meal.isLeftover ? 'Mark as eaten (nothing to deduct)' : 'Cook this meal now and deduct items'}
                                >
                                  {meal.isLeftover ? 'Eat' : meal.batchServings ? 'Cook batch' : 'Cook'}
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <button
                            onClick={() => setSelectedSlotForAdd({ date: day.dateStr, slot })}
                            className="w-full py-1 text-[11px] text-stone-400 hover:text-emerald-700 hover:bg-stone-50 rounded-lg border border-dashed border-stone-200 transition-colors"
                          >
                            + Plan
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Planned Meal Modal */}
      {selectedSlotForAdd && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <h3 className="text-base font-bold text-stone-900">
              Plan {selectedSlotForAdd.slot} on {selectedSlotForAdd.date}
            </h3>

            <form onSubmit={handleConfirmAddMeal} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Select from Recipe Database</label>
                <select
                  value={selectedRecipeId}
                  onChange={(e) => {
                    setSelectedRecipeId(e.target.value);
                    if (e.target.value) setCustomMealName('');
                  }}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Choose a Recipe --</option>
                  {recipes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.mealType} • {r.cuisine})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-stone-200"></div>
                <span className="shrink mx-2 text-stone-400 text-[10px] uppercase font-bold">Or Custom Meal</span>
                <div className="grow border-t border-stone-200"></div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Custom Meal Title</label>
                <input
                  type="text"
                  placeholder="e.g. Leftover Roast Chicken & Salad"
                  value={customMealName}
                  onChange={(e) => {
                    setCustomMealName(e.target.value);
                    if (e.target.value) setSelectedRecipeId('');
                  }}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Servings per day</label>
                  <input
                    type="number"
                    min="1"
                    value={servings}
                    onChange={(e) => setServings(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Populate next X days</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={repeatDays}
                    onChange={(e) => setRepeatDays(Math.min(14, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              {repeatDays > 1 && (
                <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  Meal prep: cook once on {selectedSlotForAdd.date} ({servings * repeatDays} servings total), then
                  {' '}{servings} serving{servings === 1 ? '' : 's'} of leftovers are planned in the same slot for each of the next {repeatDays - 1} day{repeatDays - 1 === 1 ? '' : 's'}.
                  Ingredients are deducted once, when you cook.
                </p>
              )}

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedSlotForAdd(null)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedRecipeId && !customMealName.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md"
                >
                  Add to Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
