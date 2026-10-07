import React, { useMemo, useState } from 'react';
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
  ArrowRight,
  Gift,
  Trash2,
  History
} from 'lucide-react';
import { CookedMealLog, InventoryItem, PurchaseLog, RewardsEntry } from '../types';

interface CostAnalyticsProps {
  cookedLogs: CookedMealLog[];
  inventory: InventoryItem[];
  purchaseLogs: PurchaseLog[];
  rewards: RewardsEntry[];
  onAddRewards: (entry: Omit<RewardsEntry, 'id'>) => void;
  onDeleteRewards: (id: string) => void;
}

type HistoryRange = 3 | 6 | 12 | 0; // 0 = all time

const monthKey = (date: string) => date.slice(0, 7);
const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const CostAnalytics: React.FC<CostAnalyticsProps> = ({
  cookedLogs,
  inventory,
  purchaseLogs,
  rewards,
  onAddRewards,
  onDeleteRewards,
}) => {
  const [historyRange, setHistoryRange] = useState<HistoryRange>(6);
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardStore, setRewardStore] = useState('');
  const [rewardNote, setRewardNote] = useState('');
  const [rewardDate, setRewardDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rewardMode, setRewardMode] = useState<'earn' | 'redeem'>('earn');

  // Spending history by month (what was bought, not what is left on the shelf)
  const history = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const byMonth: Record<string, number> = {};
    const catByMonth: Record<string, Record<string, number>> = {};
    purchaseLogs.forEach(log => {
      const key = monthKey(log.date);
      byMonth[key] = (byMonth[key] || 0) + log.total;
      Object.entries(log.categoryTotals).forEach(([cat, amt]) => {
        catByMonth[cat] = catByMonth[cat] || {};
        catByMonth[cat][key] = (catByMonth[cat][key] || 0) + (amt || 0);
      });
    });

    const keys = Object.keys(byMonth).sort();
    const latest = keys.length > 0 && keys[keys.length - 1] > currentMonth ? keys[keys.length - 1] : currentMonth;
    const earliest = keys[0] || currentMonth;
    const allSpan: string[] = [];
    for (let k = earliest; k <= latest; k = shiftMonth(k, 1)) allSpan.push(k);

    const months = historyRange === 0 ? allSpan : Array.from({ length: historyRange }, (_, i) => shiftMonth(latest, i - historyRange + 1));
    const rows = months.map(key => ({ key, total: Number((byMonth[key] || 0).toFixed(2)) }));
    const total = rows.reduce((a, r) => a + r.total, 0);
    const avgMonthly = rows.length > 0 ? total / rows.length : 0;
    const max = Math.max(1, ...rows.map(r => r.total));

    const categoryAvg: Record<string, number> = {};
    Object.entries(catByMonth).forEach(([cat, perMonth]) => {
      const sum = months.reduce((a, m) => a + (perMonth[m] || 0), 0);
      categoryAvg[cat] = months.length > 0 ? sum / months.length : 0;
    });

    return { rows, total: Number(total.toFixed(2)), avgMonthly: Number(avgMonthly.toFixed(2)), max, categoryAvg, monthsCount: months.length };
  }, [purchaseLogs, historyRange]);

  const rewardsBalance = useMemo(() => rewards.reduce((a, r) => a + r.points, 0), [rewards]);

  const handleSubmitRewards = (e: React.FormEvent) => {
    e.preventDefault();
    const pts = Math.abs(parseInt(rewardPoints, 10));
    if (!pts) return;
    onAddRewards({
      date: rewardDate,
      points: rewardMode === 'earn' ? pts : -pts,
      store: rewardStore.trim() || undefined,
      note: rewardNote.trim() || undefined,
      source: 'manual',
    });
    setRewardPoints('');
    setRewardNote('');
  };

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
              <span className="text-[10px] text-stone-500 block">
                avg ${(history.categoryAvg[cat.category] || 0).toFixed(2)}/mo bought
              </span>
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

      {/* Spending History: current carrying cost vs. what you actually buy */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center space-x-2">
              <History className="w-4 h-4 text-emerald-600" />
              <span>Grocery Spending History</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Current carrying cost is what is on your shelves now. History is what you have bought each month.
            </p>
          </div>
          <div className="flex items-center space-x-1">
            {([3, 6, 12, 0] as HistoryRange[]).map(r => (
              <button
                key={r}
                onClick={() => setHistoryRange(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  historyRange === r ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {r === 0 ? 'All' : `${r} mo`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
            <span className="text-[10px] font-bold uppercase text-stone-400 block">Current carrying cost</span>
            <span className="text-xl font-black text-stone-900">${analytics.pantryValue.toFixed(2)}</span>
          </div>
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
            <span className="text-[10px] font-bold uppercase text-stone-400 block">Average per month</span>
            <span className="text-xl font-black text-emerald-700">${history.avgMonthly.toFixed(2)}</span>
          </div>
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
            <span className="text-[10px] font-bold uppercase text-stone-400 block">
              Spent over {history.monthsCount} month{history.monthsCount === 1 ? '' : 's'}
            </span>
            <span className="text-xl font-black text-stone-900">${history.total.toFixed(2)}</span>
          </div>
        </div>

        {purchaseLogs.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-4">
            No purchases recorded yet. Scan a receipt, add items, or check off your shopping list to build history.
          </p>
        ) : (
          <div className="space-y-1.5">
            {history.rows.map(row => (
              <div key={row.key} className="flex items-center space-x-3 text-xs">
                <span className="w-20 shrink-0 text-stone-500">{monthLabel(row.key)}</span>
                <div className="flex-1 bg-stone-100 rounded-full h-2.5">
                  <div
                    className="bg-emerald-500 h-2.5 rounded-full"
                    style={{ width: `${(row.total / history.max) * 100}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right font-semibold text-stone-800">${row.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rewards Points */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center space-x-2">
            <Gift className="w-4 h-4 text-emerald-600" />
            <span>Rewards Points</span>
          </h3>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase text-stone-400 block">Balance</span>
            <span className="text-2xl font-black text-emerald-700">{rewardsBalance.toLocaleString()}</span>
          </div>
        </div>
        <p className="text-xs text-stone-500">
          Points printed on a receipt are added automatically when you scan it. You can also log points by hand.
        </p>

        <form onSubmit={handleSubmitRewards} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Type</label>
            <select
              value={rewardMode}
              onChange={(e) => setRewardMode(e.target.value as 'earn' | 'redeem')}
              className="w-full px-2 py-2 border border-stone-300 rounded-lg bg-white"
            >
              <option value="earn">Earned</option>
              <option value="redeem">Redeemed</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Points</label>
            <input
              type="number"
              min="1"
              value={rewardPoints}
              onChange={(e) => setRewardPoints(e.target.value)}
              className="w-full px-2 py-2 border border-stone-300 rounded-lg"
              placeholder="e.g. 120"
            />
          </div>
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Store</label>
            <input
              type="text"
              value={rewardStore}
              onChange={(e) => setRewardStore(e.target.value)}
              className="w-full px-2 py-2 border border-stone-300 rounded-lg"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Date</label>
            <input
              type="date"
              value={rewardDate}
              onChange={(e) => setRewardDate(e.target.value)}
              className="w-full px-2 py-2 border border-stone-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Note</label>
            <input
              type="text"
              value={rewardNote}
              onChange={(e) => setRewardNote(e.target.value)}
              className="w-full px-2 py-2 border border-stone-300 rounded-lg"
              placeholder="Optional"
            />
          </div>
          <button
            type="submit"
            disabled={!rewardPoints}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold"
          >
            Add points
          </button>
        </form>

        {rewards.length > 0 && (
          <div className="divide-y divide-stone-100 border border-stone-100 rounded-xl">
            {rewards.slice(0, 15).map(r => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <div>
                  <span className="font-semibold text-stone-800">{r.store || 'Rewards'}</span>
                  <span className="text-stone-400"> · {r.date}{r.source === 'receipt' ? ' · receipt' : ''}</span>
                  {r.note && <span className="text-stone-500"> · {r.note}</span>}
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`font-bold ${r.points >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {r.points >= 0 ? '+' : ''}{r.points.toLocaleString()}
                  </span>
                  <button
                    onClick={() => onDeleteRewards(r.id)}
                    className="text-stone-300 hover:text-red-600"
                    title="Delete entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
