import React, { useEffect, useState } from 'react';
import { X, Cpu, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AiStatus, fetchAiStatusApi, testAiApi } from '../services/apiService';

const LABELS: Record<string, string> = { gemini: 'Google Gemini (cloud)', ollama: 'Ollama (local)', openai: 'OpenAI-compatible server (local)' };

export const AiStatusModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { role } = useAuth();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [test, setTest] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAiStatusApi().then(setStatus).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => {
    if (!isOpen || role !== 'admin') return;
    setTest(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    const result = await testAiApi();
    setTest(result.ok ? `It works (answered in ${result.seconds}s).` : `Test failed: ${result.error}`);
    setTesting(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900 flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-emerald-600" />
            <span>AI status</span>
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-sm">
          {role !== 'admin' ? (
            <p className="text-stone-600">Only an admin can see how the AI is set up.</p>
          ) : (
            <>
              {error && <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">{error}</p>}
              {loading && !status && <p className="text-stone-500">Checking…</p>}
              {status && !status.enabled && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 space-y-1.5">
                  <p className="font-semibold">No AI is set up.</p>
                  <p>Receipt scanning and AI recipes need one. Set <code>OLLAMA_MODEL</code> (a local vision model) or <code>GEMINI_API_KEY</code> on the container and restart it. The README has the steps.</p>
                </div>
              )}
              {status?.providers.map((p, i) => (
                <section key={p.provider} className="rounded-xl border border-stone-200 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-stone-900 flex items-center space-x-1.5">
                      {p.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                      <span>{LABELS[p.provider] ?? p.provider}</span>
                    </h3>
                    <span className="text-[11px] text-stone-500">{i === 0 ? 'Tried first' : `Backup #${i}`}</span>
                  </div>
                  <p className="text-xs text-stone-600">
                    Text: <strong>{p.model || '—'}</strong>
                    {p.visionModel && p.visionModel !== p.model ? <> · Receipts (images): <strong>{p.visionModel}</strong></> : null}
                  </p>
                  {p.messages.map((m, j) => <p key={j} className="text-xs text-stone-700">{m}</p>)}
                  {p.installed && p.installed.length > 0 && (
                    <p className="text-[11px] text-stone-500">On the server: {p.installed.slice(0, 12).join(', ')}{p.installed.length > 12 ? '…' : ''}</p>
                  )}
                </section>
              ))}
              {status?.enabled && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={runTest} disabled={testing} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold">
                    {testing ? 'Testing…' : 'Test the AI'}
                  </button>
                  <button onClick={load} disabled={loading} className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs font-semibold inline-flex items-center space-x-1">
                    <RefreshCw className="w-3.5 h-3.5" /><span>Check again</span>
                  </button>
                  {test && <span className={`text-xs ${test.startsWith('It works') ? 'text-emerald-700' : 'text-red-700'}`}>{test}</span>}
                </div>
              )}
              <p className="text-[11px] text-stone-500">The test sends a tiny text question. A local model may take a while the first time while it loads into memory.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
