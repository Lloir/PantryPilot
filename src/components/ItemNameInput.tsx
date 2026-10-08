import React, { useMemo, useState } from 'react';
import { InventoryItem } from '../types';

interface ItemNameInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when an existing pantry item is chosen, so the form can copy its details. */
  onPick: (item: InventoryItem) => void;
  inventory: InventoryItem[];
  placeholder?: string;
}

const key = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');

/** Text box that suggests items already in the pantry. Tab (or click) accepts the highlighted suggestion. */
export const ItemNameInput: React.FC<ItemNameInputProps> = ({ value, onChange, onPick, inventory, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const suggestions = useMemo(() => {
    const q = key(value);
    if (!q) return [];
    const names = new Map<string, InventoryItem>();
    inventory.forEach(i => { if (!names.has(key(i.name))) names.set(key(i.name), i); });
    const all = Array.from(names.values()).filter(i => key(i.name) !== q || i.name !== value);
    const starts = all.filter(i => key(i.name).startsWith(q) && key(i.name) !== q);
    const contains = all.filter(i => !key(i.name).startsWith(q) && key(i.name).includes(q));
    return [...starts, ...contains].slice(0, 6);
  }, [value, inventory]);

  const exact = useMemo(
    () => (value.trim() ? inventory.find(i => key(i.name) === key(value)) : undefined),
    [value, inventory]
  );

  const pick = (item: InventoryItem) => {
    onChange(item.name);
    onPick(item);
    setOpen(false);
  };

  const showList = open && suggestions.length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        required
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === 'Tab' || (e.key === 'Enter' && highlight >= 0)) {
            e.preventDefault();
            pick(suggestions[Math.min(highlight, suggestions.length - 1)]);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight(h => Math.min(h + 1, suggestions.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(h => Math.max(h - 1, 0));
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
      />
      {showList && (
        <ul role="listbox" className="absolute z-10 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((item, idx) => (
            <li
              key={item.id}
              role="option"
              aria-selected={idx === highlight}
              onMouseDown={(e) => { e.preventDefault(); pick(item); }}
              onMouseEnter={() => setHighlight(idx)}
              className={`px-3 py-1.5 text-sm cursor-pointer flex items-center justify-between ${
                idx === highlight ? 'bg-emerald-50 text-emerald-900' : 'text-stone-800'
              }`}
            >
              <span>{item.name}</span>
              <span className="text-[11px] text-stone-400">
                {idx === highlight ? 'Tab ↹  ' : ''}{item.quantity} {item.unit} in stock
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] mt-1 text-stone-400">
        {exact
          ? <span className="text-emerald-700 font-medium">Same name as "{exact.name}" ({exact.quantity} {exact.unit} in stock): this will be added to it.</span>
          : 'Items are added together only when the name matches exactly (capitals ignored). "Chicken" and "Chicken breast" stay separate. Press Tab to autofill from your pantry.'}
      </p>
    </div>
  );
};
