import React, { useEffect, useState } from 'react';
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
  Scale,
  Menu,
  Coins,
  Users,
  Inbox,
  Palette,
  X
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { CURRENCIES } from '../utils/currency';
import { ThemeChoice } from '../utils/theme';

export type ActiveTab = 'inventory' | 'recipes' | 'planner' | 'shopping' | 'analytics' | 'requests';

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
  onShowInstall?: () => void;
  onOpenUnraidModal?: () => void;
  onClearAllData?: () => void;
  requestsCount: number;
  onOpenHousehold: () => void;
  theme: ThemeChoice;
  onChangeTheme: (theme: ThemeChoice) => void;
  currency: string;
  onChangeCurrency: (code: string) => void;
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
  onShowInstall,
  onOpenUnraidModal,
  onClearAllData,
  requestsCount,
  onOpenHousehold,
  theme,
  onChangeTheme,
  currency,
  onChangeCurrency,
  measureMode,
  onChangeMeasureMode,
  onLogout,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  const closeAnd = (fn?: () => void) => () => { setMenuOpen(false); fn?.(); };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Menu + Brand Logo */}
          <div className="flex items-center space-x-2 relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="relative z-50 p-2 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors"
              aria-label="Menu"
              aria-expanded={menuOpen}
              title="Menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 top-12 z-50 w-72 bg-white border border-stone-200 rounded-2xl shadow-xl p-2 space-y-1">
                  <button
                    onClick={closeAnd(onOpenUnraidModal)}
                    className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-800 hover:bg-stone-100 text-left"
                  >
                    <Server className="w-4 h-4 text-orange-700 shrink-0" />
                    <span>Host on Unraid</span>
                  </button>
                  <button
                    onClick={closeAnd(onShowInstall)}
                    className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-800 hover:bg-stone-100 text-left"
                  >
                    <Smartphone className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Install app</span>
                  </button>

                  <div className="border-t border-stone-100 my-1" />

                  <button
                    onClick={closeAnd(onOpenHousehold)}
                    className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-800 hover:bg-stone-100 text-left"
                  >
                    <Users className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>People &amp; household</span>
                  </button>

                  <label className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-stone-700">
                    <span className="flex items-center space-x-2.5">
                      <Palette className="w-4 h-4 text-stone-500 shrink-0" />
                      <span>Theme</span>
                    </span>
                    <select
                      value={theme}
                      onChange={(e) => onChangeTheme(e.target.value as ThemeChoice)}
                      className="bg-stone-100 border border-stone-200 rounded-md px-1.5 py-1 text-xs font-semibold text-stone-700"
                      title="Light, dark, or follow your device. Only affects this device."
                    >
                      <option value="system">Match device</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-stone-700">
                    <span className="flex items-center space-x-2.5">
                      <Scale className="w-4 h-4 text-stone-500 shrink-0" />
                      <span>Measure by</span>
                    </span>
                    <select
                      value={measureMode}
                      onChange={(e) => onChangeMeasureMode(e.target.value as 'mass' | 'volume')}
                      className="bg-stone-100 border border-stone-200 rounded-md px-1.5 py-1 text-xs font-semibold text-stone-700"
                      title="Pick one way to measure everything. Weight and volume are never converted into each other."
                    >
                      <option value="mass">Weight</option>
                      <option value="volume">Volume</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-stone-700">
                    <span className="flex items-center space-x-2.5">
                      <Coins className="w-4 h-4 text-stone-500 shrink-0" />
                      <span>Currency</span>
                    </span>
                    <select
                      value={currency}
                      onChange={(e) => onChangeCurrency(e.target.value)}
                      className="bg-stone-100 border border-stone-200 rounded-md px-1.5 py-1 text-xs font-semibold text-stone-700 max-w-[10rem]"
                      title="Only changes how prices are shown; amounts are not converted."
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
                      ))}
                    </select>
                  </label>

                  {onLogout && (
                    <>
                      <div className="border-t border-stone-100 my-1" />
                      <button
                        onClick={closeAnd(onLogout)}
                        className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-800 hover:bg-stone-100 text-left"
                      >
                        <LogOut className="w-4 h-4 text-stone-500 shrink-0" />
                        <span>Sign out</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('inventory')}>
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
              <Refrigerator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-stone-900">PantryPal</span>
              </div>
              <p className="text-xs text-stone-500 hidden sm:block">Receipt Scanner • Inventory • Recipe Cost & Meal Planner</p>
            </div>
          </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenReceiptScanner}
              className="edit-only inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs"
              title="Scan Grocery Receipt"
            >
              <ScanLine className="w-4 h-4 text-emerald-700" />
              <span className="hidden md:inline">Scan Receipt</span>
            </button>

            <button
              onClick={onOpenBarcodeScanner}
              className="edit-only inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors shadow-2xs"
              title="Scan Barcode"
            >
              <Barcode className="w-4 h-4 text-sky-700" />
              <span className="hidden md:inline">Scan Barcode</span>
            </button>

            <button
              onClick={onOpenAddItem}
              className="edit-only inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-white bg-stone-900 hover:bg-stone-800 transition-colors shadow-2xs"
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

          <button
            onClick={() => setActiveTab('requests')}
            className={`inline-flex items-center space-x-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'requests'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Requests</span>
            {requestsCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-xs font-bold ${
                activeTab === 'requests' ? 'bg-emerald-200 text-emerald-950' : 'bg-amber-100 text-amber-800'
              }`}>
                {requestsCount}
              </span>
            )}
          </button>

          {onClearAllData && (
            <button
              onClick={onClearAllData}
              className="edit-only ml-auto inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap"
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
