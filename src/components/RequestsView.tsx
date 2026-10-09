import React, { useState } from 'react';
import { Inbox, Send, ShoppingCart, CalendarPlus, Check, X, RotateCcw, Trash2, MessageSquare, UtensilsCrossed } from 'lucide-react';
import { ActivityEntry, HouseholdRequest, RequestType } from '../types';
import { UnitSelect } from './UnitSelect';
import { NumberField } from './NumberField';
import { todayISO } from '../utils/inventoryMerge';

interface RequestsViewProps {
  requests: HouseholdRequest[];
  currentUser: string;
  canAnswer: boolean; // admins and members; view-only people can only ask
  onCreate: (request: { type: RequestType; text: string; quantity?: number; unit?: string; date?: string; slot?: string }) => Promise<void>;
  onAnswer: (id: string, status: 'open' | 'done' | 'declined') => void;
  onDelete: (id: string) => void;
  onAddToShopping: (request: HouseholdRequest) => void;
  onAddToPlanner: (request: HouseholdRequest) => void;
  onComment: (id: string, text: string) => Promise<void>;
  activity: ActivityEntry[];
}

const TYPE_LABEL: Record<RequestType, string> = {
  shopping: 'Shopping item',
  meal: 'Meal',
  recipe: 'Recipe idea',
  other: 'Something else',
};

const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;

const TYPE_ICON: Record<RequestType, React.ReactNode> = {
  shopping: <ShoppingCart className="w-4 h-4" />,
  meal: <CalendarPlus className="w-4 h-4" />,
  recipe: <UtensilsCrossed className="w-4 h-4" />,
  other: <MessageSquare className="w-4 h-4" />,
};

