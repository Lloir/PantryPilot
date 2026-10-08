import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, 
  Check, 
  Trash2, 
  Plus, 
  DollarSign, 
  PackagePlus, 
  Sparkles, 
  Layers, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { UnitSelect } from './UnitSelect';
import { NumberField } from './NumberField';
import confetti from 'canvas-confetti';
import { ItemCategory, ShoppingItem, StorageLocation } from '../types';

interface ShoppingListViewProps {
  shoppingList: ShoppingItem[];
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (item: Omit<ShoppingItem, 'id' | 'checked'>) => void;
  onPurchaseAndAddToInventory: (items: ShoppingItem[]) => void;
}

const CATEGORIES: ItemCategory[] = [
  'Produce',
  'Dairy & Eggs',
  'Meat & Seafood',
  'Pantry & Grains',
  'Canned & Jarred',
  'Frozen',
  'Bakery',
  'Beverages',
  'Spices & Condiments',
  'Snacks',
  'Other'
];

export const ShoppingListView: React.FC<ShoppingListViewProps> = ({
  shoppingList,
  onToggleItem,
  onDeleteItem,
  onAddItem,
  onPurchaseAndAddToInventory,
}) => {
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<ItemCategory>('Produce');
  const [newItemQty, setNewItemQty] = useState<number | undefined>(undefined);
  const [newItemUnit, setNewItemUnit] = useState('');

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, ShoppingItem[]> = {};
    shoppingList.forEach(item => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [shoppingList]);

  const totalEstimatedCost = useMemo(() => {
    return shoppingList.reduce((acc, it) => acc + (it.estimatedCost || 0), 0);
  }, [shoppingList]);

  const checkedCount = useMemo(() => {
    return shoppingList.filter(it => it.checked).length;
  }, [shoppingList]);

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    onAddItem({
      name: newItemName.trim(),
      category: newItemCategory,
      // Both optional: leave blank to just remind yourself to buy it
      quantity: newItemQty && newItemQty > 0 ? newItemQty : undefined,
      unit: newItemQty && newItemQty > 0 ? newItemUnit || undefined : undefined,
      reason: 'Manual shopping item'
    });

    setNewItemName('');
    setNewItemQty(undefined);
    setNewItemUnit('');
  };

  const handleMoveToInventory = () => {
    const checkedItems = shoppingList.filter(it => it.checked);
    if (checkedItems.length === 0) {
      alert('Please check off the items you have purchased.');
      return;
    }

    onPurchaseAndAddToInventory(checkedItems);
    try {
      confetti({ particleCount: 50, spread: 60 });
    } catch (e) {}
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Summary Card */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-stone-500 uppercase tracking-wider">
            <ShoppingCart className="w-4 h-4 text-emerald-600" />
            <span>Smart Grocery List</span>
          </div>
          <h2 className="text-xl font-bold text-stone-900 mt-1">
            Shopping Checklist & Meal Prep Restock
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Auto-populated from planned weekly meals and ingredients forecasted to deplete.
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Est. Grocery Cost</span>
            <span className="text-xl font-black text-emerald-700">${totalEstimatedCost.toFixed(2)}</span>
          </div>

          <button
            onClick={handleMoveToInventory}
            disabled={checkedCount === 0}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center space-x-2"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Add Bought Items to Pantry ({checkedCount})</span>
          </button>
        </div>
      </div>

      {/* Quick Add Custom Item Form */}
      <form onSubmit={handleManualAdd} className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
        <span className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-2">
          + Add Item to Shopping List
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs">
          <input
            type="text"
            required
            placeholder="Item name (e.g. Avocado, Olive Oil)"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="sm:col-span-2 px-3 py-2 border border-stone-300 rounded-lg text-sm"
          />
          <select
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value as ItemCategory)}
            className="px-3 py-2 border border-stone-300 rounded-lg text-sm"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex space-x-1">
            <NumberField
              value={newItemQty}
              onChange={setNewItemQty}
              allowEmpty
              placeholder="Qty"
              className="w-16 px-2 py-2 border border-stone-300 rounded-lg text-sm text-center"
            />
            <UnitSelect
              value={newItemUnit}
              onChange={setNewItemUnit}
              allowBlank
              className="w-24 px-2 py-2 border border-stone-300 rounded-lg text-sm bg-white"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-lg text-xs sm:text-sm transition-colors"
          >
            Add to List
          </button>
        </div>
        <p className="text-[11px] text-stone-400 mt-2">
          Quantity and unit are optional. The price comes from what you last paid for the same item in your pantry; if it isn't there, no price is shown.
        </p>
      </form>

      {/* Shopping List Items grouped by Aisle */}
      {shoppingList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-200 p-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-stone-900">Your shopping list is clear</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Plan your weekly meals in the Meal Planner and click "Auto-Generate Shopping List" to automatically identify missing ingredients.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(groupedItems).map(([categoryName, items]) => (
            <div key={categoryName} className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
              <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  {categoryName} ({items.length})
                </span>
                <span className="text-xs font-semibold text-emerald-800">
                  ${items.reduce((sum, it) => sum + (it.estimatedCost || 0), 0).toFixed(2)}
                </span>
              </div>

              <div className="divide-y divide-stone-100">
                {items.map(item => (
                  <div
                    key={item.id}
                    className={`p-3.5 flex items-center justify-between transition-colors ${
                      item.checked ? 'bg-emerald-50/40 text-stone-400' : 'hover:bg-stone-50 text-stone-900'
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => onToggleItem(item.id)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <span className={`text-sm font-bold block ${item.checked ? 'line-through text-stone-400' : ''}`}>
                          {item.name}
                        </span>
                        {item.reason && (
                          <span className="text-[11px] text-stone-500 block">
                            {item.reason}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <span className="text-xs font-semibold text-stone-700">
                        {item.quantity ? `${item.quantity} ${item.unit || ''}` : ''}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 w-16 text-right">
                        {item.estimatedCost !== undefined ? `$${item.estimatedCost.toFixed(2)}` : <span className="text-stone-300">no price</span>}
                      </span>
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="text-stone-300 hover:text-red-600 p-1 rounded"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
