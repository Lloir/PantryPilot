/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  InventoryItem, 
  Recipe, 
  PlannedMeal, 
  CookedMealLog, 
  ShoppingItem, 
  ItemCategory, 
  StorageLocation 
} from './types';
import { 
  INITIAL_INVENTORY, 
  INITIAL_RECIPES, 
  INITIAL_PLANNED_MEALS, 
  INITIAL_COOKED_LOGS 
} from './data/initialData';
import { calculateRecipeCostAndMatch, RecipeCostBreakdown, normalizeQuantity, findMatchingInventoryItem } from './utils/costCalculator';
import { forecastInventoryDeductions, generateShoppingListFromMealPlan } from './utils/inventoryForecaster';
import { Navbar, ActiveTab } from './components/Navbar';
import { InventoryManager } from './components/InventoryManager';
import { RecipeDatabase } from './components/RecipeDatabase';
import { MealPlanner } from './components/MealPlanner';
import { ShoppingListView } from './components/ShoppingListView';
import { CostAnalytics } from './components/CostAnalytics';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { AndroidInstallBanner } from './components/AndroidInstallBanner';
import { AndroidAPKModal } from './components/AndroidAPKModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('inventory');
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');

  // Modals
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isAPKModalOpen, setIsAPKModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Android shortcuts handling on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      const tab = params.get('tab');

      if (action === 'scan-receipt') {
        setIsReceiptModalOpen(true);
      } else if (action === 'scan-barcode') {
        setIsBarcodeModalOpen(true);
      }

      if (tab && ['inventory', 'recipes', 'planner', 'shopping', 'analytics'].includes(tab)) {
        setActiveTab(tab as ActiveTab);
      }
    } catch (e) {}
  }, []);

  // Core persistent state
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('pantrypal_inventory');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_INVENTORY;
  });

  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    try {
      const saved = localStorage.getItem('pantrypal_recipes');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_RECIPES;
  });

  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>(() => {
    try {
      const saved = localStorage.getItem('pantrypal_planned_meals');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_PLANNED_MEALS;
  });

  const [cookedLogs, setCookedLogs] = useState<CookedMealLog[]>(() => {
    try {
      const saved = localStorage.getItem('pantrypal_cooked_logs');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_COOKED_LOGS;
  });

  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => {
    try {
      const saved = localStorage.getItem('pantrypal_shopping_list');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    // Initial generated from plan
    return generateShoppingListFromMealPlan(INITIAL_INVENTORY, INITIAL_PLANNED_MEALS);
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pantrypal_inventory', JSON.stringify(inventory));
    } catch (e) {}
  }, [inventory]);

  useEffect(() => {
    try {
      localStorage.setItem('pantrypal_recipes', JSON.stringify(recipes));
    } catch (e) {}
  }, [recipes]);

  useEffect(() => {
    try {
      localStorage.setItem('pantrypal_planned_meals', JSON.stringify(plannedMeals));
    } catch (e) {}
  }, [plannedMeals]);

  useEffect(() => {
    try {
      localStorage.setItem('pantrypal_cooked_logs', JSON.stringify(cookedLogs));
    } catch (e) {}
  }, [cookedLogs]);

  useEffect(() => {
    try {
      localStorage.setItem('pantrypal_shopping_list', JSON.stringify(shoppingList));
    } catch (e) {}
  }, [shoppingList]);

  // Toast feedback helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Badges calculations
  const today = useMemo(() => new Date('2026-10-05T00:00:00'), []);

  const expiringCount = useMemo(() => {
    return inventory.filter(item => {
      if (!item.expirationDate) return false;
      const expDate = new Date(`${item.expirationDate}T00:00:00`);
      const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 3 && diffDays >= 0;
    }).length;
  }, [inventory, today]);

  const readyToCookCount = useMemo(() => {
    return recipes.filter(r => {
      const breakdown = calculateRecipeCostAndMatch(r, inventory);
      return breakdown.canMakeNow;
    }).length;
  }, [recipes, inventory]);

  const forecast = useMemo(() => {
    return forecastInventoryDeductions(inventory, plannedMeals);
  }, [inventory, plannedMeals]);

  // Inventory actions
  const handleUpdateItem = (updated: InventoryItem) => {
    setInventory(prev => prev.map(item => item.id === updated.id ? updated : item));
    showToast(`Updated "${updated.name}"`);
  };

  const handleDeleteItem = (id: string) => {
    const item = inventory.find(i => i.id === id);
    setInventory(prev => prev.filter(i => i.id !== id));
    if (item) showToast(`Removed "${item.name}" from inventory`);
  };

  const handleAddItem = (newItem: Omit<InventoryItem, 'id'>) => {
    const item: InventoryItem = {
      ...newItem,
      id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setInventory(prev => [item, ...prev]);
    showToast(`Added "${item.name}" to inventory`);
  };

  const handleBulkAddFromReceipt = (items: {
    name: string;
    category: ItemCategory;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalCost: number;
    purchaseDate: string;
    expirationDate: string;
    location: StorageLocation;
    notes?: string;
  }[]) => {
    const newItems: InventoryItem[] = items.map(it => ({
      ...it,
      id: `inv-rec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    }));

    setInventory(prev => [...newItems, ...prev]);
    showToast(`Successfully added ${newItems.length} items from receipt to your inventory!`);
  };

  // Cook Meal & Deduct Inventory logic
  const handleCookMeal = (recipe: Recipe, servingsCooked: number, costBreakdown: RecipeCostBreakdown) => {
    const servingRatio = servingsCooked / recipe.servings;
    const deductedItemsLog: CookedMealLog['deductedItems'] = [];
    let updatedInventory = [...inventory];

    recipe.ingredients.forEach(ing => {
      const requiredQty = ing.quantity * servingRatio;
      const matched = findMatchingInventoryItem(ing.name, updatedInventory);

      if (matched) {
        const convertedNeeded = normalizeQuantity(requiredQty, ing.unit, matched.unit);
        const neededInStockUnit = convertedNeeded !== null ? convertedNeeded : requiredQty;

        const newQty = Math.max(0, Number((matched.quantity - neededInStockUnit).toFixed(2)));
        const costDeducted = Math.min(matched.totalCost, Number((neededInStockUnit * matched.unitPrice).toFixed(2)));

        deductedItemsLog.push({
          inventoryItemId: matched.id,
          itemName: matched.name,
          quantityDeducted: Number(neededInStockUnit.toFixed(2)),
          unit: matched.unit,
          cost: costDeducted
        });

        // Update item in inventory
        updatedInventory = updatedInventory.map(item => {
          if (item.id === matched.id) {
            return {
              ...item,
              quantity: newQty,
              totalCost: Number((newQty * item.unitPrice).toFixed(2))
            };
          }
          return item;
        });
      }
    });

    setInventory(updatedInventory);

    // Create log entry
    const newLog: CookedMealLog = {
      id: `log-${Date.now()}`,
      recipeId: recipe.id,
      recipeName: recipe.name,
      cookedAt: new Date().toISOString(),
      servingsCooked,
      totalMealCost: costBreakdown.totalCost,
      costPerServing: costBreakdown.costPerServing,
      deductedItems: deductedItemsLog,
      notes: `Freshly cooked! Deducted ${deductedItemsLog.length} ingredients from inventory.`
    };

    setCookedLogs(prev => [newLog, ...prev]);
    showToast(`Cooked "${recipe.name}"! Deducted ingredients from stock. Total cost: $${costBreakdown.totalCost.toFixed(2)}`);
  };

  // Cook a planned meal directly from the planner
  const handleCookPlannedMeal = (plannedMeal: PlannedMeal) => {
    const rec = recipes.find(r => r.id === plannedMeal.recipeId);
    if (rec) {
      const breakdown = calculateRecipeCostAndMatch(rec, inventory, plannedMeal.servings);
      handleCookMeal(rec, plannedMeal.servings, breakdown);
    } else {
      // Custom meal deduction
      const newLog: CookedMealLog = {
        id: `log-${Date.now()}`,
        recipeName: plannedMeal.customName || 'Custom Planned Meal',
        cookedAt: new Date().toISOString(),
        servingsCooked: plannedMeal.servings,
        totalMealCost: 3.50 * plannedMeal.servings,
        costPerServing: 3.50,
        deductedItems: [],
        notes: 'Custom planned meal cooked'
      };
      setCookedLogs(prev => [newLog, ...prev]);
      showToast(`Cooked "${plannedMeal.customName}"!`);
    }

    // Remove from planner
    setPlannedMeals(prev => prev.filter(m => m.id !== plannedMeal.id));
  };

  // Meal Planner actions
  const handleAddPlannedMeal = (meal: Omit<PlannedMeal, 'id'>) => {
    const newPlannedMeal: PlannedMeal = {
      ...meal,
      id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setPlannedMeals(prev => [...prev, newPlannedMeal]);
    showToast(`Added "${meal.customName}" to meal plan on ${meal.date}`);
  };

  const handleAddPlannedMealFromRecipe = (recipe: Recipe, date: string, slot: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack', servings: number) => {
    const servingRatio = servings / recipe.servings;
    const scaledIngredients = recipe.ingredients.map(ing => ({
      ...ing,
      quantity: Number((ing.quantity * servingRatio).toFixed(2))
    }));

    handleAddPlannedMeal({
      date,
      slot,
      recipeId: recipe.id,
      customName: recipe.name,
      servings,
      ingredients: scaledIngredients
    });
  };

  const handleRemovePlannedMeal = (id: string) => {
    setPlannedMeals(prev => prev.filter(m => m.id !== id));
    showToast('Removed meal from plan');
  };

  const handleAutoGenerateShoppingList = (items: ShoppingItem[]) => {
    // Merge into current shopping list avoiding duplicate names
    setShoppingList(prev => {
      const existingNames = new Set(prev.map(i => i.name.toLowerCase()));
      const filteredNew = items.filter(i => !existingNames.has(i.name.toLowerCase()));
      return [...filteredNew, ...prev];
    });
    setActiveTab('shopping');
    showToast(`Generated shopping list with ${items.length} items needed for planned meals!`);
  };

  // Shopping List actions
  const handleToggleShoppingItem = (id: string) => {
    setShoppingList(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const handleDeleteShoppingItem = (id: string) => {
    setShoppingList(prev => prev.filter(item => item.id !== id));
  };

  const handleAddShoppingItem = (item: Omit<ShoppingItem, 'id' | 'checked'>) => {
    const newItem: ShoppingItem = {
      ...item,
      id: `shop-${Date.now()}`,
      checked: false,
    };
    setShoppingList(prev => [newItem, ...prev]);
    showToast(`Added "${item.name}" to shopping list`);
  };

  const handlePurchaseAndAddToInventory = (checkedItems: ShoppingItem[]) => {
    const todayStr = '2026-10-05';
    const newInvItems: InventoryItem[] = checkedItems.map(item => {
      // Estimate expiration date +14 days
      const expDate = new Date(`${todayStr}T00:00:00`);
      expDate.setDate(expDate.getDate() + 14);

      let location: StorageLocation = 'Pantry';
      if (['Produce', 'Dairy & Eggs', 'Meat & Seafood'].includes(item.category)) {
        location = 'Fridge';
      }

      return {
        id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: Number((item.estimatedCost / (item.quantity || 1)).toFixed(2)),
        totalCost: item.estimatedCost,
        purchaseDate: todayStr,
        expirationDate: expDate.toISOString().split('T')[0],
        location,
        notes: 'Purchased from shopping list'
      };
    });

    setInventory(prev => [...newInvItems, ...prev]);
    // Remove purchased items from shopping list
    setShoppingList(prev => prev.filter(item => !item.checked));
    showToast(`Moved ${newInvItems.length} purchased items to your pantry inventory!`);
  };

  // Recipe actions
  const handleAddNewRecipe = (recipe: Recipe) => {
    setRecipes(prev => [recipe, ...prev]);
    showToast(`Saved recipe "${recipe.name}"!`);
  };

  const handleUpdateRecipe = (updated: Recipe) => {
    setRecipes(prev => prev.map(r => r.id === updated.id ? updated : r));
    showToast(`Updated tags for "${updated.name}"`);
  };

  const handleSelectForRecipeSearch = (ingredientName: string) => {
    setRecipeSearchQuery(ingredientName);
    setActiveTab('recipes');
  };

  return (
    <div className="min-h-screen bg-stone-100/60 text-stone-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white pb-24 md:pb-12">
      {/* Android & PWA Installation Banner */}
      <AndroidInstallBanner onOpenAPKModal={() => setIsAPKModalOpen(true)} />

      {/* Offline Mode Indicator */}
      <OfflineIndicator />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-5 right-5 z-50 bg-stone-900 text-white text-xs sm:text-sm font-semibold px-4 py-3 rounded-2xl shadow-xl border border-stone-800 flex items-center space-x-2 animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        expiringCount={expiringCount}
        readyToCookCount={readyToCookCount}
        shoppingCount={shoppingList.length}
        depletionWarningsCount={forecast.allDepletions.length}
        onOpenReceiptScanner={() => setIsReceiptModalOpen(true)}
        onOpenBarcodeScanner={() => setIsBarcodeModalOpen(true)}
        onOpenAddItem={() => {
          setActiveTab('inventory');
        }}
        onShowAndroidInstall={() => setIsAPKModalOpen(true)}
      />

      {/* Main Tab Content */}
      <main className="flex-1">
        {activeTab === 'inventory' && (
          <InventoryManager
            inventory={inventory}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onAddItem={handleAddItem}
            onSelectForRecipeSearch={handleSelectForRecipeSearch}
            onOpenReceiptScanner={() => setIsReceiptModalOpen(true)}
            onOpenBarcodeScanner={() => setIsBarcodeModalOpen(true)}
          />
        )}

        {activeTab === 'recipes' && (
          <RecipeDatabase
            inventory={inventory}
            recipes={recipes}
            onCookMeal={handleCookMeal}
            onAddPlannedMeal={handleAddPlannedMealFromRecipe}
            onAddNewRecipe={handleAddNewRecipe}
            onUpdateRecipe={handleUpdateRecipe}
            initialSearchQuery={recipeSearchQuery}
          />
        )}

        {activeTab === 'planner' && (
          <MealPlanner
            inventory={inventory}
            recipes={recipes}
            plannedMeals={plannedMeals}
            onAddPlannedMeal={handleAddPlannedMeal}
            onRemovePlannedMeal={handleRemovePlannedMeal}
            onAutoGenerateShoppingList={handleAutoGenerateShoppingList}
            onCookPlannedMeal={handleCookPlannedMeal}
          />
        )}

        {activeTab === 'shopping' && (
          <ShoppingListView
            shoppingList={shoppingList}
            onToggleItem={handleToggleShoppingItem}
            onDeleteItem={handleDeleteShoppingItem}
            onAddItem={handleAddShoppingItem}
            onPurchaseAndAddToInventory={handlePurchaseAndAddToInventory}
          />
        )}

        {activeTab === 'analytics' && (
          <CostAnalytics
            cookedLogs={cookedLogs}
            inventory={inventory}
          />
        )}
      </main>

      {/* Mobile Android Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        expiringCount={expiringCount}
        readyToCookCount={readyToCookCount}
        shoppingCount={shoppingList.length}
        depletionWarningsCount={forecast.allDepletions.length}
        onOpenReceiptScanner={() => setIsReceiptModalOpen(true)}
        onOpenBarcodeScanner={() => setIsBarcodeModalOpen(true)}
      />

      {/* Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onAddItemsToInventory={handleBulkAddFromReceipt}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        onAddItemToInventory={(item) => {
          handleAddItem(item);
          setIsBarcodeModalOpen(false);
        }}
      />

      {/* Android APK Download & Hub Modal */}
      <AndroidAPKModal
        isOpen={isAPKModalOpen}
        onClose={() => setIsAPKModalOpen(false)}
      />
    </div>
  );
}
