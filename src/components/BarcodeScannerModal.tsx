import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Barcode, 
  Search, 
  Check, 
  Sparkles, 
  Calendar, 
  DollarSign, 
  Tag, 
  Layers, 
  MapPin, 
  AlertCircle,
  Camera,
  RefreshCw
} from 'lucide-react';
import { useCurrency } from '../context/SettingsContext';
import { UnitSelect } from './UnitSelect';
import { NumberField } from './NumberField';
import { CameraProblemNotice } from './CameraProblemNotice';
import { CameraProblem, checkCameraSupport, classifyCameraError, findSecureAddress } from '../utils/camera';
import { normalizeUnit } from '../utils/units';
import { addDaysISO, todayISO } from '../utils/inventoryMerge';
import { ItemCategory, StorageLocation, BarcodeLookupResult, ItemNutrition } from '../types';
import { COMMON_BARCODES_DATABASE } from '../data/initialData';
import { lookupBarcodeApi, saveBarcodeApi } from '../services/apiService';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItemToInventory: (item: {
    name: string;
    category: ItemCategory;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalCost: number;
    purchaseDate: string;
    expirationDate: string;
    location: StorageLocation;
    barcode?: string;
    notes?: string;
    nutrition?: ItemNutrition;
    allergens?: string[];
  }) => void;
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

// What you're in the middle of adding is kept on this device, so leaving the page (or the app) doesn't lose it
const DRAFT_KEY = 'pantrypal_barcode_draft';
interface Draft {
  barcodeInput: string;
  lookupResult: BarcodeLookupResult | null;
  errorMessage: string | null;
  itemName: string;
  category: ItemCategory;
  quantity: number;
  unit: string;
  price: number | undefined;
  location: StorageLocation;
  purchaseDate: string;
  expirationDate: string;
  notes: string;
}
const loadDraft = (): Partial<Draft> => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
};

const SOURCE_LABEL: Record<string, string> = {
  saved: 'Saved by your household',
  local_database: 'Built-in list',
  open_food_facts: 'Open Food Facts',
  barcodelookup_com: 'Barcode Lookup',
  upcitemdb: 'UPCitemdb',
  gemini_guess: 'AI guess: please check the details',
};

