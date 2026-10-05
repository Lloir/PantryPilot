import React, { useState, useMemo } from 'react';
import { 
  UtensilsCrossed, 
  Sparkles, 
  Clock, 
  Users, 
  DollarSign, 
  Check, 
  AlertCircle, 
  Filter, 
  Flame, 
  Search, 
  ChevronRight, 
  CalendarPlus, 
  Layers, 
  CheckCircle2,
  XCircle,
  PlusCircle,
  RotateCcw,
  ChefHat
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { InventoryItem, Recipe, RecipeIngredient } from '../types';
import { calculateRecipeCostAndMatch, RecipeCostBreakdown } from '../utils/costCalculator';
import { suggestRecipesApi } from '../services/apiService';

interface RecipeDatabaseProps {
  inventory: InventoryItem[];
  recipes: Recipe[];
  onCookMeal: (recipe: Recipe, servingsCooked: number, costBreakdown: RecipeCostBreakdown) => void;
  onAddPlannedMeal: (recipe: Recipe, date: string, slot: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack', servings: number) => void;
  onAddNewRecipe: (recipe: Recipe) => void;
  initialSearchQuery?: string;
}

const MEAL_TYPES = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
const CUISINES = ['All', 'Asian', 'Italian', 'Mexican', 'Mediterranean', 'American'] as const;

export const RecipeDatabase: React.FC<RecipeDatabaseProps> = ({
  inventory,
  recipes,
  onCookMeal,
  onAddPlannedMeal,
  onAddNewRecipe,
  initialSearchQuery = '',
}) => {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [stockAvailabilityFilter, setStockAvailabilityFilter] = useState<'All' | 'canCookNow' | 'missingOne'>('canCookNow');
  const [selectedMealType, setSelectedMealType] = useState<string>('All');
  const [selectedCuisine, setSelectedCuisine] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'recommendation' | 'cheapest' | 'fastest' | 'name'>('recommendation');

  // Modal states
  const [selectedRecipeDetail, setSelectedRecipeDetail] = useState<Recipe | null>(null);
  const [servingsOverride, setServingsOverride] = useState<number>(2);

  // Plan Meal Modal inside Recipe
  const [planningRecipe, setPlanningRecipe] = useState<Recipe | null>(null);
  const [planDate, setPlanDate] = useState('2026-10-05');
  const [planSlot, setPlanSlot] = useState<'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'>('Dinner');
  const [planServings, setPlanServings] = useState(2);

  // Custom Recipe Creator Modal
  const [isCreateRecipeOpen, setIsCreateRecipeOpen] = useState(false);
  const [newRecName, setNewRecName] = useState('');
  const [newRecDesc, setNewRecDesc] = useState('');
  const [newRecMealType, setNewRecMealType] = useState<'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'>('Dinner');
  const [newRecCuisine, setNewRecCuisine] = useState('American');
  const [newRecServings, setNewRecServings] = useState(2);
  const [newRecPrep, setNewRecPrep] = useState(10);
  const [newRecCook, setNewRecCook] = useState(15);
  const [newRecIngredients, setNewRecIngredients] = useState<{ name: string; quantity: number; unit: string }[]>([
    { name: '', quantity: 1, unit: 'count' }
  ]);
  const [newRecInstructions, setNewRecInstructions] = useState<string>('');

  // AI Suggestion State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Calculate costs and matches for all recipes
  const recipeAnalyses = useMemo(() => {
    return recipes.map(recipe => {
      const breakdown = calculateRecipeCostAndMatch(recipe, inventory);
      return { recipe, breakdown };
    });
  }, [recipes, inventory]);

  // Filter & sort recipes
  const filteredRecipes = useMemo(() => {
    return recipeAnalyses
      .filter(({ recipe, breakdown }) => {
        const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          recipe.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          recipe.cuisine.toLowerCase().includes(searchQuery.toLowerCase()) ||
          recipe.ingredients.some(ing => ing.name.toLowerCase().includes(searchQuery.toLowerCase()));

        let matchesStock = true;
        if (stockAvailabilityFilter === 'canCookNow') {
          matchesStock = breakdown.canMakeNow;
        } else if (stockAvailabilityFilter === 'missingOne') {
          matchesStock = breakdown.missingCount <= 1;
        }

        const matchesMealType = selectedMealType === 'All' || recipe.mealType === selectedMealType;
        const matchesCuisine = selectedCuisine === 'All' || recipe.cuisine === selectedCuisine;

        return matchesSearch && matchesStock && matchesMealType && matchesCuisine;
      })
      .sort((a, b) => {
        if (sortBy === 'recommendation') {
          // Weight: urgencyScore (expiring ingredients!) * 2 + canMakeNow (50) + matchPercentage + abundanceScore
          const scoreA = (a.breakdown.canMakeNow ? 60 : 0) + (a.breakdown.urgencyScore * 2) + a.breakdown.matchPercentage + a.breakdown.abundanceScore;
          const scoreB = (b.breakdown.canMakeNow ? 60 : 0) + (b.breakdown.urgencyScore * 2) + b.breakdown.matchPercentage + b.breakdown.abundanceScore;
          return scoreB - scoreA;
        }
        if (sortBy === 'cheapest') {
          return a.breakdown.costPerServing - b.breakdown.costPerServing;
        }
        if (sortBy === 'fastest') {
          return (a.recipe.prepTimeMinutes + a.recipe.cookTimeMinutes) - (b.recipe.prepTimeMinutes + b.recipe.cookTimeMinutes);
        }
        if (sortBy === 'name') {
          return a.recipe.name.localeCompare(b.recipe.name);
        }
        return 0;
      });
  }, [recipeAnalyses, searchQuery, stockAvailabilityFilter, selectedMealType, selectedCuisine, sortBy]);

  // High priority "Urgent Expiry Saver" recipes
  const urgentRecipes = useMemo(() => {
    return recipeAnalyses
      .filter(({ breakdown }) => breakdown.expiringIngredientsUsed.length > 0)
      .sort((a, b) => b.breakdown.urgencyScore - a.breakdown.urgencyScore);
  }, [recipeAnalyses]);

  const handleOpenDetail = (recipe: Recipe) => {
    setSelectedRecipeDetail(recipe);
    setServingsOverride(recipe.servings);
  };

  const handleCookFromDetail = () => {
    if (!selectedRecipeDetail) return;
    const breakdown = calculateRecipeCostAndMatch(selectedRecipeDetail, inventory, servingsOverride);
    
    // Confetti celebration!
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (e) {
      // ignore
    }

    onCookMeal(selectedRecipeDetail, servingsOverride, breakdown);
    setSelectedRecipeDetail(null);
  };

  const handleAiSuggest = async () => {
    setIsGeneratingAi(true);
    setAiError(null);
    try {
      const generated = await suggestRecipesApi(
        inventory,
        selectedMealType !== 'All' ? selectedMealType : undefined,
        selectedCuisine !== 'All' ? selectedCuisine : undefined
      );

      if (generated && generated.length > 0) {
        generated.forEach(r => onAddNewRecipe(r));
        setStockAvailabilityFilter('All');
        // Confetti!
        confetti({ particleCount: 50, spread: 50 });
      }
    } catch (err: any) {
      console.error('AI suggest error:', err);
      setAiError(err.message || 'Failed to generate recipe with AI');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSaveCustomRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecName.trim()) return;

    const validIngredients = newRecIngredients
      .filter(i => i.name.trim().length > 0)
      .map(i => ({ name: i.name.trim(), quantity: i.quantity, unit: i.unit }));

    if (validIngredients.length === 0) {
      alert('Please add at least one ingredient');
      return;
    }

    const steps = newRecInstructions
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const recipe: Recipe = {
      id: `custom-rec-${Date.now()}`,
      name: newRecName.trim(),
      description: newRecDesc.trim() || 'Custom created recipe from kitchen pantry.',
      mealType: newRecMealType,
      cuisine: newRecCuisine,
      servings: newRecServings,
      prepTimeMinutes: newRecPrep,
      cookTimeMinutes: newRecCook,
      ingredients: validIngredients,
      instructions: steps.length > 0 ? steps : ['Cook and enjoy your meal!'],
      tags: ['Custom Recipe'],
    };

    onAddNewRecipe(recipe);
    setIsCreateRecipeOpen(false);
    // Reset form
    setNewRecName('');
    setNewRecDesc('');
    setNewRecIngredients([{ name: '', quantity: 1, unit: 'count' }]);
    setNewRecInstructions('');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner: Urgency & AI Chef Hero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Urgent Expiry Alert Box */}
        <div className="md:col-span-2 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white p-5 rounded-2xl border border-amber-200 shadow-2xs">
          <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm mb-1">
            <Flame className="w-4 h-4 text-amber-600 animate-bounce" />
            <span>Smart Expiration Prioritization</span>
          </div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Cook meals that save items before they expire
          </h2>
          <p className="text-xs text-stone-600 mt-1 max-w-xl">
            PantryPal analyzes expiration dates and abundant pantry staples. Recipes below are prioritized to save fresh spinach, ripe avocados, strawberries, and chicken before spoilage.
          </p>

          {urgentRecipes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs font-semibold text-amber-800 self-center">Top Expiry Savers:</span>
              {urgentRecipes.slice(0, 3).map(({ recipe, breakdown }) => (
                <button
                  key={recipe.id}
                  onClick={() => handleOpenDetail(recipe)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-white border border-amber-300 text-stone-800 hover:bg-amber-100/60 text-xs font-semibold shadow-2xs transition-colors"
                >
                  <span>{recipe.name}</span>
                  <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    Uses {breakdown.expiringIngredientsUsed[0]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI Chef Card */}
        <div className="bg-gradient-to-br from-emerald-700 to-teal-800 text-white p-5 rounded-2xl shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-emerald-200 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>Gemini 3.8 Flash Chef</span>
            </div>
            <h3 className="text-base font-bold mt-1">Smart Recipe Ideation</h3>
            <p className="text-xs text-emerald-100/80 mt-1">
              Ask AI to invent custom recipes explicitly tailored around what is in your fridge today.
            </p>
          </div>

          <div className="mt-4">
            <button
              onClick={handleAiSuggest}
              disabled={isGeneratingAi}
              className="w-full py-2 px-3 bg-white hover:bg-emerald-50 text-emerald-900 font-bold rounded-xl text-xs sm:text-sm inline-flex items-center justify-center space-x-2 shadow-xs transition-colors disabled:opacity-70"
            >
              {isGeneratingAi ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Inventing Recipes...</span>
                </>
              ) : (
                <>
                  <ChefHat className="w-4 h-4 text-emerald-700" />
                  <span>Generate Custom AI Recipe</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {aiError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-800 text-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{aiError}</span>
        </div>
      )}

      {/* Search & Filtering Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipes by title, ingredient (e.g. spinach, chicken), or cuisine..."
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Create Custom Recipe Button */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setIsCreateRecipeOpen(true)}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center space-x-1.5 shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Custom Recipe</span>
            </button>
          </div>
        </div>

        {/* Stock Availability Tab Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setStockAvailabilityFilter('canCookNow')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 ${
                stockAvailabilityFilter === 'canCookNow'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ready to Cook (100% In Stock)</span>
            </button>

            <button
              onClick={() => setStockAvailabilityFilter('missingOne')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                stockAvailabilityFilter === 'missingOne'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <span>Missing ≤ 1 Ingredient</span>
            </button>

            <button
              onClick={() => setStockAvailabilityFilter('All')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                stockAvailabilityFilter === 'All'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <span>All Recipes ({recipes.length})</span>
            </button>
          </div>

          {/* Meal Type, Cuisine & Sort Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-stone-400">Meal:</span>
              <select
                value={selectedMealType}
                onChange={(e) => setSelectedMealType(e.target.value)}
                className="bg-transparent font-medium text-stone-800 focus:outline-hidden"
              >
                {MEAL_TYPES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-stone-400">Cuisine:</span>
              <select
                value={selectedCuisine}
                onChange={(e) => setSelectedCuisine(e.target.value)}
                className="bg-transparent font-medium text-stone-800 focus:outline-hidden"
              >
                {CUISINES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-stone-400">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent font-medium text-stone-800 focus:outline-hidden"
              >
                <option value="recommendation">Best Match (Expiry First)</option>
                <option value="cheapest">Lowest Cost per Serving</option>
                <option value="fastest">Quickest Cook Time</option>
                <option value="name">Recipe Name</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Recipe Cards Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-200 p-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-stone-900">No recipes matched your criteria</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Try switching filter to "All Recipes" or click the Gemini AI button to generate brand new meals from your ingredients!
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => {
                setStockAvailabilityFilter('All');
                setSelectedMealType('All');
                setSelectedCuisine('All');
                setSearchQuery('');
              }}
              className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg"
            >
              Show All Recipes
            </button>
            <button
              onClick={handleAiSuggest}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
            >
              Generate AI Recipe
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRecipes.map(({ recipe, breakdown }) => {
            const hasExpiringIng = breakdown.expiringIngredientsUsed.length > 0;
            const totalTime = recipe.prepTimeMinutes + recipe.cookTimeMinutes;

            return (
              <div
                key={recipe.id}
                className="bg-white rounded-2xl border border-stone-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5">
                  {/* Top Tags & Match Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                        {recipe.mealType}
                      </span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-50 text-stone-500 border border-stone-200">
                        {recipe.cuisine}
                      </span>
                    </div>

                    {breakdown.canMakeNow ? (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Ready to Cook</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        Missing {breakdown.missingCount}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 
                    onClick={() => handleOpenDetail(recipe)}
                    className="text-base font-bold text-stone-900 tracking-tight hover:text-emerald-700 cursor-pointer transition-colors"
                  >
                    {recipe.name}
                  </h3>
                  <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                    {recipe.description}
                  </p>

                  {/* Expiring Ingredients Alert Badge */}
                  {hasExpiringIng && (
                    <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center space-x-2 text-amber-900 text-xs">
                      <Flame className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="font-semibold text-[11px] truncate">
                        Saves expiring: {breakdown.expiringIngredientsUsed.join(', ')}!
                      </span>
                    </div>
                  )}

                  {/* Meta Stats Row */}
                  <div className="mt-3.5 grid grid-cols-3 gap-2 py-2 border-y border-stone-100 text-xs">
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase font-semibold block">Cost/Serving</span>
                      <span className="font-bold text-emerald-700">${breakdown.costPerServing.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase font-semibold block">Total Cost</span>
                      <span className="font-bold text-stone-800">${breakdown.totalCost.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase font-semibold block">Time</span>
                      <span className="font-medium text-stone-700 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-stone-400" />
                        <span>{totalTime}m</span>
                      </span>
                    </div>
                  </div>

                  {/* Ingredients Mini Checklist */}
                  <div className="mt-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Ingredients ({breakdown.inStockCount}/{recipe.ingredients.length} in stock):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {breakdown.ingredientDetails.map((detail, idx) => (
                        <span
                          key={idx}
                          className={`text-[10px] px-2 py-0.5 rounded-md flex items-center space-x-1 ${
                            detail.inStock && detail.hasEnoughQuantity
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200 line-through'
                          }`}
                        >
                          <span>{detail.ingredient.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
                  <button
                    onClick={() => handleOpenDetail(recipe)}
                    className="text-xs font-semibold text-stone-700 hover:text-emerald-700 transition-colors"
                  >
                    View Details & Cost
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setPlanningRecipe(recipe);
                        setPlanServings(recipe.servings);
                      }}
                      className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-200 rounded-lg transition-colors"
                      title="Add to Weekly Meal Plan"
                    >
                      <CalendarPlus className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setSelectedRecipeDetail(recipe);
                        setServingsOverride(recipe.servings);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                    >
                      Cook Now
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recipe Detail & Cost Breakdown Modal */}
      {selectedRecipeDetail && (() => {
        const detailBreakdown = calculateRecipeCostAndMatch(selectedRecipeDetail, inventory, servingsOverride);

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-stone-200 flex flex-col max-h-[92vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {selectedRecipeDetail.mealType}
                    </span>
                    <span className="text-xs font-medium text-stone-500">{selectedRecipeDetail.cuisine}</span>
                    {selectedRecipeDetail.isAiGenerated && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-semibold flex items-center space-x-1">
                        <Sparkles className="w-3 h-3" />
                        <span>AI Crafted</span>
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-stone-900 mt-1">{selectedRecipeDetail.name}</h2>
                </div>
                <button
                  onClick={() => setSelectedRecipeDetail(null)}
                  className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-200"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
                <p className="text-xs text-stone-600 leading-relaxed">{selectedRecipeDetail.description}</p>

                {/* Servings Stepper & Cost Metric Highlights */}
                <div className="grid grid-cols-3 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Servings</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <button
                        onClick={() => setServingsOverride(Math.max(1, servingsOverride - 1))}
                        className="w-6 h-6 rounded bg-white border border-stone-300 font-bold text-xs"
                      >
                        -
                      </button>
                      <span className="font-bold text-stone-900">{servingsOverride}</span>
                      <button
                        onClick={() => setServingsOverride(servingsOverride + 1)}
                        className="w-6 h-6 rounded bg-white border border-stone-300 font-bold text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Cost Per Serving</span>
                    <span className="text-base font-extrabold text-emerald-700 block mt-1">
                      ${detailBreakdown.costPerServing.toFixed(2)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Total Recipe Cost</span>
                    <span className="text-base font-extrabold text-stone-900 block mt-1">
                      ${detailBreakdown.totalCost.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Detailed Ingredient Cost Contribution Table */}
                <div>
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Ingredient Cost & Inventory Deduction Breakdown
                  </h4>
                  <div className="border border-stone-200 rounded-xl overflow-hidden text-xs">
                    <table className="min-w-full divide-y divide-stone-200">
                      <thead className="bg-stone-50 text-stone-600 font-semibold">
                        <tr>
                          <th className="py-2 px-3 text-left">Ingredient</th>
                          <th className="py-2 px-3 text-left">Required</th>
                          <th className="py-2 px-3 text-left">Pantry Stock</th>
                          <th className="py-2 px-3 text-right">Cost Contribution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 bg-white">
                        {detailBreakdown.ingredientDetails.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-semibold text-stone-800">
                              <div className="flex items-center space-x-1.5">
                                {item.inStock && item.hasEnoughQuantity ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                                )}
                                <span>{item.ingredient.name}</span>
                                {item.isExpiringSoon && (
                                  <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">
                                    Expiring!
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-stone-600">
                              {Number((item.requiredQuantity).toFixed(2))} {item.ingredient.unit}
                            </td>
                            <td className="py-2 px-3">
                              {item.matchedItem ? (
                                <span className={item.hasEnoughQuantity ? 'text-stone-700' : 'text-amber-700 font-bold'}>
                                  {item.matchedItem.quantity} {item.matchedItem.unit}
                                </span>
                              ) : (
                                <span className="text-red-600 font-semibold">0 in stock</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-stone-900">
                              ${item.cost.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Step-by-Step Instructions */}
                <div>
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Cooking Instructions
                  </h4>
                  <ol className="space-y-2 text-xs text-stone-700 list-decimal list-inside">
                    {selectedRecipeDetail.instructions.map((step, idx) => (
                      <li key={idx} className="leading-relaxed pl-1">
                        <span className="font-normal">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="px-6 py-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
                <button
                  onClick={() => {
                    setPlanningRecipe(selectedRecipeDetail);
                    setSelectedRecipeDetail(null);
                  }}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-xl text-xs font-semibold hover:bg-stone-100 flex items-center space-x-1.5"
                >
                  <CalendarPlus className="w-4 h-4 text-stone-500" />
                  <span>Add to Meal Plan</span>
                </button>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedRecipeDetail(null)}
                    className="px-4 py-2 text-stone-500 text-xs font-medium hover:text-stone-700"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleCookFromDetail}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-colors flex items-center space-x-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Cook Meal (Deduct Stock)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Plan Meal Dialog */}
      {planningRecipe && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <h3 className="text-base font-bold text-stone-900">Add to Weekly Meal Plan</h3>
            <p className="text-xs text-stone-500 mt-1">
              Select date and meal slot for <strong>{planningRecipe.name}</strong>
            </p>

            <div className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Date</label>
                <input
                  type="date"
                  value={planDate}
                  onChange={(e) => setPlanDate(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Meal Slot</label>
                <select
                  value={planSlot}
                  onChange={(e) => setPlanSlot(e.target.value as any)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                >
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Snack">Snack</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Servings</label>
                <input
                  type="number"
                  min="1"
                  value={planServings}
                  onChange={(e) => setPlanServings(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPlanningRecipe(null)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddPlannedMeal(planningRecipe, planDate, planSlot, planServings);
                    setPlanningRecipe(null);
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md"
                >
                  Confirm & Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Recipe Modal */}
      {isCreateRecipeOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="text-base font-bold text-stone-900">Add Custom Recipe</h3>
              <button onClick={() => setIsCreateRecipeOpen(false)} className="text-stone-400 hover:text-stone-600">✕</button>
            </div>

            <form onSubmit={handleSaveCustomRecipe} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Recipe Name</label>
                <input
                  type="text"
                  required
                  value={newRecName}
                  onChange={(e) => setNewRecName(e.target.value)}
                  placeholder="e.g. Grandma's Chicken Soup"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Meal Type</label>
                  <select
                    value={newRecMealType}
                    onChange={(e) => setNewRecMealType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  >
                    <option value="Breakfast">Breakfast</option>
                    <option value="Lunch">Lunch</option>
                    <option value="Dinner">Dinner</option>
                    <option value="Snack">Snack</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Cuisine</label>
                  <input
                    type="text"
                    value={newRecCuisine}
                    onChange={(e) => setNewRecCuisine(e.target.value)}
                    placeholder="e.g. Italian, Mexican, Asian"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Servings</label>
                  <input
                    type="number"
                    min="1"
                    value={newRecServings}
                    onChange={(e) => setNewRecServings(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Prep (mins)</label>
                  <input
                    type="number"
                    min="0"
                    value={newRecPrep}
                    onChange={(e) => setNewRecPrep(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Cook (mins)</label>
                  <input
                    type="number"
                    min="0"
                    value={newRecCook}
                    onChange={(e) => setNewRecCook(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Dynamic Ingredients list */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-stone-700">Ingredients</label>
                  <button
                    type="button"
                    onClick={() => setNewRecIngredients([...newRecIngredients, { name: '', quantity: 1, unit: 'count' }])}
                    className="text-xs text-emerald-700 font-bold hover:underline"
                  >
                    + Add Ingredient
                  </button>
                </div>
                <div className="space-y-2">
                  {newRecIngredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="Ingredient name (e.g. Chicken Breasts)"
                        value={ing.name}
                        onChange={(e) => {
                          const updated = [...newRecIngredients];
                          updated[idx].name = e.target.value;
                          setNewRecIngredients(updated);
                        }}
                        className="flex-1 px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs"
                      />
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="Qty"
                        value={ing.quantity}
                        onChange={(e) => {
                          const updated = [...newRecIngredients];
                          updated[idx].quantity = parseFloat(e.target.value) || 1;
                          setNewRecIngredients(updated);
                        }}
                        className="w-16 px-2 py-1.5 border border-stone-300 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Unit"
                        value={ing.unit}
                        onChange={(e) => {
                          const updated = [...newRecIngredients];
                          updated[idx].unit = e.target.value;
                          setNewRecIngredients(updated);
                        }}
                        className="w-16 px-2 py-1.5 border border-stone-300 rounded-lg text-xs"
                      />
                      {newRecIngredients.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewRecIngredients(newRecIngredients.filter((_, i) => i !== idx))}
                          className="text-stone-400 hover:text-red-600 px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Cooking Instructions (One step per line)
                </label>
                <textarea
                  rows={4}
                  value={newRecInstructions}
                  onChange={(e) => setNewRecInstructions(e.target.value)}
                  placeholder="1. Chop ingredients&#10;2. Heat oil in skillet&#10;3. Sauté and serve"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateRecipeOpen(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md"
                >
                  Save Recipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
