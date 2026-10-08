import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Camera, 
  Receipt, 
  Sparkles, 
  Check, 
  Trash2, 
  Plus, 
  Store, 
  Calendar, 
  DollarSign,
  AlertCircle,
  Clock
} from 'lucide-react';
import { ItemCategory, ReceiptParsedItem, ReceiptScanResult, StorageLocation } from '../types';
import { scanReceiptApi } from '../services/apiService';
import { UnitSelect } from './UnitSelect';
import { NumberField } from './NumberField';
import { useCurrency, useMeasureMode } from '../context/SettingsContext';
import { normalizeUnit, unitSupportedInMode } from '../utils/units';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItemsToInventory: (items: {
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
  }[], meta?: { store?: string; purchaseDate?: string; rewardsPoints?: number }) => void;
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

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onAddItemsToInventory,
}) => {
  const { fmt, symbol, currency } = useCurrency();
  const measureMode = useMeasureMode();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, stopCamera]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      triggerScan(base64);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setIsCameraActive(false);
      setErrorMessage('Camera access was not granted or not available. You can upload an image or click a sample receipt below.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      stopCamera();
      setImagePreview(dataUrl);
      triggerScan(dataUrl);
    }
  };

  const triggerScan = async (base64Image: string) => {
    setIsScanning(true);
    setErrorMessage(null);
    try {
      const result = await scanReceiptApi(base64Image, 'image/jpeg', measureMode, currency);
      // Standardize units; anything outside the app's measure mode becomes a plain count
      setScanResult({
        ...result,
        items: result.items.map(it => {
          const unit = normalizeUnit(it.unit);
          return { ...it, unit: unitSupportedInMode(unit, measureMode) ? unit : 'count' };
        }),
      });
    } catch (err: any) {
      console.error('Scan error:', err);
      // Clean fallback if server error so user isn't stuck
      setScanResult({
        storeName: 'Grocery Store',
        purchaseDate: new Date().toISOString().split('T')[0],
        subtotal: 0,
        tax: 0,
        total: 0,
        confidenceScore: 0.5,
        items: [
          {
            name: 'Grocery Item',
            category: 'Produce',
            quantity: 1,
            unit: 'count',
            unitPrice: 0,
            totalPrice: 0,
            estimatedShelfLifeDays: 7,
            selected: true,
          }
        ]
      });
      setErrorMessage('Could not auto-detect items from receipt. You can manually enter details below.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleItemToggle = (index: number) => {
    if (!scanResult) return;
    const updated = [...scanResult.items];
    updated[index].selected = !updated[index].selected;
    setScanResult({ ...scanResult, items: updated });
  };

  const handleItemFieldChange = (index: number, field: keyof ReceiptParsedItem, value: any) => {
    if (!scanResult) return;
    const updated = [...scanResult.items];
    (updated[index] as any)[field] = value;
    // Auto recalculate total if unitPrice or quantity change
    if (field === 'quantity' || field === 'unitPrice') {
      const qty = field === 'quantity' ? Number(value) : updated[index].quantity;
      const price = field === 'unitPrice' ? Number(value) : updated[index].unitPrice;
      updated[index].totalPrice = Number((qty * price).toFixed(2));
    }
    setScanResult({ ...scanResult, items: updated });
  };

  const removeItem = (index: number) => {
    if (!scanResult) return;
    const updated = scanResult.items.filter((_, i) => i !== index);
    setScanResult({ ...scanResult, items: updated });
  };

  const addNewItem = () => {
    if (!scanResult) return;
    const newItem: ReceiptParsedItem = {
      name: 'New Grocery Item',
      category: 'Produce',
      quantity: 1,
      unit: 'count',
      unitPrice: 1.99,
      totalPrice: 1.99,
      estimatedShelfLifeDays: 7,
      selected: true
    };
    setScanResult({ ...scanResult, items: [...scanResult.items, newItem] });
  };

  const confirmAddToInventory = () => {
    if (!scanResult) return;

    const purchaseDate = scanResult.purchaseDate || new Date().toISOString().split('T')[0];
    const selectedItems = scanResult.items.filter(item => item.selected !== false);

    if (selectedItems.length === 0) {
      alert('Please select at least one item to add.');
      return;
    }

    const itemsToAdd = selectedItems.map(item => {
      // Calculate expiration date: purchaseDate + estimatedShelfLifeDays
      const pDate = new Date(`${purchaseDate}T00:00:00`);
      const shelfDays = item.estimatedShelfLifeDays || 7;
      pDate.setDate(pDate.getDate() + shelfDays);
      const expirationDate = pDate.toISOString().split('T')[0];

      // Guess storage location based on category
      let location: StorageLocation = 'Pantry';
      if (['Produce', 'Dairy & Eggs', 'Meat & Seafood'].includes(item.category)) {
        location = 'Fridge';
      } else if (item.category === 'Frozen') {
        location = 'Freezer';
      } else if (item.category === 'Spices & Condiments') {
        location = 'Pantry';
      }

      return {
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: normalizeUnit(item.unit || 'count'),
        unitPrice: item.unitPrice,
        totalCost: item.totalPrice,
        purchaseDate,
        expirationDate,
        location,
        notes: `From ${scanResult.storeName || 'Grocery'}`
      };
    });

    onAddItemsToInventory(itemsToAdd, {
      store: scanResult.storeName,
      purchaseDate,
      rewardsPoints: scanResult.rewardsPoints,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden border border-stone-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 flex items-center space-x-2">
                <span>Scan Grocery Receipt</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Gemini Multimodal OCR</span>
                </span>
              </h2>
              <p className="text-xs text-stone-500">
                Snap or upload your paper receipt to automatically log items, prices, and expiration estimates
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Upload or Camera Capture Box */}
          {!scanResult && (
            <div className="border-2 border-dashed border-stone-300 rounded-2xl p-6 text-center hover:border-emerald-500 transition-colors bg-stone-50/50">
              {isCameraActive ? (
                <div className="space-y-4">
                  <div className="relative max-w-md mx-auto rounded-xl overflow-hidden bg-black aspect-3/4">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute inset-0 border-2 border-white/40 pointer-events-none m-6 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-white/80 bg-black/60 px-3 py-1 rounded-full">
                        Align Receipt within Frame
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-center space-x-3">
                    <button
                      onClick={capturePhoto}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm flex items-center space-x-2 shadow-md"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Photo</span>
                    </button>
                    <button
                      onClick={stopCamera}
                      className="px-4 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl font-medium text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : isScanning ? (
                <div className="py-12 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center animate-spin">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-stone-900">Scanning receipt with Gemini Vision...</h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                      Extracting items, grocery categories, quantities, unit prices, and estimating food shelf lives.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-xs">
                    <Receipt className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900">Upload or snap a receipt image</h3>
                    <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                      Supports high-res photos, grocery supermarket receipts, receipts from Costco, Trader Joe's, Whole Foods, Kroger, etc.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-medium inline-flex items-center space-x-2 shadow-sm transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload Receipt Image</span>
                    </button>
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 rounded-xl text-xs sm:text-sm font-medium inline-flex items-center space-x-2 transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Use Camera</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2.5 text-amber-800 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Scanned Results Table & Editor */}
          {scanResult && (
            <div className="space-y-5 animate-fadeIn">
              {/* Receipt Meta Summary Header */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                <div>
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">Store</span>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                    <input
                      type="text"
                      value={scanResult.storeName}
                      onChange={(e) => setScanResult({ ...scanResult, storeName: e.target.value })}
                      className="font-semibold text-stone-900 bg-white border border-stone-200 rounded px-2 py-0.5 text-xs w-full"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">Date</span>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <Calendar className="w-4 h-4 text-stone-500 shrink-0" />
                    <input
                      type="date"
                      value={scanResult.purchaseDate}
                      onChange={(e) => setScanResult({ ...scanResult, purchaseDate: e.target.value })}
                      className="text-stone-800 bg-white border border-stone-200 rounded px-2 py-0.5 text-xs w-full"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">Reward Points</span>
                  <input
                    type="number"
                    min="0"
                    value={scanResult.rewardsPoints ?? ''}
                    placeholder="0"
                    onChange={(e) => setScanResult({
                      ...scanResult,
                      rewardsPoints: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0),
                    })}
                    className="mt-0.5 text-stone-800 bg-white border border-stone-200 rounded px-2 py-0.5 text-xs w-full"
                  />
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">Items Found</span>
                  <span className="text-xs font-semibold text-stone-900 mt-1 block">
                    {scanResult.items.filter(i => i.selected !== false).length} of {scanResult.items.length} selected
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">Total Spent</span>
                  <span className="text-sm font-bold text-emerald-700 mt-0.5 block">
                    {fmt(scanResult.total)}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-stone-100 px-4 py-2.5 border-b border-stone-200 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Extracted Items ({scanResult.items.length})
                  </h4>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={addNewItem}
                      className="inline-flex items-center space-x-1 text-xs text-emerald-700 hover:text-emerald-800 font-semibold px-2 py-1 rounded bg-white border border-emerald-300"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item</span>
                    </button>
                    <button
                      onClick={() => setScanResult(null)}
                      className="text-xs text-stone-500 hover:text-stone-700 underline"
                    >
                      Scan Another
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-72">
                  <table className="min-w-full divide-y divide-stone-200 text-xs">
                    <thead className="bg-stone-50 text-stone-600 font-semibold sticky top-0">
                      <tr>
                        <th className="py-2 px-3 text-left w-8">
                          <input
                            type="checkbox"
                            checked={scanResult.items.every(i => i.selected !== false)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const updated = scanResult.items.map(it => ({ ...it, selected: checked }));
                              setScanResult({ ...scanResult, items: updated });
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                        </th>
                        <th className="py-2 px-3 text-left">Item Name</th>
                        <th className="py-2 px-3 text-left">Category</th>
                        <th className="py-2 px-3 text-left w-20">Qty</th>
                        <th className="py-2 px-3 text-left w-20">Unit</th>
                        <th className="py-2 px-3 text-left w-20">Unit {symbol}</th>
                        <th className="py-2 px-3 text-left w-20">Total {symbol}</th>
                        <th className="py-2 px-3 text-left w-24">Shelf Life</th>
                        <th className="py-2 px-3 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                      {scanResult.items.map((item, idx) => (
                        <tr key={idx} className={item.selected !== false ? 'hover:bg-emerald-50/30' : 'opacity-40 bg-stone-50'}>
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={item.selected !== false}
                              onChange={() => handleItemToggle(idx)}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleItemFieldChange(idx, 'name', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent hover:border-stone-300 focus:border-emerald-500 focus:bg-stone-50 px-1 py-0.5 rounded"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={item.category}
                              onChange={(e) => handleItemFieldChange(idx, 'category', e.target.value as ItemCategory)}
                              className="bg-stone-50 border border-stone-200 rounded px-1.5 py-0.5 text-xs focus:ring-emerald-500"
                            >
                              {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <NumberField
                              value={item.quantity}
                              onChange={(v) => handleItemFieldChange(idx, 'quantity', v ?? 0)}
                              className="w-16 bg-stone-50 border border-stone-200 rounded px-1.5 py-0.5 text-xs text-right"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <UnitSelect
                              value={item.unit}
                              onChange={(unit) => handleItemFieldChange(idx, 'unit', unit)}
                              className="w-24 bg-stone-50 border border-stone-200 rounded px-1 py-0.5 text-xs"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => handleItemFieldChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-16 bg-stone-50 border border-stone-200 rounded px-1.5 py-0.5 text-xs text-right"
                            />
                          </td>
                          <td className="py-2 px-3 font-semibold text-stone-800">
                            {fmt(item.totalPrice)}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center space-x-1">
                              <input
                                type="number"
                                min="1"
                                value={item.estimatedShelfLifeDays}
                                onChange={(e) => handleItemFieldChange(idx, 'estimatedShelfLifeDays', parseInt(e.target.value, 10) || 7)}
                                className="w-12 bg-stone-50 border border-stone-200 rounded px-1 py-0.5 text-xs text-center"
                              />
                              <span className="text-stone-400 text-[10px]">days</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => removeItem(idx)}
                              className="text-stone-400 hover:text-red-600 p-1 rounded"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="text-xs text-stone-500">
            {scanResult ? (
              <span>
                Ready to import <strong>{scanResult.items.filter(i => i.selected !== false).length}</strong> items to pantry inventory
              </span>
            ) : (
              <span>Upload or click a sample receipt to test scanning</span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-100 rounded-xl text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!scanResult || scanResult.items.filter(i => i.selected !== false).length === 0}
              onClick={confirmAddToInventory}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium inline-flex items-center space-x-2 shadow-md transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Confirm & Add to Inventory</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