const daysBetween = (from: string, to: string) =>
  Math.max(1, Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000));

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onAddItemToInventory,
}) => {
  const { fmt, symbol } = useCurrency();
  const [draft0] = useState<Partial<Draft>>(loadDraft);
  const [barcodeInput, setBarcodeInput] = useState(draft0.barcodeInput ?? '');
  const [isScanningCamera, setIsScanningCamera] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<BarcodeLookupResult | null>(draft0.lookupResult ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(draft0.errorMessage ?? null);
  const [cameraProblem, setCameraProblem] = useState<CameraProblem | null>(null);
  const [secureUrl, setSecureUrl] = useState<string | null>(null);

  // Editable item form fields
  const [itemName, setItemName] = useState(draft0.itemName ?? '');
  const [category, setCategory] = useState<ItemCategory>(draft0.category ?? 'Pantry & Grains');
  const [quantity, setQuantity] = useState<number>(draft0.quantity ?? 1);
  const [unit, setUnit] = useState<string>(draft0.unit ?? 'count');
  const [price, setPrice] = useState<number | undefined>(draft0.price);
  const [location, setLocation] = useState<StorageLocation>(draft0.location ?? 'Pantry');
  const [purchaseDate, setPurchaseDate] = useState<string>(draft0.purchaseDate ?? todayISO());
  const [expirationDate, setExpirationDate] = useState<string>(draft0.expirationDate ?? addDaysISO(todayISO(), 14));
  const [notes, setNotes] = useState<string>(draft0.notes ?? '');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanningCamera(false);
  }, []);

  // Keep the draft on this device until it is added or cleared
  useEffect(() => {
    try {
      if (!itemName && !barcodeInput && !lookupResult) {
        localStorage.removeItem(DRAFT_KEY);
      } else {
        const draft: Draft = {
          barcodeInput, lookupResult, errorMessage, itemName, category, quantity, unit, price,
          location, purchaseDate, expirationDate, notes,
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    } catch (e) {}
  }, [barcodeInput, lookupResult, errorMessage, itemName, category, quantity, unit, price, location, purchaseDate, expirationDate, notes]);

  const clearDraft = () => {
    setBarcodeInput('');
    setLookupResult(null);
    setErrorMessage(null);
    setItemName('');
    setCategory('Pantry & Grains');
    setQuantity(1);
    setUnit('count');
    setPrice(undefined);
    setLocation('Pantry');
    setPurchaseDate(todayISO());
    setExpirationDate(addDaysISO(todayISO(), 14));
    setNotes('');
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, stopCamera]);

  if (!isOpen) return null;

  const handleLookup = async (barcodeToQuery: string) => {
    const code = barcodeToQuery.trim();
    if (!code) return;

    setIsLookingUp(true);
    setErrorMessage(null);

    try {
      // The server checks your saved barcodes, then product databases, then falls back to an AI guess
      const res = await lookupBarcodeApi(code);
      populateFromData(res);
      if (!res.foundInDatabase) {
        setErrorMessage("This barcode wasn't found in any product database. Fill in the details once and PantryPal will remember it next time.");
      }
    } catch (err: any) {
      console.warn('Barcode lookup error:', err);
      // Offline or server problem: fall back to the small built-in list, otherwise let them type it in
      const builtIn = COMMON_BARCODES_DATABASE[code];
      if (builtIn) {
        populateFromData(builtIn);
      } else {
        populateFromData({
          barcode: code, name: '', category: 'Other', averagePrice: 0, standardQuantity: 1, standardUnit: 'count',
          estimatedShelfLifeDays: 30, storageLocation: 'Pantry', foundInDatabase: false, source: 'not_found',
        });
        setErrorMessage("Couldn't reach the product databases. Fill in the details and PantryPal will remember this barcode.");
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const populateFromData = (data: BarcodeLookupResult) => {
    setLookupResult(data);
    setItemName(data.brand ? `${data.brand} ${data.name}` : data.name);
    setCategory(data.category);
    setQuantity(data.standardQuantity || 1);
    setUnit(normalizeUnit(data.standardUnit || 'count'));
    // Only a real recorded price is used; a guess or nothing leaves the box empty
    setPrice(data.source !== 'gemini_guess' && data.averagePrice > 0 ? data.averagePrice : undefined);
    setLocation(data.storageLocation || 'Pantry');

    const todayStr = todayISO();
    setPurchaseDate(todayStr);

    const shelfDays = data.estimatedShelfLifeDays || 14;
    setExpirationDate(addDaysISO(todayStr, shelfDays));

    setNotes(data.barcode ? `Barcode: ${data.barcode}` : '');
  };

  const startCamera = async () => {
    setCameraProblem(null);
    const unsupported = checkCameraSupport();
    if (unsupported) {
      setCameraProblem(unsupported);
      if (unsupported === 'insecure') setSecureUrl(await findSecureAddress());
      return;
    }
    try {
      setIsScanningCamera(true);
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Check if BarcodeDetector API is supported in modern browsers
      if ('BarcodeDetector' in window) {
        // Ask for every product-barcode type the browser can read (EAN-8 is common on UK/EU products)
        const wanted = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];
        let formats = wanted;
        try {
          const supported: string[] = await (window as any).BarcodeDetector.getSupportedFormats();
          formats = wanted.filter(f => supported.includes(f));
        } catch (e) {}
        const barcodeDetector = new (window as any).BarcodeDetector({ formats });

        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === 4) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const detectedCode = barcodes[0].rawValue;
                stopCamera();
                setBarcodeInput(detectedCode);
                handleLookup(detectedCode);
              }
            } catch (e) {
              // ignore frame errors
            }
          }
        }, 500);
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setIsScanningCamera(false);
      setCameraProblem(classifyCameraError(err));
    }
  };

  const submitItem = (keepOpen: boolean) => {
    if (!itemName.trim()) {
      alert('Please enter an item name');
      return;
    }
    const totalCost = price ?? 0;
    const code = (barcodeInput || lookupResult?.barcode || '').trim();

    onAddItemToInventory({
      name: itemName.trim(),
      category,
      quantity,
      unit,
      unitPrice: Number((totalCost / (quantity || 1)).toFixed(2)),
      totalCost,
      purchaseDate,
      expirationDate,
      location,
      barcode: code || undefined,
      notes: notes.trim(),
      nutrition: lookupResult?.nutrition,
      allergens: lookupResult?.allergens,
    });

    // Remember these details for this barcode, so the next scan fills in what you confirmed
    if (code) {
      saveBarcodeApi({
        barcode: code,
        name: itemName.trim(),
        category,
        averagePrice: totalCost,
        standardQuantity: quantity,
        standardUnit: unit,
        estimatedShelfLifeDays: daysBetween(purchaseDate, expirationDate),
        storageLocation: location,
        nutrition: lookupResult?.nutrition,
        allergens: lookupResult?.allergens,
      }).catch(() => {});
    }

    stopCamera();
    clearDraft();
    if (!keepOpen) onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitItem(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-stone-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <Barcode className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 flex items-center space-x-2">
                <span>Scan Barcode (UPC/EAN)</span>
                <span className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-semibold">
                  Auto-Lookup Database
                </span>
              </h2>
              <p className="text-xs text-stone-500">
                Scan product barcode to automatically populate item details, categories, and average pricing
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Camera Viewfinder or Launch Button */}
          {isScanningCamera ? (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-16/9 flex items-center justify-center border-2 border-sky-400 shadow-md">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              {/* Laser Line Animation */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-3/4 h-36 border-2 border-sky-400/80 rounded-xl relative overflow-hidden bg-sky-500/10">
                  <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse top-1/2" />
                </div>
                <span className="text-xs text-white/90 bg-black/70 px-3 py-1 rounded-full mt-3">
                  Center barcode inside red beam
                </span>
              </div>
              <button
                onClick={stopCamera}
                className="absolute top-3 right-3 px-3 py-1 bg-black/60 hover:bg-black/80 text-white rounded-lg text-xs"
              >
                Close Camera
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 bg-sky-50/60 border border-sky-200 rounded-xl">
              <div className="flex items-center space-x-3">
                <Camera className="w-5 h-5 text-sky-600" />
                <div>
                  <h4 className="text-xs font-bold text-sky-900">Live Camera Scanner</h4>
                  <p className="text-[11px] text-sky-700">Point your camera at any food product barcode</p>
                </div>
              </div>
              <button
                onClick={startCamera}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                Open Camera
              </button>
            </div>
          )}

          {cameraProblem && (
            <CameraProblemNotice problem={cameraProblem} secureUrl={secureUrl} alternative="type the barcode number below" />
          )}

          {/* Barcode Search Box */}
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                inputMode="numeric"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLookup(barcodeInput);
                  }
                }}
                placeholder="Type or scan the barcode number (8, 12 or 13 digits)..."
                className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
            <button
              onClick={() => handleLookup(barcodeInput)}
              disabled={isLookingUp || !barcodeInput.trim()}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl inline-flex items-center space-x-1.5 shadow-xs"
            >
              {isLookingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Lookup</span>
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2 text-amber-800 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Item Details Form to Confirm or Edit */}
          <form onSubmit={handleSubmit} className="space-y-4 bg-stone-50/70 p-4 rounded-xl border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Item Details (Review & Edit)
              </h3>
              {(itemName || barcodeInput || lookupResult) && (
                <button type="button" onClick={clearDraft} className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 underline">
                  Start over
                </button>
              )}
              {lookupResult && (
                <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>
                    {SOURCE_LABEL[lookupResult.source ?? ''] ?? (lookupResult.foundInDatabase ? 'Database match' : 'Not found')}
                    {lookupResult.averagePrice > 0 && lookupResult.source !== 'gemini_guess' ? ` · ${fmt(lookupResult.averagePrice)}` : ''}
                  </span>
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Product Name</label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Barilla Penne Pasta"
                className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ItemCategory)}
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Storage Location</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value as StorageLocation)}
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                >
                  {LOCATIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Quantity</label>
                <NumberField
                  value={quantity}
                  onChange={(v) => setQuantity(v ?? 0)}
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Unit</label>
                <UnitSelect
                  value={unit}
                  onChange={setUnit}
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Total Price ({symbol}, optional)</label>
                <NumberField
                  allowEmpty
                  placeholder="Optional"
                  value={price}
                  onChange={setPrice}
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Expiration Date</label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => submitItem(true)}
                className="px-4 py-2.5 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 rounded-xl text-sm font-semibold inline-flex items-center space-x-2 transition-colors"
                title="Add this item and stay here to scan the next one"
              >
                <Barcode className="w-4 h-4" />
                <span>Add &amp; scan next</span>
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold inline-flex items-center space-x-2 shadow-md transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Add to Inventory</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
