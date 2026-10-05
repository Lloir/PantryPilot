import React, { useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Utensils, 
  Calendar, 
  Award, 
  PieChart, 
  CheckCircle,
  Clock,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { CookedMealLog, InventoryItem } from '../types';

interface CostAnalyticsProps {
  cookedLogs: CookedMealLog[];
  inventory: InventoryItem[];
}

export const CostAnalytics: React.FC<CostAnalyticsProps> = ({
  cookedLogs,
  inventory,
}) => {
  // Financial metrics
  const analytics = useMemo(() => {
    // Current inventory total value
    const pantryValue = inventory.reduce((acc, it) => acc + (it.totalCost || it.quantity * it.unitPrice), 0);

    // Total spent on cooked meals
    const totalCookingCost = cookedLogs.reduce((acc, log) => acc + log.totalMealCost, 0);
    const totalServingsCooked = cookedLogs.reduce((acc, log) => acc + log.servingsCooked, 0);
    const avgCostPerServing = totalServingsCooked > 0 ? totalCookingCost / totalServingsCooked : 0;

    // Estimated takeout benchmark: $16 per serving outside
    const takeoutBenchmark = totalServingsCooked * 16.0;
    const totalSavings = Math.max(0, takeoutBenchmark - totalCookingCost);

    // Category distribution from inventory
    const catTotals: Record<string, number> = {};
    inventory.forEach(item => {
      const val = item.totalCost || item.quantity * item.unitPrice;
      catTotals[item.category] = (catTotals[item.category] || 0) + val;
    });

    const categoryBreakdown = Object.entries(catTotals)
      .map(([cat, total]) => ({ category: cat, total: Number(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total);

    return {
      pantryValue: Number(pantryValue.toFixed(2)),
      totalCookingCost: Number(totalCookingCost.toFixed(2)),
      totalServingsCooked,
      avgCostPerServing: Number(avgCostPerServing.toFixed(2)),
      takeoutBenchmark: Number(takeoutBenchmark.toFixed(2)),
      totalSavings: Number(totalSavings.toFixed(2)),
      categoryBreakdown
    };
  }, [cookedLogs, inventory]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs font-bold text-stone-500 uppercase tracking-wider">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span>Financial Analytics & Meal Cost Tracking</span>
        </div>
        <h2 className="text-xl font-bold text-stone-900 mt-1">
          Smart Grocery Spending & Home Cooking ROI
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          See exactly how much each meal costs to cook based on your purchase prices, and track your takeout savings.
        </p>
      </div>

      {/* 4 Financial Highlight Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">Avg Cost / Serving</span>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-black text-emerald-700">${analytics.avgCostPerServing.toFixed(2)}</span>
            <span className="text-xs text-stone-500">/ portion</span>
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Across {analytics.totalServingsCooked} cooked portions
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">Estimated Savings</span>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-black text-emerald-600">${analytics.totalSavings.toFixed(2)}</span>
            <span className="text-xs text-emerald-700 font-semibold">saved</span>
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            vs $16.00 average takeout order
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">Current Pantry Value</span>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-black text-stone-900">${analytics.pantryValue.toFixed(2)}</span>
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            {inventory.length} ingredients currently in stock
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">Cooked Food Value</span>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-black text-stone-900">${analytics.totalCookingCost.toFixed(2)}</span>
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            {cookedLogs.length} home meals tracked
          </span>
        </div>
      </div>

      {/* Category Spending Breakdown Bar */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
          Pantry Stock Value by Category
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {analytics.categoryBreakdown.map(cat => (
            <div key={cat.category} className="p-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="text-xs font-semibold text-stone-700 block truncate">{cat.category}</span>
              <span className="text-base font-bold text-emerald-800 mt-1 block">${cat.total.toFixed(2)}</span>
              <div className="w-full bg-stone-200 rounded-full h-1 mt-2">
                <div
                  className="bg-emerald-600 h-1 rounded-full"
                  style={{ width: `${Math.min(100, (cat.total / (analytics.pantryValue || 1)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cooking History Log Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div>
            <h3 className="text-base font-bold text-stone-900">Meal Cooking & Deduction History</h3>
            <p className="text-xs text-stone-500">Record of meals cooked, portions, total costs, and deducted ingredients</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
            {cookedLogs.length} meals logged
          </span>
        </div>

        {cookedLogs.length === 0 ? (
          <div className="p-12 text-center text-stone-400 text-sm">
            No cooked meals recorded yet. Pick a recipe from the database and click "Cook Now"!
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {cookedLogs.map(log => {
              const formattedDate = new Date(log.cookedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div key={log.id} className="p-4 sm:p-5 hover:bg-stone-50/70 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-bold text-stone-900">{log.recipeName}</h4>
                        <span className="text-[11px] font-semibold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                          {log.servingsCooked} servings
                        </span>
                      </div>
                      <span className="text-xs text-stone-400 flex items-center space-x-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{formattedDate}</span>
                      </span>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Cost</span>
                        <span className="text-sm font-bold text-stone-900">${log.totalMealCost.toFixed(2)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-stone-400 block">Per Portion</span>
                        <span className="text-sm font-extrabold text-emerald-700">${log.costPerServing.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deducted items breakdown */}
                  {log.deductedItems && log.deductedItems.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-stone-100">
                      <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                        Deducted from Pantry:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {log.deductedItems.map((item, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md flex items-center space-x-1"
                          >
                            <span>{item.itemName}</span>
                            <span className="font-semibold text-stone-900">
                              ({item.quantityDeducted} {item.unit} • ${item.cost.toFixed(2)})
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {log.notes && (
                    <p className="text-xs text-stone-500 italic mt-2">
                      Note: {log.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
