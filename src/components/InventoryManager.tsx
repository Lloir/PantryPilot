import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  Plus, 
  CheckCircle, 
  Clock, 
  Trash2, 
  Edit2, 
  Sparkles, 
  ArrowUpDown, 
  Package, 
  DollarSign, 
  Refrigerator, 
  Layers, 
  Utensils,
  ChevronDown,
  LayoutGrid,
  List
} from 'lucide-react';
import { UnitSelect } from './UnitSelect';
import { InventoryItem, ItemCategory, StorageLocation } from '../types';

interface InventoryManagerProps {
  inventory: InventoryItem[];
  onUpdateItem: (item: InventoryItem) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (item: Omit<InventoryItem, 'id'>) => void;
  onSelectForRecipeSearch: (ingredientName: string) => void;
  onOpenReceiptScanner: () => void;
  onOpenBarcodeScanner: () => void;
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

const LOCATIONS: StorageLocation[] = ['Fridge', 'Freezer', 'Pantry', 'Counter', 'Spice Rack'];

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  inventory,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onSelectForRecipeSearch,
  onOpenReceiptScanner,
  onOpenBarcodeScanner,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'expiring' | 'fresh' | 'abundant'>('All');
  const [sortBy, setSortBy] = useState<'expiry' | 'name' | 'cost' | 'qty'>('expiry');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Manual Add Item Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCat, setNewItemCat] = useState<ItemCategory>('Produce');
  const [newItemQty, setNewItemQty] = useState<number>(1);
  const [newItemUnit, setNewItemUnit] = useState('count');
  const [newItemCost, setNewItemCost] = useState<number>(2.99);
  const [newItemLoc, setNewItemLoc] = useState<StorageLocation>('Fridge');
  const [newItemExp, setNewItemExp] = useState('2026-10-12');
  const [newItemNotes, setNewItemNotes] = useState('');

  // Edit item state
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const today = useMemo(() => new Date('2026-10-05T00:00:00'), []);

  // Helper to compute days until expiration
  const getDaysUntilExpiry = (expDateStr: string): number => {
    if (!expDateStr) return 999;
    const expDate = new Date(`${expDateStr}T00:00:00`);
    const diff = expDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Metrics
  const metrics = useMemo(() => {
    let totalValue = 0;
    let expiringSoonCount = 0;
    let abundantCount = 0;

    inventory.forEach(item => {
      totalValue += item.totalCost || item.quantity * item.unitPrice;
      const days = getDaysUntilExpiry(item.expirationDate);
      if (days >= 0 && days <= 3) {
        expiringSoonCount++;
      }
      if (item.quantity >= 4 || item.category === 'Pantry & Grains') {
        abundantCount++;
      }
    });

    return {
      totalItems: inventory.length,
      totalValue: totalValue.toFixed(2),
      expiringSoonCount,
      abundantCount,
    };
  }, [inventory, today]);

  // Filtered & Sorted Inventory
  const filteredInventory = useMemo(() => {
    return inventory
      .filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        const matchesLocation = selectedLocation === 'All' || item.location === selectedLocation;

        const days = getDaysUntilExpiry(item.expirationDate);
        let matchesStatus = true;
        if (statusFilter === 'expiring') {
          matchesStatus = days <= 3;
        } else if (statusFilter === 'fresh') {
          matchesStatus = days > 3;
        } else if (statusFilter === 'abundant') {
          matchesStatus = item.quantity >= 4 || item.category === 'Pantry & Grains';
        }

        return matchesSearch && matchesCategory && matchesLocation && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'expiry') {
          return getDaysUntilExpiry(a.expirationDate) - getDaysUntilExpiry(b.expirationDate);
        }
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'cost') {
          return (b.totalCost || 0) - (a.totalCost || 0);
        }
        if (sortBy === 'qty') {
          return b.quantity - a.quantity;
        }
        return 0;
      });
  }, [inventory, searchQuery, selectedCategory, selectedLocation, statusFilter, sortBy]);

  const handleQuickQtyChange = (item: InventoryItem, delta: number) => {
    const newQty = Math.max(0, Number((item.quantity + delta).toFixed(2)));
    if (newQty === 0) {
      if (confirm(`Remove "${item.name}" from inventory?`)) {
        onDeleteItem(item.id);
        return;
      }
    }
    const unitPrice = item.unitPrice || (item.totalCost / (item.quantity || 1));
    onUpdateItem({
      ...item,
      quantity: newQty,
      totalCost: Number((newQty * unitPrice).toFixed(2)),
    });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    onAddItem({
      name: newItemName.trim(),
      category: newItemCat,
      quantity: newItemQty,
      unit: newItemUnit,
      unitPrice: Number((newItemCost / (newItemQty || 1)).toFixed(2)),
      totalCost: newItemCost,
      purchaseDate: '2026-10-05',
      expirationDate: newItemExp,
      location: newItemLoc,
      notes: newItemNotes.trim(),
    });

    setIsAddModalOpen(false);
    setNewItemName('');
    setNewItemNotes('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    onUpdateItem(editingItem);
    setEditingItem(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Total Stock</span>
            <Package className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-stone-900">{metrics.totalItems}</span>
            <span className="text-xs text-stone-500">items</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Pantry Value</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-stone-900">${metrics.totalValue}</span>
            <span className="text-xs text-emerald-600 font-semibold">in stock</span>
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'expiring' ? 'All' : 'expiring')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all shadow-2xs ${
            statusFilter === 'expiring'
              ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400'
              : 'bg-amber-50/60 border-amber-200 hover:bg-amber-100/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Expiring Soon</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-amber-900">{metrics.expiringSoonCount}</span>
            <span className="text-xs text-amber-700 font-medium">within 3 days</span>
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'abundant' ? 'All' : 'abundant')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all shadow-2xs ${
            statusFilter === 'abundant'
              ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-400'
              : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider">Abundant Staples</span>
            <Layers className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-stone-900">{metrics.abundantCount}</span>
            <span className="text-xs text-stone-500">items</span>
          </div>
        </div>
      </div>

      {/* Action / Search / Filters Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pantry by name, category, or note..."
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={onOpenReceiptScanner}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center space-x-1.5 shadow-2xs"
            >
              <span>Scan Receipt</span>
            </button>
            <button
              onClick={onOpenBarcodeScanner}
              className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center space-x-1.5 shadow-2xs"
            >
              <span>Scan Barcode</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center space-x-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Item</span>
            </button>
          </div>
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Dropdown */}
            <div className="flex items-center space-x-1 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-stone-400">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent font-medium text-stone-800 focus:outline-hidden"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Storage Location Dropdown */}
            <div className="flex items-center space-x-1 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-stone-400">Location:</span>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="bg-transparent font-medium text-stone-800 focus:outline-hidden"
              >
                <option value="All">All Locations</option>
                {LOCATIONS.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* Status Pills */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setStatusFilter('All')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === 'All' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('expiring')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === 'expiring' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                Expiring
              </button>
              <button
                onClick={() => setStatusFilter('fresh')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === 'fresh' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Fresh
              </button>
            </div>
          </div>

          {/* Sort & View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent font-medium text-stone-800 focus:outline-hidden"
              >
                <option value="expiry">Sort: Expiry Date</option>
                <option value="name">Sort: Name (A-Z)</option>
                <option value="cost">Sort: Cost (High to Low)</option>
                <option value="qty">Sort: Quantity</option>
              </select>
            </div>

            <div className="flex items-center border border-stone-200 rounded-lg p-0.5 bg-stone-50">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white shadow-2xs text-emerald-600' : 'text-stone-400'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1 rounded ${viewMode === 'table' ? 'bg-white shadow-2xs text-emerald-600' : 'text-stone-400'}`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Item Display */}
      {filteredInventory.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-200 p-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-stone-900">No items match your filter</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Try adjusting your search terms or filters, or scan a new grocery receipt to restock your pantry.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSelectedLocation('All');
                setStatusFilter('All');
              }}
              className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-lg"
            >
              Reset Filters
            </button>
            <button
              onClick={onOpenReceiptScanner}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
            >
              Scan Receipt
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInventory.map(item => {
            const daysLeft = getDaysUntilExpiry(item.expirationDate);
            const isExpiring = daysLeft <= 3 && daysLeft >= 0;
            const isExpired = daysLeft < 0;

            return (
              <div 
                key={item.id}
                className={`bg-white rounded-2xl border p-4.5 transition-all hover:shadow-md flex flex-col justify-between ${
                  isExpiring 
                    ? 'border-amber-300 ring-1 ring-amber-200 bg-amber-50/20' 
                    : isExpired 
                      ? 'border-red-300 bg-red-50/20' 
                      : 'border-stone-200'
                }`}
              >
                <div>
                  {/* Top Bar: Category & Expiry Pill */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                      {item.category}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                      isExpired 
                        ? 'bg-red-100 text-red-700' 
                        : isExpiring 
                          ? 'bg-amber-100 text-amber-800 animate-pulse' 
                          : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      <Clock className="w-3 h-3" />
                      <span>
                        {isExpired 
                          ? 'Expired' 
                          : daysLeft === 0 
                            ? 'Expires Today' 
                            : daysLeft === 1 
                              ? 'Expires Tomorrow' 
                              : `Expires in ${daysLeft} days`}
                      </span>
                    </span>
                  </div>

                  {/* Title & Location */}
                  <h3 className="text-base font-bold text-stone-900 tracking-tight leading-snug line-clamp-1" title={item.name}>
                    {item.name}
                  </h3>
                  <div className="flex items-center space-x-2 text-xs text-stone-500 mt-1">
                    <span className="inline-flex items-center space-x-1">
                      <Refrigerator className="w-3 h-3 text-stone-400" />
                      <span>{item.location}</span>
                    </span>
                    {item.notes && (
                      <>
                        <span>•</span>
                        <span className="italic truncate max-w-[150px]">{item.notes}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Middle: Quantity & Stepper */}
                <div className="my-3 py-2.5 px-3 bg-stone-50 rounded-xl flex items-center justify-between border border-stone-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">Quantity</span>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-lg font-bold text-stone-900">{item.quantity}</span>
                      <span className="text-xs text-stone-600 font-medium">{item.unit}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleQuickQtyChange(item, -0.5)}
                      className="w-7 h-7 rounded-lg bg-white border border-stone-200 text-stone-700 font-bold hover:bg-stone-100 flex items-center justify-center transition-colors shadow-2xs"
                      title="Decrease quantity"
                    >
                      -
                    </button>
                    <button
                      onClick={() => handleQuickQtyChange(item, 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-stone-200 text-stone-700 font-bold hover:bg-stone-100 flex items-center justify-center transition-colors shadow-2xs"
                      title="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Cost Info & Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-stone-400 block">Total Cost</span>
                    <span className="text-sm font-bold text-emerald-800">
                      ${(item.totalCost || item.quantity * item.unitPrice).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-stone-500 ml-1">
                      (${item.unitPrice.toFixed(2)}/{item.unit})
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onSelectForRecipeSearch(item.name)}
                      className="px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center space-x-1"
                      title="Find recipes using this item"
                    >
                      <Utensils className="w-3 h-3" />
                      <span>Recipes</span>
                    </button>
                    <button
                      onClick={() => setEditingItem(item)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
                      title="Edit Item"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove "${item.name}" from your inventory?`)) {
                          onDeleteItem(item.id);
                        }
                      }}
                      className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-stone-100 transition-colors"
                      title="Delete Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-xs">
              <thead className="bg-stone-50 text-stone-600 font-semibold">
                <tr>
                  <th className="py-3 px-4 text-left">Item Name</th>
                  <th className="py-3 px-4 text-left">Category</th>
                  <th className="py-3 px-4 text-left">Location</th>
                  <th className="py-3 px-4 text-left">Stock Qty</th>
                  <th className="py-3 px-4 text-left">Unit Price</th>
                  <th className="py-3 px-4 text-left">Total Value</th>
                  <th className="py-3 px-4 text-left">Expiry</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {filteredInventory.map(item => {
                  const daysLeft = getDaysUntilExpiry(item.expirationDate);
                  const isExpiring = daysLeft <= 3 && daysLeft >= 0;

                  return (
                    <tr key={item.id} className={isExpiring ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-stone-50'}>
                      <td className="py-2.5 px-4 font-bold text-stone-900">
                        {item.name}
                        {item.notes && <span className="block text-[10px] font-normal text-stone-500 italic">{item.notes}</span>}
                      </td>
                      <td className="py-2.5 px-4 text-stone-600">{item.category}</td>
                      <td className="py-2.5 px-4 text-stone-600">{item.location}</td>
                      <td className="py-2.5 px-4 font-semibold text-stone-800">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 px-4 text-stone-600">${item.unitPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-4 font-bold text-emerald-800">
                        ${(item.totalCost || item.quantity * item.unitPrice).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          daysLeft <= 1 ? 'bg-red-100 text-red-800' : isExpiring ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                        }`}>
                          {daysLeft < 0 ? 'Expired' : `${daysLeft} days left`}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-1">
                        <button
                          onClick={() => onSelectForRecipeSearch(item.name)}
                          className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-semibold text-[11px]"
                        >
                          Cook
                        </button>
                        <button
                          onClick={() => setEditingItem(item)}
                          className="p-1 text-stone-400 hover:text-stone-700 rounded"
                        >
                          <Edit2 className="w-3.5 h-3.5 inline" />
                        </button>
                        <button
                          onClick={() => onDeleteItem(item.id)}
                          className="p-1 text-stone-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Add Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="text-base font-bold text-stone-900">Add Item to Inventory</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Greek Whole Milk Yogurt"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Category</label>
                  <select
                    value={newItemCat}
                    onChange={(e) => setNewItemCat(e.target.value as ItemCategory)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Storage Location</label>
                  <select
                    value={newItemLoc}
                    onChange={(e) => setNewItemLoc(e.target.value as StorageLocation)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  >
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Unit</label>
                  <UnitSelect
                    value={newItemUnit}
                    onChange={setNewItemUnit}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Total Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newItemCost}
                    onChange={(e) => setNewItemCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Expiration Date</label>
                <input
                  type="date"
                  required
                  value={newItemExp}
                  onChange={(e) => setNewItemExp(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={newItemNotes}
                  onChange={(e) => setNewItemNotes(e.target.value)}
                  placeholder="e.g. Organic, opened yesterday"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="text-base font-bold text-stone-900">Edit Item: {editingItem.name}</h3>
              <button onClick={() => setEditingItem(null)} className="text-stone-400 hover:text-stone-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Category</label>
                  <select
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value as ItemCategory })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Location</label>
                  <select
                    value={editingItem.location}
                    onChange={(e) => setEditingItem({ ...editingItem, location: e.target.value as StorageLocation })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  >
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editingItem.quantity}
                    onChange={(e) => {
                      const qty = parseFloat(e.target.value) || 0;
                      setEditingItem({
                        ...editingItem,
                        quantity: qty,
                        totalCost: Number((qty * editingItem.unitPrice).toFixed(2))
                      });
                    }}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Unit</label>
                  <UnitSelect
                    value={editingItem.unit}
                    onChange={(unit) => setEditingItem({ ...editingItem, unit })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingItem.unitPrice}
                    onChange={(e) => {
                      const uPrice = parseFloat(e.target.value) || 0;
                      setEditingItem({
                        ...editingItem,
                        unitPrice: uPrice,
                        totalCost: Number((editingItem.quantity * uPrice).toFixed(2))
                      });
                    }}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Expiration Date</label>
                <input
                  type="date"
                  value={editingItem.expirationDate}
                  onChange={(e) => setEditingItem({ ...editingItem, expirationDate: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md"
                >
                  Update Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
