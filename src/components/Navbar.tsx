import React from 'react';
import { 
  Refrigerator, 
  UtensilsCrossed, 
  CalendarDays, 
  ShoppingCart, 
  LineChart, 
  ScanLine, 
  Barcode, 
  PlusCircle,
  AlertTriangle,
  Smartphone,
  Server,
  Trash2,
  LogOut,
  Scale
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export type ActiveTab = 'inventory' | 'recipes' | 'planner' | 'shopping' | 'analytics';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  expiringCount: number;
  readyToCookCount: number;
  shoppingCount: number;
  depletionWarningsCount: number;
  onOpenReceiptScanner: () => void;
  onOpenBarcodeScanner: () => void;
  onOpenAddItem: () => void;
  onShowAndroidInstall?: () => void;
  onOpenUnraidModal?: () => void;
  onClearAllData?: () => void;
  measureMode: 'mass' | 'volume';
  onChangeMeasureMode: (mode: 'mass' | 'volume') => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  expiringCount,
  readyToCookCount,
  shoppingCount,
  depletionWarningsCount,
  onOpenReceiptScanner,
  onOpenBarcodeScanner,
  onOpenAddItem,
  onShowAndroidInstall,
  onOpenUnraidModal,
  onClearAllData,
  measureMode,
  onChangeMeasureMode,
  onLogout,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('inventory')}>
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
              <Refrigerator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-stone-900">PantryPal</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Android App
                </span>
              </div>
              <p className="text-xs text-stone-500 hidden sm:block">Receipt Scanner • Inventory • Recipe Cost & Meal Planner</p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenUnraidModal}
              className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg text-orange-900 bg-orange-100 hover:bg-orange-200 border border-orange-300 transition-colors shadow-2xs"
              title="Host on Unraid Docker Container"
            >
              <Server className="w-4 h-4 text-orange-700 shrink-0" />
              <span>Unraid</span>
            </button>

            <button
              onClick={onShowAndroidInstall}
              className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg text-emerald-950 bg-emerald-100/90 hover:bg-emerald-200 border border-emerald-300 transition-colors shadow-2xs"
              title="Get Android APK & Build Package"
            >
              <Smartphone className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Android APK</span>
            </button>

            <button
              onClick={onOpenReceiptScanner}
              className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs"
              title="Scan Grocery Receipt"
            >
              <ScanLine className="w-4 h-4 text-emerald-700" />
              <span className="hidden md:inline">Scan Receipt</span>
            </button>

            <button
              onClick={onOpenBarcodeScanner}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors shadow-2xs"
              title="Scan Barcode"
            >
              <Barcode className="w-4 h-4 text-sky-700" />
              <span className="hidden md:inline">Scan Barcode</span>
            </button>

            <button
              onClick={onOpenAddItem}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-white bg-stone-900 hover:bg-stone-800 transition-colors shadow-2xs"
              title="Add Item Manually"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Add Item</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto py-1.5 border-t border-stone-100 scrollbar-none">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`inline-flex items-center space-x-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'inventory'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Refrigerator className="w-4 h-4" />
            <span>Pantry & Inventory</span>
            {expiringCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-xs font-bold ${
                activeTab === 'inventory' ? 'bg-amber-400 text-stone-900' : 'bg-amber-100 text-amber-800'
              }`}>
                {expiringCount} expiring
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('recipes')}
            className={`inline-flex items-center space-x-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'recipes'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Recipes & Suggestions</span>
            {readyToCookCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-xs font-bold ${
                activeTab === 'recipes' ? 'bg-emerald-200 text-emerald-950' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {readyToCookCount} ready
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('planner')}
            className={`inline-flex items-center space-x-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'planner'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Meal Planner & Forecast</span>
            {depletionWarningsCount > 0 && (
              <span className={`inline-flex items-center space-x-1 px-1.5 py-0.2 rounded-full text-xs font-bold ${
                activeTab === 'planner' ? 'bg-red-400 text-white' : 'bg-red-100 text-red-700'
              }`}>
                <AlertTriangle className="w-3 h-3" />
                <span>{depletionWarningsCount}</span>
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('shopping')}
            className={`inline-flex items-center space-x-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'shopping'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Shopping List</span>
            {shoppingCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-xs font-bold ${
                activeTab === 'shopping' ? 'bg-emerald-200 text-emerald-950' : 'bg-stone-200 text-stone-700'
              }`}>
                {shoppingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`inline-flex items-center space-x-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'analytics'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <LineChart className="w-4 h-4" />
            <span>Cost & Savings</span>
          </button>

          <label
            className="ml-auto inline-flex items-center space-x-1.5 px-2 py-1 text-xs text-stone-500 whitespace-nowrap"
            title="Pick one way to measure everything. Weight and volume are never converted into each other."
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Measure by</span>
            <select
              value={measureMode}
              onChange={(e) => onChangeMeasureMode(e.target.value as 'mass' | 'volume')}
              className="bg-stone-100 border border-stone-200 rounded-md px-1.5 py-0.5 text-xs font-semibold text-stone-700"
            >
              <option value="mass">Weight (g, oz, lb)</option>
              <option value="volume">Volume (ml, cup, fl oz)</option>
            </select>
          </label>

          {onLogout && (
            <button
              onClick={onLogout}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors whitespace-nowrap"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          )}

          {onClearAllData && (
            <button
              onClick={onClearAllData}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap"
              title="Clear all data from database"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Data</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
