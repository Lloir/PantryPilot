import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Timer, Check, List } from 'lucide-react';
import { Recipe } from '../types';

interface CookModeProps {
  recipe: Recipe;
  servings: number;
  onClose: () => void;
}

interface RunningTimer {
  id: number;
  label: string;
  endsAt: number;
  done: boolean;
}

/** "Simmer for 10-15 minutes" -> 12 (minutes), or null when the step has no time in it. */
export function minutesInStep(step: string): number | null {
  const m = step.match(/(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/i);
  if (!m) return null;
  const low = Number(m[1]);
  const high = m[2] ? Number(m[2]) : low;
  const value = (low + high) / 2;
  const unit = m[3].toLowerCase();
  const minutes = unit.startsWith('h') ? value * 60 : unit.startsWith('s') ? value / 60 : value;
  return minutes > 0 ? minutes : null;
}

const fmtClock = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

function beep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach(t => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch (e) {}
  try { navigator.vibrate?.([300, 150, 300]); } catch (e) {}
}

export const CookMode: React.FC<CookModeProps> = ({ recipe, servings, onClose }) => {
  const [step, setStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [, setTick] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const nextId = useRef(1);

  const steps = recipe.instructions.length > 0 ? recipe.instructions : ['Cook and enjoy your meal!'];
  const ratio = servings / recipe.servings;

  // Keep the screen awake while cooking (only where the browser allows it)
  useEffect(() => {
    let lock: any = null;
    const request = async () => {
      try { lock = await (navigator as any).wakeLock?.request('screen'); } catch (e) {}
    };
    request();
    const onVisible = () => { if (document.visibilityState === 'visible') request(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      try { lock?.release(); } catch (e) {}
    };
  }, []);

  // Timers tick once a second and ring when they finish
  useEffect(() => {
    if (timers.every(t => t.done)) return;
    const id = setInterval(() => {
      setTick(n => n + 1);
      setTimers(prev => {
        let rang = false;
        const next = prev.map(t => {
          if (!t.done && Date.now() >= t.endsAt) {
            rang = true;
            return { ...t, done: true };
          }
          return t;
        });
        if (rang) beep();
        return rang ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timers]);

  const stepMinutes = useMemo(() => minutesInStep(steps[step]), [steps, step]);

  const startTimer = (minutes: number, label: string) =>
    setTimers(prev => [...prev, { id: nextId.current++, label, endsAt: Date.now() + minutes * 60000, done: false }]);

  const ingredientText = (i: Recipe['ingredients'][number]) =>
    `${Number((i.quantity * ratio).toFixed(2))} ${i.unit === 'count' ? '' : i.unit} ${i.name}`.replace(/\s+/g, ' ').trim();

  return (
    <div className="fixed inset-0 z-[60] bg-stone-950 text-white flex flex-col" role="dialog" aria-label={`Cooking ${recipe.name}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-emerald-300 font-bold">Cook mode</p>
          <h2 className="text-base font-bold truncate">{recipe.name}</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => setShowIngredients(s => !s)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center space-x-1.5">
            <List className="w-4 h-4" /><span>Ingredients</span>
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" aria-label="Close cook mode"><X className="w-5 h-5" /></button>
        </div>
      </div>

      {timers.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-2 border-b border-white/10">
          {timers.map(t => (
            <div key={t.id} className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold ${t.done ? 'bg-red-500 animate-pulse' : 'bg-emerald-700'}`}>
              <Timer className="w-3.5 h-3.5" />
              <span>{t.label}: {t.done ? "Time's up!" : fmtClock(t.endsAt - Date.now())}</span>
              <button onClick={() => setTimers(prev => prev.filter(x => x.id !== t.id))} aria-label="Dismiss timer"><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {showIngredients ? (
          <ul className="max-w-xl mx-auto p-6 space-y-2">
            {recipe.ingredients.map((i, idx) => (
              <li key={idx}>
                <button
                  onClick={() => setDone(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; })}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-lg flex items-center space-x-3 ${done.has(idx) ? 'border-white/10 text-white/40 line-through' : 'border-white/20'}`}
                >
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${done.has(idx) ? 'bg-emerald-600 border-emerald-600' : 'border-white/40'}`}>
                    {done.has(idx) && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span>{ingredientText(i)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="max-w-2xl mx-auto p-6 flex flex-col justify-center min-h-full space-y-6">
            <p className="text-sm font-bold text-emerald-300">Step {step + 1} of {steps.length}</p>
            <p className="text-2xl sm:text-3xl leading-snug font-medium">{steps[step]}</p>
            {stepMinutes && (
              <button
                onClick={() => startTimer(stepMinutes, `Step ${step + 1}`)}
                className="self-start px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold flex items-center space-x-2"
              >
                <Timer className="w-4 h-4" />
                <span>Start a {Number(stepMinutes.toFixed(1))} minute timer</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-4 border-t border-white/10">
        <button disabled={step === 0} onClick={() => { setStep(s => s - 1); setShowIngredients(false); }} className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 font-bold flex items-center justify-center space-x-2">
          <ChevronLeft className="w-5 h-5" /><span>Back</span>
        </button>
        {step < steps.length - 1 ? (
          <button onClick={() => { setStep(s => s + 1); setShowIngredients(false); }} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold flex items-center justify-center space-x-2">
            <span>Next</span><ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold flex items-center justify-center space-x-2">
            <Check className="w-5 h-5" /><span>Done</span>
          </button>
        )}
      </div>
    </div>
  );
};
