import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Cloud, CloudOff } from 'lucide-react';

export const OfflineIndicator: React.FC<{
  syncStatus?: 'saved' | 'pending' | 'saving' | 'error';
  onRetry?: () => void;
}> = ({ syncStatus = 'saved', onRetry }) => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && syncStatus === 'saved') return null;

  const message = !isOnline
    ? syncStatus === 'saved' ? 'Offline — changes stay on this device until you reconnect.' : 'Offline — changes are waiting to sync.'
    : syncStatus === 'saving' ? 'Saving pantry changes…'
      : syncStatus === 'error' ? "Couldn't sync changes. We'll keep retrying."
        : 'Pantry changes are waiting to sync.';

  return (
    <div role="status" className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 z-50 flex items-center justify-between gap-3 rounded-2xl bg-stone-900/95 text-white px-4 py-2.5 text-xs font-semibold shadow-xl border border-stone-700 backdrop-blur-md">
      <div className="flex items-center space-x-2">
        {!isOnline ? <WifiOff className="w-4 h-4 text-amber-400" /> : syncStatus === 'error' ? <CloudOff className="w-4 h-4 text-amber-400" /> : <Cloud className="w-4 h-4 text-emerald-400" />}
        <span>{message}</span>
      </div>
      <button
        onClick={onRetry}
        disabled={!isOnline || syncStatus === 'saving'}
        className="px-2 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-300 rounded-lg text-[10px] flex items-center gap-1"
      >
        <RefreshCw className="w-3 h-3" /> Retry sync
      </button>
    </div>
  );
};
