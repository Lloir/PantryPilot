/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  InventoryItem, 
  Recipe, 
  PlannedMeal, 
  CookedMealLog, 
  ShoppingItem, 
  ItemCategory, 
  StorageLocation,
  PurchaseLog,
  RewardsEntry,
  AppSettings,
  DEFAULT_SETTINGS
} from './types';
import { SettingsProvider } from './context/SettingsContext';
import { useAuth } from './context/AuthContext';
import { mergeStates, SyncedState } from './utils/syncMerge';
import { ThemeChoice, loadTheme, saveTheme, applyTheme } from './utils/theme';
import { HouseholdRequest } from './types';
import { RequestsView } from './components/RequestsView';
import { HouseholdModal } from './components/HouseholdModal';
import { answerRequestApi, createRequestApi, deleteRequestApi, fetchRequestsApi } from './services/apiService';
import { mergeIntoInventory, normalizeInventory, syncInventoryBatches, estimateCostFromPantry, todayISO, addDaysISO } from './utils/inventoryMerge';
import { canonicalUnit } from './utils/units';
import { formatMoney } from './utils/currency';
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
import { UnraidModal } from './components/UnraidModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  const auth = useAuth();
  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('inventory');
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');

  // Modals
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isAPKModalOpen, setIsAPKModalOpen] = useState(false);
  const [isUnraidModalOpen, setIsUnraidModalOpen] = useState(false);
  const [isHouseholdOpen, setIsHouseholdOpen] = useState(false);
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

      if (tab && ['inventory', 'recipes', 'planner', 'shopping', 'analytics', 'requests'].includes(tab)) {
        setActiveTab(tab as ActiveTab);
      }
    } catch (e) {}
  }, []);

  // Ensure any previous test data is wiped from browser storage
  useEffect(() => {
    try {
      const version = localStorage.getItem('pantrypal_clean_v3');
      if (!version) {
        localStorage.removeItem('pantrypal_inventory');
        localStorage.removeItem('pantrypal_recipes');
        localStorage.removeItem('pantrypal_planned_meals');
        localStorage.removeItem('pantrypal_cooked_logs');
        localStorage.removeItem('pantrypal_shopping_list');
        localStorage.setItem('pantrypal_clean_v3', 'true');
        setInventory([]);
        setRecipes([]);
        setPlannedMeals([]);
        setCookedLogs([]);
        setShoppingList([]);
      }
    } catch (e) {}
  }, []);

  // Core persistent state - initialized empty for clean user database
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
    return [];
  });

  const loadLocal = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return fallback;
  };

  const [purchaseLogs, setPurchaseLogs] = useState<PurchaseLog[]>(() => loadLocal('pantrypal_purchase_logs', []));
  const [rewards, setRewards] = useState<RewardsEntry[]>(() => loadLocal('pantrypal_rewards', []));
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...loadLocal<Partial<AppSettings>>('pantrypal_settings', {}),
  }));
  // Theme is a per-device choice (not shared with the household)
  const [theme, setTheme] = useState<ThemeChoice>(loadTheme);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  // View-only members get a calmer screen: edit controls are hidden
  useEffect(() => {
    document.documentElement.classList.toggle('view-only', auth.role === 'viewer');
    return () => document.documentElement.classList.remove('view-only');
  }, [auth.role]);

  // Requests from the household (separate from the pantry data so view-only people can send them)
  const [requests, setRequests] = useState<HouseholdRequest[]>([]);
  useEffect(() => {
    const load = () => {
      if (document.hidden) return;
      fetchRequestsApi().then(setRequests).catch(() => {});
    };
    load();
    const id = setInterval(load, 10000);
    document.addEventListener('visibilitychange', load);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);
  const openRequestsCount = requests.filter(r => r.status === 'open').length;

  // True once the server copy has been loaded (or the server is unreachable)
  const [hydrated, setHydrated] = useState(false);

  // --- Shared household data -------------------------------------------------
  // The server keeps one copy for everyone. `revisionRef` is the version this device last
  // saw, `lastSyncedRef` the content of that version. Saves send the revision; if someone
  // else saved first the server answers 409 and the two sets of changes are merged.
  const revisionRef = useRef(0);
  const lastSyncedRef = useRef<SyncedState | null>(null);
  const savingRef = useRef(false);
  const latestRef = useRef<SyncedState>({ inventory, recipes, plannedMeals, cookedLogs, shoppingList, purchaseLogs, rewards, settings });
  latestRef.current = { inventory, recipes, plannedMeals, cookedLogs, shoppingList, purchaseLogs, rewards, settings };

  const toSyncedState = (data: any): SyncedState => ({
    inventory: Array.isArray(data?.inventory) ? data.inventory : [],
    recipes: Array.isArray(data?.recipes) ? data.recipes : [],
    plannedMeals: Array.isArray(data?.plannedMeals) ? data.plannedMeals : [],
    cookedLogs: Array.isArray(data?.cookedLogs) ? data.cookedLogs : [],
    shoppingList: Array.isArray(data?.shoppingList) ? data.shoppingList : [],
    purchaseLogs: Array.isArray(data?.purchaseLogs) ? data.purchaseLogs : [],
    rewards: Array.isArray(data?.rewards) ? data.rewards : [],
    settings: data?.settings && typeof data.settings === 'object' ? data.settings : {},
  });

  const applyState = (st: SyncedState) => {
    setInventory(st.inventory);
    setRecipes(st.recipes);
    setPlannedMeals(st.plannedMeals);
    setCookedLogs(st.cookedLogs);
    setShoppingList(st.shoppingList);
    setPurchaseLogs(st.purchaseLogs);
    setRewards(st.rewards);
    setSettings(prev => ({ ...prev, ...st.settings }));
  };

  const hasUnsavedChanges = () =>
    !lastSyncedRef.current || JSON.stringify(latestRef.current) !== JSON.stringify(lastSyncedRef.current);

  useEffect(() => {
    fetch('/api/pantry-data')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.revision > 0) {
          const server = toSyncedState(data);
          applyState(server);
          lastSyncedRef.current = server;
          revisionRef.current = data.revision;
        } else {
          // Brand new server: this device's data (if any) becomes the household's first copy
          revisionRef.current = 0;
          lastSyncedRef.current = toSyncedState(null);
        }
      })
      .catch(() => {
        // Backend offline or local-only mode
      })
      .finally(() => setHydrated(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick up changes other people made (every few seconds, and when you come back to the tab)
  useEffect(() => {
    if (!hydrated) return;
    const poll = () => {
      if (document.hidden || savingRef.current) return;
      fetch('/api/pantry-data')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || !(data.revision > revisionRef.current) || savingRef.current) return;
          // Our own unsaved edits are merged when they save (the server will answer 409)
          if (auth.role !== 'viewer' && hasUnsavedChanges()) return;
          const server = toSyncedState(data);
          revisionRef.current = data.revision;
          lastSyncedRef.current = server;
          applyState(server);
          if (data.updatedBy && data.updatedBy !== auth.user) showToast(`${data.updatedBy} updated the pantry`);
        })
        .catch(() => {});
    };
    const id = setInterval(poll, 8000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // One-time migration: standardize units, merge existing duplicate rows and
  // seed the purchase history from what is already in the pantry.
  useEffect(() => {
    if (!hydrated || settings.migratedV4) return;

    const normalized = normalizeInventory(inventory);
    setInventory(normalized.inventory);
    setRecipes(prev => prev.map(r => ({
      ...r,
      ingredients: r.ingredients.map(i => ({ ...i, unit: canonicalUnit(i.unit) || i.unit })),
    })));
    setPlannedMeals(prev => prev.map(m => ({
      ...m,
      ingredients: m.ingredients.map(i => ({ ...i, unit: canonicalUnit(i.unit) || i.unit })),
    })));
    setShoppingList(prev => prev.map(i => ({ ...i, unit: i.unit ? canonicalUnit(i.unit) || i.unit : i.unit })));

    if (purchaseLogs.length === 0) {
      const seeded = new Map<string, PurchaseLog>();
      inventory.forEach(it => {
        const date = it.purchaseDate;
        const cost = it.totalCost || it.quantity * it.unitPrice;
        if (!date || !(cost > 0)) return;
        const log = seeded.get(date) || {
          id: `hist-${date}`, date, total: 0, categoryTotals: {}, source: 'history' as const,
        };
        log.total = Number((log.total + cost).toFixed(2));
        log.categoryTotals[it.category] = Number(((log.categoryTotals[it.category] || 0) + cost).toFixed(2));
        seeded.set(date, log);
      });
      if (seeded.size > 0) setPurchaseLogs(Array.from(seeded.values()));
    }

    setSettings(prev => ({ ...prev, migratedV4: true }));
    if (normalized.merged > 0) {
      showToast(`Combined ${normalized.merged} duplicate pantry item${normalized.merged === 1 ? '' : 's'} into single entries`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const saveToServer = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    const snap = latestRef.current;
    try {
      const res = await fetch('/api/pantry-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...snap, baseRevision: revisionRef.current }),
      });
      if (res.ok) {
        const data = await res.json();
        revisionRef.current = data.revision;
        lastSyncedRef.current = snap;
      } else if (res.status === 409) {
        // Someone saved first: keep their changes and re-apply ours on top
        const { current } = await res.json();
        const server = toSyncedState(current);
        const merged = mergeStates(lastSyncedRef.current ?? toSyncedState(null), snap, server);
        revisionRef.current = current.revision;
        lastSyncedRef.current = server;
        applyState(merged);
        showToast(`Combined your changes with ${current.updatedBy || 'someone else'}'s`);
      } else if (res.status === 403) {
        showToast('You have view-only access, so that change was not saved');
      }
    } catch (e) {
      // offline: the next change tries again
    } finally {
      savingRef.current = false;
    }
  };

  // Save to the server (debounced). Nothing is sent when the data matches what the server has.
  useEffect(() => {
    if (!hydrated || auth.role === 'viewer') return; // never overwrite the server copy before it has been read
    if (!hasUnsavedChanges()) return;
    const timer = setTimeout(saveToServer, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, auth.role, inventory, recipes, plannedMeals, cookedLogs, shoppingList, purchaseLogs, rewards, settings]);

  useEffect(() => {
    try {
      localStorage.setItem('pantrypal_purchase_logs', JSON.stringify(purchaseLogs));
      localStorage.setItem('pantrypal_rewards', JSON.stringify(rewards));
      localStorage.setItem('pantrypal_settings', JSON.stringify(settings));
    } catch (e) {}
  }, [purchaseLogs, rewards, settings]);

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

  // Reset database function
  const handleClearAllData = () => {
    if (window.confirm('Clear all data from your pantry? This will reset all inventory, recipes, meal plans, purchase history, rewards and logs to empty.')) {
      setInventory([]);
      setRecipes([]);
      setPlannedMeals([]);
      setCookedLogs([]);
      setShoppingList([]);
      setPurchaseLogs([]);
      setRewards([]);
      try {
        localStorage.removeItem('pantrypal_purchase_logs');
        localStorage.removeItem('pantrypal_rewards');
        localStorage.removeItem('pantrypal_inventory');
        localStorage.removeItem('pantrypal_recipes');
        localStorage.removeItem('pantrypal_planned_meals');
        localStorage.removeItem('pantrypal_cooked_logs');
        localStorage.removeItem('pantrypal_shopping_list');
      } catch (e) {}
      showToast('All database items cleared');
    }
  };

  // Toast feedback helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Badges calculations
  // Re-checked every few minutes so the app notices when midnight passes
  const [todayStr, setTodayStr] = useState(todayISO());
  useEffect(() => {
    const id = setInterval(() => setTodayStr(todayISO()), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const today = useMemo(() => new Date(`${todayStr}T00:00:00`), [todayStr]);

  // Each item's expiration date follows its soonest unexpired batch
  useEffect(() => {
    if (!hydrated) return;
    const synced = syncInventoryBatches(inventory, todayStr);
    if (synced !== inventory) setInventory(synced);
  }, [hydrated, inventory, todayStr]);

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
    setInventory(prev => prev.map(item => {
      if (item.id !== updated.id) return item;
      // Typing a new expiration date by hand replaces the per-purchase dates
      if (updated.expirationDate !== item.expirationDate) {
        return { ...updated, batches: [{ quantity: updated.quantity, expirationDate: updated.expirationDate }] };
      }
      return updated;
    }));
    showToast(`Updated "${updated.name}"`);
  };

  const handleDeleteItem = (id: string) => {
    const item = inventory.find(i => i.id === id);
    setInventory(prev => prev.filter(i => i.id !== id));
    if (item) showToast(`Removed "${item.name}" from inventory`);
  };

  // Records money spent so the Cost tab can show monthly history
  const logPurchase = (
    items: { category: ItemCategory; totalCost: number }[],
    source: PurchaseLog['source'],
    date: string,
    store?: string
  ) => {
    const categoryTotals: PurchaseLog['categoryTotals'] = {};
    let total = 0;
    items.forEach(it => {
      const cost = it.totalCost || 0;
      if (cost <= 0) return;
      total += cost;
      categoryTotals[it.category] = Number(((categoryTotals[it.category] || 0) + cost).toFixed(2));
    });
    if (total <= 0) return;
    const log: PurchaseLog = {
      id: `pur-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      date,
      total: Number(total.toFixed(2)),
      categoryTotals,
      source,
      store,
    };
    setPurchaseLogs(prev => [log, ...prev]);
  };

  const handleAddItem = (newItem: Omit<InventoryItem, 'id'>, source: PurchaseLog['source'] = 'manual') => {
    let item: InventoryItem = {
      ...newItem,
      id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    // No price entered: use what the pantry already pays for this item instead of counting it as free
    if (!(item.totalCost > 0)) {
      const guess = estimateCostFromPantry(item.name, item.quantity, item.unit, inventory);
      if (guess !== undefined) item = { ...item, totalCost: guess, unitPrice: Number((guess / (item.quantity || 1)).toFixed(2)) };
    }
    const result = mergeIntoInventory(inventory, [item]);
    setInventory(result.inventory);
    logPurchase([item], source, item.purchaseDate);
    showToast(result.merged > 0
      ? `Added more "${item.name}" to your existing stock`
      : `Added "${item.name}" to inventory`);
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
  }[], meta?: { store?: string; purchaseDate?: string; rewardsPoints?: number }) => {
    const newItems: InventoryItem[] = items.map((it, idx) => ({
      ...it,
      id: `inv-rec-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`
    }));

    const result = mergeIntoInventory(inventory, newItems);
    setInventory(result.inventory);
    logPurchase(newItems, 'receipt', meta?.purchaseDate || newItems[0]?.purchaseDate || todayISO(), meta?.store);

    let pointsNote = '';
    if (meta?.rewardsPoints && meta.rewardsPoints > 0) {
      handleAddRewards({
        date: meta.purchaseDate || newItems[0]?.purchaseDate || todayISO(),
        points: meta.rewardsPoints,
        store: meta.store,
        note: 'From receipt',
        source: 'receipt',
      }, false);
      pointsNote = ` +${meta.rewardsPoints} reward points.`;
    }
    const mergedNote = result.merged > 0 ? ` (${result.merged} added to existing stock)` : '';
    showToast(`Added ${newItems.length} items from receipt${mergedNote}.${pointsNote}`);
  };

  // Rewards points
  const handleAddRewards = (entry: Omit<RewardsEntry, 'id'>, toast = true) => {
    setRewards(prev => [
      { ...entry, id: `rew-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` },
      ...prev,
    ]);
    if (toast) showToast(`${entry.points >= 0 ? 'Added' : 'Redeemed'} ${Math.abs(entry.points)} reward points`);
  };

  const handleDeleteRewards = (id: string) => {
    setRewards(prev => prev.filter(r => r.id !== id));
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
    showToast(`Cooked "${recipe.name}"! Deducted ingredients from stock. Total cost: ${formatMoney(costBreakdown.totalCost, settings.currency)}`);
  };

  // Cook a planned meal directly from the planner
  const handleCookPlannedMeal = (plannedMeal: PlannedMeal) => {
    if (plannedMeal.isLeftover) {
      // Already cooked in the batch: just eat it, nothing to deduct
      showToast(`Enjoyed leftover "${plannedMeal.customName}"`);
      setPlannedMeals(prev => prev.filter(m => m.id !== plannedMeal.id));
      return;
    }

    const rec = recipes.find(r => r.id === plannedMeal.recipeId);
    if (rec) {
      const cookServings = plannedMeal.batchServings || plannedMeal.servings;
      const breakdown = calculateRecipeCostAndMatch(rec, inventory, cookServings);
      handleCookMeal(rec, cookServings, breakdown);
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

  const handleAddPlannedMeals = (meals: Omit<PlannedMeal, 'id'>[]) => {
    const stamp = Date.now();
    const created: PlannedMeal[] = meals.map((m, i) => ({
      ...m,
      id: `plan-${stamp}-${i}-${Math.random().toString(36).substr(2, 4)}`,
    }));
    setPlannedMeals(prev => [...prev, ...created]);
    showToast(created.length > 1
      ? `Planned "${meals[0].customName}" for ${created.length} days`
      : `Added "${meals[0].customName}" to meal plan on ${meals[0].date}`);
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
      // Price comes from what you last paid in the pantry; no match means no price
      estimatedCost: item.estimatedCost ?? estimateCostFromPantry(item.name, item.quantity, item.unit, inventory),
      id: `shop-${Date.now()}`,
      checked: false,
    };
    setShoppingList(prev => [newItem, ...prev]);
    showToast(`Added "${item.name}" to shopping list`);
  };

  const handlePurchaseAndAddToInventory = (checkedItems: ShoppingItem[]) => {
    const newInvItems: InventoryItem[] = checkedItems.map(item => {
      // Estimate expiration date +14 days
      const expirationDate = addDaysISO(todayStr, 14);
      // Hand-typed items may have no quantity/unit: assume 1, in the unit the pantry already uses for that name
      const sameName = inventory.find(i => i.name.toLowerCase().trim() === item.name.toLowerCase().trim());
      const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
      const unit = item.unit || sameName?.unit || 'count';
      const cost = item.estimatedCost ?? 0;

      let location: StorageLocation = 'Pantry';
      if (['Produce', 'Dairy & Eggs', 'Meat & Seafood'].includes(item.category)) {
        location = 'Fridge';
      }

      return {
        id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: item.name,
        category: item.category,
        quantity,
        unit,
        unitPrice: Number((cost / quantity).toFixed(2)),
        totalCost: cost,
        purchaseDate: todayStr,
        expirationDate,
        location,
        notes: 'Purchased from shopping list'
      };
    });

    setInventory(mergeIntoInventory(inventory, newInvItems).inventory);
    logPurchase(newInvItems, 'shopping-list', todayStr);
    // Remove purchased items from shopping list
    setShoppingList(prev => prev.filter(item => !item.checked));
    showToast(`Moved ${newInvItems.length} purchased items to your pantry inventory!`);
  };

  // Recipe actions
  const recipeKey = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ');

  // Returns false (and saves nothing) when a recipe with the same name already exists
  const handleAddNewRecipe = (recipe: Recipe): boolean => {
    if (recipes.some(r => recipeKey(r.name) === recipeKey(recipe.name))) {
      showToast(`"${recipe.name}" is already in your recipes`);
      return false;
    }
    setRecipes(prev => [recipe, ...prev]);
    showToast(`Saved recipe "${recipe.name}"!`);
    return true;
  };

  const handleDeleteRecipe = (id: string) => {
    const recipe = recipes.find(r => r.id === id);
    setRecipes(prev => prev.filter(r => r.id !== id));
    if (recipe) showToast(`Deleted recipe "${recipe.name}"`);
  };

  // Remove a tag everywhere: from every recipe and from the suggested-tag bar
  const handleDeleteTag = (tag: string) => {
    const key = tag.toLowerCase();
    setRecipes(prev => prev.map(r => ({
      ...r,
      tags: (r.tags || []).filter(t => t.toLowerCase() !== key),
    })));
    setSettings(prev => (
      prev.hiddenTags.some(t => t.toLowerCase() === key)
        ? prev
        : { ...prev, hiddenTags: [...prev.hiddenTags, tag] }
    ));
    showToast(`Removed tag "${tag}"`);
  };



  const handleUpdateRecipe = (updated: Recipe) => {
    setRecipes(prev => prev.map(r => r.id === updated.id ? updated : r));
    showToast(`Updated tags for "${updated.name}"`);
  };

  // Requests
  const handleCreateRequest = async (request: Parameters<typeof createRequestApi>[0]) => {
    setRequests(await createRequestApi(request));
    showToast('Request sent');
  };

  const handleAnswerRequest = async (id: string, status: 'open' | 'done' | 'declined') => {
    try {
      setRequests(await answerRequestApi(id, status));
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    try {
      setRequests(await deleteRequestApi(id));
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleRequestToShopping = (req: HouseholdRequest) => {
    handleAddShoppingItem({
      name: req.text,
      category: 'Other',
      quantity: req.quantity,
      unit: req.unit,
      reason: `Requested by ${req.requestedBy}`,
    });
    handleAnswerRequest(req.id, 'done');
  };

  const handleRequestToPlanner = (req: HouseholdRequest) => {
    handleAddPlannedMeals([{
      date: req.date || todayISO(),
      slot: req.slot || 'Dinner',
      customName: req.text,
      servings: 2,
      ingredients: [],
    }]);
    handleAnswerRequest(req.id, 'done');
  };

  const handleSelectForRecipeSearch = (ingredientName: string) => {
    setRecipeSearchQuery(ingredientName);
    setActiveTab('recipes');
  };

  // View-only members can look at everything but not change it (the server enforces this too)
  const readOnly = auth.role === 'viewer';
  const guard = <A extends unknown[], R>(fn: (...args: A) => R, whenBlocked?: R) => (...args: A): R => {
    if (readOnly) {
      showToast('View-only access: use Requests to ask for a change');
      return whenBlocked as R;
    }
    return fn(...args);
  };

  return (
    <SettingsProvider measureMode={settings.measureMode} currency={settings.currency}>
    <div className="min-h-screen bg-stone-100/60 text-stone-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white pb-24 md:pb-12">
      {/* Android & PWA Installation Banner */}
      <AndroidInstallBanner onOpenAPKModal={() => setIsAPKModalOpen(true)} />

      {/* Offline Mode Indicator */}
      <OfflineIndicator />

      {/* View-only notice */}
      {readOnly && (
        <div className="bg-sky-50 border-b border-sky-200 text-sky-900 text-xs font-medium px-4 py-2 text-center">
          You have view-only access. You can look at everything and use <button className="underline font-bold" onClick={() => setActiveTab('requests')}>Requests</button> to ask for changes.
        </div>
      )}

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
        onOpenReceiptScanner={guard(() => setIsReceiptModalOpen(true))}
        onOpenBarcodeScanner={guard(() => setIsBarcodeModalOpen(true))}
        onOpenAddItem={() => {
          setActiveTab('inventory');
        }}
        onShowAndroidInstall={() => setIsAPKModalOpen(true)}
        onOpenUnraidModal={() => setIsUnraidModalOpen(true)}
        requestsCount={openRequestsCount}
        onOpenHousehold={() => setIsHouseholdOpen(true)}
        theme={theme}
        onChangeTheme={(t) => { setTheme(t); saveTheme(t); }}
        onClearAllData={guard(handleClearAllData)}
        currency={settings.currency}
        onChangeCurrency={(currency) => {
          setSettings(prev => ({ ...prev, currency }));
          showToast(`Showing prices in ${currency}`);
        }}
        measureMode={settings.measureMode}
        onChangeMeasureMode={(mode) => {
          setSettings(prev => ({ ...prev, measureMode: mode }));
          showToast(mode === 'mass' ? 'Measuring by weight (g, kg, oz, lb)' : 'Measuring by volume (ml, l, cup, fl oz...)');
        }}
        onLogout={auth.logout}
      />

      {/* Main Tab Content */}
      <main className="flex-1">
        {activeTab === 'inventory' && (
          <InventoryManager
            inventory={inventory}
            onUpdateItem={guard(handleUpdateItem)}
            onDeleteItem={guard(handleDeleteItem)}
            onAddItem={guard(handleAddItem)}
            onSelectForRecipeSearch={handleSelectForRecipeSearch}
            onOpenReceiptScanner={guard(() => setIsReceiptModalOpen(true))}
            onOpenBarcodeScanner={guard(() => setIsBarcodeModalOpen(true))}
          />
        )}

        {activeTab === 'recipes' && (
          <RecipeDatabase
            inventory={inventory}
            recipes={recipes}
            onCookMeal={guard(handleCookMeal)}
            onAddPlannedMeal={guard(handleAddPlannedMealFromRecipe)}
            onAddNewRecipe={guard(handleAddNewRecipe, false)}
            onDeleteRecipe={guard(handleDeleteRecipe)}
            onDeleteTag={guard(handleDeleteTag)}
            hiddenTags={settings.hiddenTags}
            onUpdateRecipe={guard(handleUpdateRecipe)}
            initialSearchQuery={recipeSearchQuery}
          />
        )}

        {activeTab === 'planner' && (
          <MealPlanner
            inventory={inventory}
            recipes={recipes}
            plannedMeals={plannedMeals}
            onAddPlannedMeal={guard(handleAddPlannedMeal)}
            onAddPlannedMeals={guard(handleAddPlannedMeals)}
            onRemovePlannedMeal={guard(handleRemovePlannedMeal)}
            onAutoGenerateShoppingList={guard(handleAutoGenerateShoppingList)}
            onCookPlannedMeal={guard(handleCookPlannedMeal)}
          />
        )}

        {activeTab === 'shopping' && (
          <ShoppingListView
            shoppingList={shoppingList}
            onToggleItem={guard(handleToggleShoppingItem)}
            onDeleteItem={guard(handleDeleteShoppingItem)}
            onAddItem={guard(handleAddShoppingItem)}
            onPurchaseAndAddToInventory={guard(handlePurchaseAndAddToInventory)}
          />
        )}

        {activeTab === 'requests' && (
          <RequestsView
            requests={requests}
            currentUser={auth.user}
            canAnswer={!readOnly}
            onCreate={handleCreateRequest}
            onAnswer={handleAnswerRequest}
            onDelete={handleDeleteRequest}
            onAddToShopping={handleRequestToShopping}
            onAddToPlanner={handleRequestToPlanner}
          />
        )}

        {activeTab === 'analytics' && (
          <CostAnalytics
            cookedLogs={cookedLogs}
            inventory={inventory}
            purchaseLogs={purchaseLogs}
            rewards={rewards}
            onAddRewards={guard(handleAddRewards)}
            onDeleteRewards={guard(handleDeleteRewards)}
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
        requestsCount={openRequestsCount}
        onOpenReceiptScanner={guard(() => setIsReceiptModalOpen(true))}
        onOpenBarcodeScanner={guard(() => setIsBarcodeModalOpen(true))}
      />

      {/* Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onAddItemsToInventory={guard(handleBulkAddFromReceipt)}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        onAddItemToInventory={(item) => {
          handleAddItem(item, 'barcode');
          setIsBarcodeModalOpen(false);
        }}
      />

      {/* Android APK Download & Hub Modal */}
      <AndroidAPKModal
        isOpen={isAPKModalOpen}
        onClose={() => setIsAPKModalOpen(false)}
      />

      <HouseholdModal isOpen={isHouseholdOpen} onClose={() => setIsHouseholdOpen(false)} />

      {/* Unraid OS & Docker Hosting Guide Modal */}
      <UnraidModal
        isOpen={isUnraidModalOpen}
        onClose={() => setIsUnraidModalOpen(false)}
      />
    </div>
    </SettingsProvider>
  );
}
