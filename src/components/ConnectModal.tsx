import React, { useEffect, useState } from 'react';
import { X, CalendarDays, Bell, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  NotifyConfig, fetchCalendarLinkApi, fetchNotifyApi, regenerateCalendarLinkApi, saveNotifyApi, testNotifyApi,
} from '../services/apiService';

export const ConnectModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cfg, setCfg] = useState<Omit<NotifyConfig, 'lastSent'>>({ enabled: false, url: '', format: 'ntfy', time: '08:00', daysAhead: 3 });
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setMessage(null);
    fetchCalendarLinkApi().then(p => setCalendarUrl(`${window.location.origin}${p}`)).catch((e) => setError(e.message));
    if (isAdmin) {
      fetchNotifyApi().then(({ lastSent: ls, ...rest }) => { setCfg(rest); setLastSent(ls); }).catch((e) => setError(e.message));
    }
  }, [isOpen, isAdmin]);

  if (!isOpen) return null;

  const copy = () => {
    if (!calendarUrl) return;
    navigator.clipboard?.writeText(calendarUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };

  const act = async (fn: () => Promise<void>, ok: string) => {
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(ok);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900 flex items-center space-x-2">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            <span>Calendar &amp; alerts</span>
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {(error || message) && (
            <p role={error ? 'alert' : 'status'} className={`text-xs font-medium rounded-lg px-3 py-2 border ${error ? 'text-red-700 bg-red-50 border-red-200' : 'text-emerald-800 bg-emerald-50 border-emerald-200'}`}>
              {error || message}
            </p>
          )}

          <section className="space-y-2">
            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Meal plan in your calendar</h3>
            <p className="text-xs text-stone-600">
              Subscribe to this link in Google Calendar, Apple Calendar or Outlook and the meal plan shows up there, and stays up to date. Anyone with the link can see meal names, so only share it with the family.
            </p>
            {calendarUrl && (
              <>
                <div className="flex items-center space-x-2 bg-stone-100 border border-stone-200 rounded-lg px-3 py-2">
                  <code className="text-[11px] text-stone-800 break-all flex-1 select-all">{calendarUrl}</code>
                  <button onClick={copy} className="shrink-0 p-1.5 text-stone-500 hover:text-stone-900" aria-label="Copy link">
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={calendarUrl.replace(/^https?:/, 'webcal:')} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">
                    Add to my calendar
                  </a>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (window.confirm('Make a new link? The old one stops working, so anyone subscribed will need the new one.')) {
                          act(async () => { setCalendarUrl(`${window.location.origin}${await regenerateCalendarLinkApi()}`); }, 'New link made');
                        }
                      }}
                      className="px-3.5 py-2 border border-stone-300 text-stone-700 hover:bg-stone-100 rounded-xl text-xs font-semibold"
                    >
                      Make a new link
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-stone-500">Phones need to be able to reach this server (at home, or through Tailscale or your own address) for the calendar to update.</p>
              </>
            )}
          </section>

          {isAdmin && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Bell className="w-4 h-4 text-emerald-600" />
                <span>Daily alert to your phone</span>
              </h3>
              <p className="text-xs text-stone-600">
                Every morning PantryPal can send one message: food expiring soon, staples running low, and what's planned for today. It uses
                {' '}<a href="https://ntfy.sh" target="_blank" rel="noreferrer" className="underline font-semibold">ntfy</a> (free app for Android and iPhone):
                install it, subscribe to a topic with a hard-to-guess name, and paste its address below, like <code className="bg-stone-100 px-1 rounded">https://ntfy.sh/pantrypal-k3x9-yourfamily</code>.
                Any service that accepts a webhook works too.
              </p>
              <label className="flex items-center space-x-2 text-xs font-semibold text-stone-800">
                <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
                <span>Send the daily alert</span>
              </label>
              <input
                type="url"
                value={cfg.url}
                onChange={(e) => setCfg({ ...cfg, url: e.target.value })}
                placeholder="https://ntfy.sh/your-topic"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
              />
              <div className="grid grid-cols-3 gap-2 text-xs">
                <label className="space-y-1">
                  <span className="block font-semibold text-stone-700">Service</span>
                  <select value={cfg.format} onChange={(e) => setCfg({ ...cfg, format: e.target.value as 'ntfy' | 'json' })} className="w-full px-2 py-2 border border-stone-300 rounded-lg bg-white">
                    <option value="ntfy">ntfy</option>
                    <option value="json">Webhook (JSON)</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block font-semibold text-stone-700">Time</span>
                  <input type="time" value={cfg.time} onChange={(e) => setCfg({ ...cfg, time: e.target.value })} className="w-full px-2 py-2 border border-stone-300 rounded-lg" />
                </label>
                <label className="space-y-1">
                  <span className="block font-semibold text-stone-700">Warn ahead</span>
                  <select value={cfg.daysAhead} onChange={(e) => setCfg({ ...cfg, daysAhead: Number(e.target.value) })} className="w-full px-2 py-2 border border-stone-300 rounded-lg bg-white">
                    {[0, 1, 2, 3, 5, 7].map(d => <option key={d} value={d}>{d === 0 ? 'Same day' : `${d} day${d === 1 ? '' : 's'}`}</option>)}
                  </select>
                </label>
              </div>
              <p className="text-[11px] text-stone-500">The time is the server's clock (set the container's <code>TZ</code> setting if it is off).{lastSent ? ` Last sent ${lastSent}.` : ''}</p>
              <div className="flex space-x-2">
                <button onClick={() => act(() => saveNotifyApi(cfg), 'Saved')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">Save</button>
                <button onClick={() => act(() => testNotifyApi(cfg.url, cfg.format), 'Test alert sent. Check your phone.')} className="px-4 py-2 border border-stone-300 text-stone-800 hover:bg-stone-100 rounded-xl text-xs font-semibold">Send a test</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
