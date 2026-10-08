import React from 'react';
import { 
  Refrigerator, 
  UtensilsCrossed, 
  CalendarDays, 
  ShoppingCart, 
  LineChart, 
  ScanLine, 
  Barcode,
  Inbox
} from 'lucide-react';
import { ActiveTab } from './Navbar';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  expiringCount: number;
  readyToCookCount: number;
  shoppingCount: number;
  depletionWarningsCount: number;
  requestsCount: number;
  onOpenReceiptScanner: () => void;
  onOpenBarcodeScanner: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  expiringCount,
  readyToCookCount,
  shoppingCount,
  depletionWarningsCount,
  requestsCount,
  onOpenReceiptScanner,
  onOpenBarcodeScanner,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200/90 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-6 h-16 max-w-md mx-auto px-1 items-center">
        {/* 1. Inventory */}
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex flex-col items-center justify-center py-1 transition-all relative ${
            activeTab === 'inventory' ? 'text-emerald-700 font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <div className="relative">
            <Refrigerator className={`w-5 h-5 ${activeTab === 'inventory' ? 'stroke-[2.5]' : ''}`} />
            {expiringCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[9px] font-extrabold px-1 py-0.2 rounded-full min-w-4 text-center">
                {expiringCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Pantry</span>
          {activeTab === 'inventory' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-0.5" />
          )}
        </button>

        {/* 2. Recipes */}
        <button
          onClick={() => setActiveTab('recipes')}
          className={`flex flex-col items-center justify-center py-1 transition-all relative ${
            activeTab === 'recipes' ? 'text-emerald-700 font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <div className="relative">
            <UtensilsCrossed className={`w-5 h-5 ${activeTab === 'recipes' ? 'stroke-[2.5]' : ''}`} />
            {readyToCookCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-emerald-600 text-white text-[9px] font-extrabold px-1 py-0.2 rounded-full min-w-4 text-center">
                {readyToCookCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Recipes</span>
          {activeTab === 'recipes' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-0.5" />
          )}
        </button>

        {/* 3. Planner */}
        <button
          onClick={() => setActiveTab('planner')}
          className={`flex flex-col items-center justify-center py-1 transition-all relative ${
            activeTab === 'planner' ? 'text-emerald-700 font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <div className="relative">
            <CalendarDays className={`w-5 h-5 ${activeTab === 'planner' ? 'stroke-[2.5]' : ''}`} />
            {depletionWarningsCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-extrabold px-1 py-0.2 rounded-full min-w-4 text-center animate-pulse">
                !
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Plan</span>
          {activeTab === 'planner' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-0.5" />
          )}
        </button>

        {/* 4. Shopping */}
        <button
          onClick={() => setActiveTab('shopping')}
          className={`flex flex-col items-center justify-center py-1 transition-all relative ${
            activeTab === 'shopping' ? 'text-emerald-700 font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <div className="relative">
            <ShoppingCart className={`w-5 h-5 ${activeTab === 'shopping' ? 'stroke-[2.5]' : ''}`} />
            {shoppingCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-stone-800 text-white text-[9px] font-extrabold px-1 py-0.2 rounded-full min-w-4 text-center">
                {shoppingCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Shop</span>
          {activeTab === 'shopping' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-0.5" />
          )}
        </button>

        {/* 5. Analytics */}
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center justify-center py-1 transition-all relative ${
            activeTab === 'analytics' ? 'text-emerald-700 font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <LineChart className={`w-5 h-5 ${activeTab === 'analytics' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-1 tracking-tight">Cost</span>
          {activeTab === 'analytics' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-0.5" />
          )}
        </button>

        {/* 6. Requests */}
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex flex-col items-center justify-center py-1 transition-all relative ${
            activeTab === 'requests' ? 'text-emerald-700 font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <div className="relative">
            <Inbox className={`w-5 h-5 ${activeTab === 'requests' ? 'stroke-[2.5]' : ''}`} />
            {requestsCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[9px] font-extrabold px-1 py-0.2 rounded-full min-w-4 text-center">
                {requestsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Asks</span>
          {activeTab === 'requests' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-0.5" />
          )}
        </button>
      </div>
    </nav>
  );
};
