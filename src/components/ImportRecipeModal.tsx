import React, { useState } from 'react';
import { X, Link2, ClipboardPaste, Loader2, Download } from 'lucide-react';
import { importRecipeFromUrlApi, parseRecipeTextApi } from '../services/apiService';
import { ImportedRecipe } from '../utils/recipeImport';

interface ImportRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (recipe: ImportedRecipe) => void;
}

export const ImportRecipeModal: React.FC<ImportRecipeModalProps> = ({ isOpen, onClose, onImported }) => {
  const [mode, setMode] = useState<'link' | 'text'>('link');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = mode === 'link' ? await importRecipeFromUrlApi(url.trim()) : await parseRecipeTextApi(text);
      onImported(result.recipe);
      setUrl('');
      setText('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not import that recipe');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <form onSubmit={run} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-stone-900 flex items-center space-x-2">
            <Download className="w-5 h-5 text-emerald-600" />
            <span>Import a recipe</span>
          </h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex space-x-1 bg-stone-100 rounded-lg p-1 text-xs font-semibold">
          <button type="button" onClick={() => setMode('link')} className={`flex-1 py-1.5 rounded-md flex items-center justify-center space-x-1.5 ${mode === 'link' ? 'bg-white shadow-2xs text-emerald-700' : 'text-stone-500'}`}>
            <Link2 className="w-3.5 h-3.5" /><span>From a link</span>
          </button>
          <button type="button" onClick={() => setMode('text')} className={`flex-1 py-1.5 rounded-md flex items-center justify-center space-x-1.5 ${mode === 'text' ? 'bg-white shadow-2xs text-emerald-700' : 'text-stone-500'}`}>
            <ClipboardPaste className="w-3.5 h-3.5" /><span>Paste text (AI)</span>
          </button>
        </div>

        {mode === 'link' ? (
          <div className="space-y-1.5">
            <input
              type="url"
              required
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.example.com/recipes/pancakes"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
            />
            <p className="text-[11px] text-stone-500">Works with most recipe sites. You can review and change everything before it is saved.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <textarea
              required
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the recipe here: the ingredients and the method."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
            />
            <p className="text-[11px] text-stone-500">Uses the AI (needs the Gemini key on the server) to read it into ingredients and steps.</p>
          </div>
        )}

        {error && <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex justify-end space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-stone-300 text-stone-700 rounded-xl text-sm font-medium">Cancel</button>
          <button type="submit" disabled={busy} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center space-x-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{busy ? 'Reading...' : 'Import'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