const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const RequestsView: React.FC<RequestsViewProps> = ({
  requests,
  currentUser,
  canAnswer,
  onCreate,
  onAnswer,
  onDelete,
  onAddToShopping,
  onAddToPlanner,
  onComment,
  activity,
}) => {
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const sendComment = async (id: string) => {
    const text = draft.trim();
    if (!text) return;
    try {
      await onComment(id, text);
      setDraft('');
    } catch (err: any) {
      setError(err.message || 'Could not add the comment');
    }
  };
  const [type, setType] = useState<RequestType>('shopping');
  const [text, setText] = useState('');
  const [quantity, setQuantity] = useState<number | undefined>(undefined);
  const [unit, setUnit] = useState('');
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState<(typeof SLOTS)[number]>('Dinner');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = requests.filter(r => r.status === 'open');
  const closed = requests.filter(r => r.status !== 'open').slice(0, 20);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({
        type,
        text: text.trim(),
        quantity: type === 'shopping' && quantity && quantity > 0 ? quantity : undefined,
        unit: type === 'shopping' && quantity && quantity > 0 && unit ? unit : undefined,
        date: type === 'meal' ? date : undefined,
        slot: type === 'meal' ? slot : undefined,
      });
      setText('');
      setQuantity(undefined);
      setUnit('');
    } catch (err: any) {
      setError(err.message || 'Could not send the request');
    } finally {
      setBusy(false);
    }
  };

  const detail = (r: HouseholdRequest) => {
    const parts: string[] = [];
    if (r.quantity) parts.push(`${r.quantity}${r.unit ? ` ${r.unit}` : ''}`);
    if (r.type === 'meal' && r.date) parts.push(`${r.slot ?? 'Dinner'} on ${r.date}`);
    return parts.join(' · ');
  };

  const renderRow = (r: HouseholdRequest) => {
    const mine = r.requestedBy === currentUser;
    return (
      <li key={r.id} className="p-3.5 space-y-2">
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center space-x-2 text-sm font-bold text-stone-900">
            <span className="text-stone-400">{TYPE_ICON[r.type]}</span>
            <span className={r.status !== 'open' ? 'line-through text-stone-400' : ''}>{r.text}</span>
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            {TYPE_LABEL[r.type]}
            {detail(r) && ` · ${detail(r)}`} · from <strong>{r.requestedBy}</strong> on {when(r.createdAt)}
            {r.status !== 'open' && r.resolvedBy && (
              <span> · {r.status === 'done' ? 'done' : 'declined'} by {r.resolvedBy}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {r.status === 'open' && canAnswer && (
            <>
              {r.type === 'shopping' && (
                <button onClick={() => onAddToShopping(r)} className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1">
                  <ShoppingCart className="w-3.5 h-3.5" /><span>Add to list</span>
                </button>
              )}
              {r.type === 'meal' && (
                <button onClick={() => onAddToPlanner(r)} className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1">
                  <CalendarPlus className="w-3.5 h-3.5" /><span>Add to planner</span>
                </button>
              )}
              <button onClick={() => onAnswer(r.id, 'done')} className="px-2.5 py-1.5 border border-stone-300 text-stone-700 hover:bg-stone-100 rounded-lg text-xs font-semibold flex items-center space-x-1">
                <Check className="w-3.5 h-3.5" /><span>Done</span>
              </button>
              <button onClick={() => onAnswer(r.id, 'declined')} className="px-2.5 py-1.5 border border-stone-300 text-stone-500 hover:bg-stone-100 rounded-lg text-xs font-semibold flex items-center space-x-1">
                <X className="w-3.5 h-3.5" /><span>Decline</span>
              </button>
            </>
          )}
          {r.status !== 'open' && canAnswer && (
            <button onClick={() => onAnswer(r.id, 'open')} className="px-2.5 py-1.5 border border-stone-300 text-stone-600 hover:bg-stone-100 rounded-lg text-xs font-semibold flex items-center space-x-1">
              <RotateCcw className="w-3.5 h-3.5" /><span>Reopen</span>
            </button>
          )}
          {((mine && r.status === 'open') || canAnswer) && (
            <button
              onClick={() => onDelete(r.id)}
              className="p-1.5 text-stone-300 hover:text-red-600 rounded"
              title={mine && r.status === 'open' ? 'Withdraw this request' : 'Remove'}
              aria-label="Remove request"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => { setOpenThread(openThread === r.id ? null : r.id); setDraft(''); }}
            className="px-2 py-1.5 text-stone-500 hover:text-stone-800 rounded-lg text-xs font-semibold flex items-center space-x-1"
            title="Comments"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{r.comments?.length ? r.comments.length : 'Comment'}</span>
          </button>
        </div>
       </div>
       {(r.comments?.length ?? 0) > 0 && (
         <ul className="ml-6 space-y-1">
           {r.comments!.map(c => (
             <li key={c.id} className="text-[11px] text-stone-600 bg-stone-50 border border-stone-100 rounded-lg px-2.5 py-1.5">
               <strong className="text-stone-800">{c.by}</strong>: {c.text} <span className="text-stone-400">· {when(c.at)}</span>
             </li>
           ))}
         </ul>
       )}
       {openThread === r.id && (
         <form className="ml-6 flex items-center space-x-2" onSubmit={(e) => { e.preventDefault(); sendComment(r.id); }}>
           <input
             autoFocus
             value={draft}
             onChange={(e) => setDraft(e.target.value)}
             maxLength={300}
             placeholder="Add a comment..."
             className="flex-1 px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
           />
           <button type="submit" disabled={!draft.trim()} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold">Send</button>
         </form>
       )}
      </li>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs font-bold text-stone-500 uppercase tracking-wider">
          <Inbox className="w-4 h-4 text-emerald-600" />
          <span>Household Requests</span>
        </div>
        <h2 className="text-xl font-bold text-stone-900 mt-1">Ask for something</h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Out of something, craving a meal, or have a recipe idea? Everyone in the house can leave a request and it shows up here for whoever does the shopping and planning.
        </p>

        <form onSubmit={submit} className="mt-4 grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs items-end">
          <div className="sm:col-span-2">
            <label className="block font-semibold text-stone-700 mb-1">I'd like...</label>
            <select value={type} onChange={(e) => setType(e.target.value as RequestType)} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white">
              {(Object.keys(TYPE_LABEL) as RequestType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="sm:col-span-4">
            <label className="block font-semibold text-stone-700 mb-1">What?</label>
            <input
              type="text"
              required
              maxLength={200}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={type === 'shopping' ? 'e.g. Oat milk' : type === 'meal' ? 'e.g. Lasagna' : 'Tell us more'}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
            />
          </div>

          {type === 'shopping' && (
            <div className="sm:col-span-6 flex items-center space-x-2">
              <NumberField allowEmpty placeholder="Qty (optional)" value={quantity} onChange={setQuantity} className="w-36 px-2 py-2 border border-stone-300 rounded-lg text-sm" />
              <UnitSelect allowBlank value={unit} onChange={setUnit} className="w-28 px-2 py-2 border border-stone-300 rounded-lg text-sm bg-white" />
            </div>
          )}
          {type === 'meal' && (
            <div className="sm:col-span-6 flex items-center space-x-2">
              <input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 border border-stone-300 rounded-lg text-sm" />
              <select value={slot} onChange={(e) => setSlot(e.target.value as (typeof SLOTS)[number])} className="px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white">
                {SLOTS.map(sl => <option key={sl} value={sl}>{sl}</option>)}
              </select>
            </div>
          )}

          <div className="sm:col-span-6 flex items-center justify-between">
            <span role="alert" className="text-red-700 font-medium">{error}</span>
            <button type="submit" disabled={busy || !text.trim()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center space-x-1.5">
              <Send className="w-3.5 h-3.5" /><span>Send request</span>
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-900">Open requests</h3>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">{open.length}</span>
        </div>
        {open.length === 0 ? (
          <p className="p-8 text-center text-sm text-stone-400">Nothing waiting. Requests will show up here.</p>
        ) : (
          <ul className="divide-y divide-stone-100">{open.map(renderRow)}</ul>
        )}
      </div>

      {activity.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
          <div className="px-5 py-3 border-b border-stone-200 bg-stone-50">
            <h3 className="text-sm font-bold text-stone-900">Household activity</h3>
          </div>
          <ul className="divide-y divide-stone-100">
            {activity.slice(0, 20).map(a => (
              <li key={a.id} className="px-5 py-2 text-xs text-stone-600 flex items-baseline justify-between gap-3">
                <span><strong className="text-stone-800">{a.user}</strong> {a.text}</span>
                <span className="text-stone-400 shrink-0">{when(a.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {closed.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
          <div className="px-5 py-3 border-b border-stone-200 bg-stone-50">
            <h3 className="text-sm font-bold text-stone-900">Recently answered</h3>
          </div>
          <ul className="divide-y divide-stone-100">{closed.map(renderRow)}</ul>
        </div>
      )}
    </div>
  );
};
