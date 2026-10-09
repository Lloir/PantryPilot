import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const DISMISS_KEY = 'pantrypal_install_banner_dismissed';

/** A slim strip offering to install the app. Only shown where it can actually help, and easy to dismiss for good. */
export const InstallBanner: React.FC<{ onOpenGuide: () => void }> = ({ onOpenGuide }) => {
  const { isInstallable, isInstalled, isAndroid, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  const onPhone = isAndroid || isIOS;
  if (isInstalled || dismissed || !(isInstallable || onPhone)) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
  };

  return (
    <div className="bg-emerald-700 text-white px-4 py-2 border-b border-emerald-600/40 relative z-30">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5 min-w-0">
          <Smartphone className="w-4 h-4 text-emerald-200 shrink-0" />
          <span className="text-xs sm:text-sm font-medium truncate">Install PantryPal as an app on this device</span>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => (isInstallable ? install() : onOpenGuide())}
            className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-xs rounded-lg shadow-sm flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isInstallable ? 'Install' : 'How to install'}</span>
          </button>
          <button onClick={dismiss} className="p-1.5 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10" title="Don't show again" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
