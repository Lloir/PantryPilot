import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle, Sparkles, ExternalLink, HelpCircle } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidInstallBannerProps {
  onOpenAPKModal?: () => void;
}

export const AndroidInstallBanner: React.FC<AndroidInstallBannerProps> = ({ onOpenAPKModal }) => {
  const { isInstallable, isInstalled, isAndroid, isIOS, install } = usePWAInstall();
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // If already running as an installed standalone app or dismissed, don't show the banner
  if (isInstalled || isDismissed) {
    return null;
  }

  const handleOpenHub = () => {
    if (onOpenAPKModal) {
      onOpenAPKModal();
    } else {
      setShowAndroidGuide(true);
    }
  };

  return (
    <>
      {/* Top Android Installation Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white px-4 py-2.5 shadow-md border-b border-emerald-600/40 relative z-30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center space-x-3 text-left">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs sm:text-sm font-bold tracking-tight">
                  PantryPal Android App & APK Build
                </span>
                <span className="text-[10px] bg-emerald-400/20 border border-emerald-300/30 text-emerald-200 px-1.5 py-0.2 rounded-full font-semibold">
                  Android Native & APK
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/80 hidden sm:block">
                Download the complete Android Studio project (Kotlin/Compose) to compile your APK, or install directly on Android.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleOpenHub}
              className="px-3.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-xs rounded-lg shadow-sm transition-all flex items-center space-x-1.5 active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>Get Android APK</span>
            </button>

            <button
              onClick={handleOpenHub}
              className="p-1.5 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="Android Installation Guide & APK"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Android & Mobile Installation Modal Guide */}
      {showAndroidGuide && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 text-stone-900">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">Install PantryPal on Android</h3>
                  <p className="text-[11px] text-stone-500">Fast, standalone APK/PWA experience</p>
                </div>
              </div>
              <button
                onClick={() => setShowAndroidGuide(false)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900">Open in Chrome for Android</h4>
                    <p className="text-stone-500 mt-0.5">
                      Open this application in Google Chrome or any Chromium Android browser.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900">Tap "Add to Home screen" or "Install App"</h4>
                    <p className="text-stone-500 mt-0.5">
                      Tap the <strong>three dots (⋮)</strong> menu icon in Chrome's top-right corner and select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900">Launch from App Drawer</h4>
                    <p className="text-stone-500 mt-0.5">
                      PantryPal will be installed as a native standalone Android app icon on your home screen and app launcher.
                    </p>
                  </div>
                </div>
              </div>

              {/* Native Android Features Checklist */}
              <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 space-y-1.5 text-[11px] text-emerald-900">
                <span className="font-bold block uppercase tracking-wider text-[10px] text-emerald-800">
                  Android Features Included:
                </span>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Full-screen standalone display with no URL address bar</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Instant hardware camera access for receipt & barcode OCR</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Offline pantry cache & local database persistence</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Android app shortcuts for quick Receipt and Barcode scanning</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-200">
              <button
                onClick={() => setShowAndroidGuide(false)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
