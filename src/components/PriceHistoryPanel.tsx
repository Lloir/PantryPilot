import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { PricePoint } from '../types';
import { summarizePrices } from '../utils/priceHistory';
import { useCurrency } from '../context/SettingsContext';

/** What this item has cost over time, per unit, and which store has been cheapest. */
export const PriceHistoryPanel: React.FC<{ history: PricePoint[]; name: string; unit: string }> = ({ history, name, unit }) => {
  const { fmt } = useCurrency();
  const s = summarizePrices(history, name, unit);
  if (s.points.length === 0) {
    return <p className="text-[11px] text-stone-400">No prices recorded yet. They are saved each time you add this item with a price.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-stone-600">Last paid <strong className="text-stone-900">{fmt(s.latest!)}</strong> per {unit}</span>
        {s.points.length > 1 && <span className="text-stone-600">Average <strong className="text-stone-900">{fmt(s.average!)}</strong></span>}
        {s.changePct !== undefined && Math.abs(s.changePct) >= 1 && (
          <span className={`inline-flex items-center space-x-1 font-semibold ${s.changePct > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {s.changePct > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span>{s.changePct > 0 ? '+' : ''}{Math.round(s.changePct)}% vs earlier</span>
          </span>
        )}
        {s.cheapest && <span className="text-stone-600">Cheapest at <strong className="text-stone-900">{s.cheapest.store}</strong> ({fmt(s.cheapest.price)})</span>}
      </div>
      <ul className="text-[11px] text-stone-500 divide-y divide-stone-100 border border-stone-100 rounded-lg">
        {s.points.slice(0, 6).map((p, i) => (
          <li key={i} className="flex justify-between px-2.5 py-1">
            <span>{p.date}{p.store ? ` · ${p.store}` : ''}</span>
            <span className="font-semibold text-stone-700">{fmt(p.price)} / {unit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
