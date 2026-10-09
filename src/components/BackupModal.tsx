import React, { useEffect, useRef, useState } from 'react';
import { X, DatabaseBackup, Download, Upload, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BackupInfo, createBackupApi, fetchBackupsApi, importSnapshotApi, restoreBackupApi } from '../services/apiService';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const BackupModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    if (!isAdmin) return;
    fetchBackupsApi().then(setBackups).catch((e) => setError(e.message));
  };
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setMessage(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const run = async (fn: () => Promise<void>, done: string, reload = false) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(done);
      if (reload) setTimeout(() => window.location.reload(), 900);
      else load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    let snapshot: unknown;
    try {
      snapshot = JSON.parse(await file.text());
    } catch {
      setError("That file isn't a PantryPal export");
      return;
    }
    if (!window.confirm('Replace everything in PantryPal with the contents of this file? A backup of the current data is made first.')) return;
    run(() => importSnapshotApi(snapshot), 'Imported. Reloading...', true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900 flex items-center space-x-2">
            <DatabaseBackup className="w-5 h-5 text-emerald-600" />
            <span>Backup &amp; data</span>
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {(error || message) && (
            <p role={error ? 'alert' : 'status'} className={`text-xs font-medium rounded-lg px-3 py-2 border ${error ? 'text-red-700 bg-red-50 border-red-200' : 'text-emerald-800 bg-emerald-50 border-emerald-200'}`}>
              {error || message}
            </p>
          )}

          <section className="space-y-2">
            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Download</h3>
            <div className="flex flex-wrap gap-2">
              <a href="/api/export" download className="px-3.5 py-2 border border-stone-300 text-stone-800 hover:bg-stone-100 rounded-xl text-xs font-semibold flex items-center space-x-1.5">
                <Download className="w-4 h-4" /><span>Everything (JSON)</span>
              </a>
              <a href="/api/export/inventory.csv" download className="px-3.5 py-2 border border-stone-300 text-stone-800 hover:bg-stone-100 rounded-xl text-xs font-semibold flex items-center space-x-1.5">
                <Download className="w-4 h-4" /><span>Pantry (spreadsheet)</span>
              </a>
            </div>
            <p className="text-[11px] text-stone-500">Passwords are never included. The JSON file can be restored later (below).</p>
          </section>

          {isAdmin ? (
            <>
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Saved backups</h3>
                  <button disabled={busy} onClick={() => run(createBackupApi, 'Backup saved')} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold">
                    Back up now
                  </button>
                </div>
                <p className="text-[11px] text-stone-500">A backup is made automatically every day (the last 14 are kept) in the <code>backups</code> folder of your data folder.</p>
                {backups.length === 0 ? (
                  <p className="text-xs text-stone-400">No backups yet.</p>
                ) : (
                  <ul className="divide-y divide-stone-100 border border-stone-200 rounded-xl">
                    {backups.map(b => (
                      <li key={b.name} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0">
                          <span className="font-semibold text-stone-800">{when(b.createdAt)}</span>
                          <span className="text-stone-400"> · {b.kind === 'auto' ? 'automatic' : b.kind === 'manual' ? 'manual' : 'before a restore'} · {Math.max(1, Math.round(b.size / 1024))} KB</span>
                        </span>
                        <span className="flex items-center space-x-1 shrink-0">
                          <a href={`/api/backups/${encodeURIComponent(b.name)}`} download className="p-1.5 text-stone-400 hover:text-stone-800" title="Download" aria-label="Download backup"><Download className="w-4 h-4" /></a>
                          <button
                            disabled={busy}
                            onClick={() => { if (window.confirm(`Go back to the ${when(b.createdAt)} backup? Everything added since then is replaced (a backup of the current data is made first).`)) run(() => restoreBackupApi(b.name), 'Restored. Reloading...', true); }}
                            className="p-1.5 text-stone-400 hover:text-amber-700" title="Restore this backup" aria-label="Restore backup"
                          ><RotateCcw className="w-4 h-4" /></button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Restore from a file</h3>
                <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
                <button disabled={busy} onClick={() => fileRef.current?.click()} className="px-3.5 py-2 border border-stone-300 text-stone-800 hover:bg-stone-100 rounded-xl text-xs font-semibold flex items-center space-x-1.5">
                  <Upload className="w-4 h-4" /><span>Choose an export file...</span>
                </button>
              </section>
            </>
          ) : (
            <p className="text-xs text-stone-500">Backups and restoring are managed by an admin.</p>
          )}
        </div>
      </div>
    </div>
  );
};
