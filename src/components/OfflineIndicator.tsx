import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
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

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 z-50 flex items-center justify-between gap-3 rounded-2xl bg-stone-900/95 text-white px-4 py-2.5 text-xs font-semibold shadow-xl border border-stone-700 backdrop-blur-md animate-bounce">
      <div className="flex items-center space-x-2">
        <WifiOff className="w-4 h-4 text-amber-400" />
        <span>Offline Mode — Cached pantry data & recipes are active.</span>
      </div>
      <button 
        onClick={() => window.location.reload()}
        className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-[10px]"
      >
        Retry
      </button>
    </div>
  );
};
