import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  Download, 
  CheckCircle, 
  ExternalLink, 
  Terminal, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidAPKModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidAPKModal: React.FC<AndroidAPKModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, install } = usePWAInstall();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-4lebrnbi4nddpwfhylui4o-893915589072.europe-west2.run.app';
  const pwaBuilderUrl = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(currentOrigin)}`;

  const bubblewrapCommand = `npx @bubblewrap/cli init --manifest=${currentOrigin}/manifest.webmanifest\nnpx @bubblewrap/cli build`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-stone-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-gradient-to-r from-emerald-800 to-teal-800 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-300">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold">Get Android APK Package</h2>
                <span className="text-[10px] bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 px-2 py-0.5 rounded-full font-bold uppercase">
                  Android Ready
                </span>
              </div>
              <p className="text-xs text-emerald-100/80">
                PantryPal is fully packaged for Android devices via WebAPK, PWABuilder, and Google Bubblewrap
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-stone-900">
          {/* Method 1: Instant Native WebAPK (Direct onto phone) */}
          <div className="p-4.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/40 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-extrabold text-xs">
                  1
                </span>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 flex items-center space-x-1.5">
                    <span>Direct Android WebAPK Install</span>
                    <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.2 rounded-full font-bold">
                      Recommended
                    </span>
                  </h3>
                  <p className="text-xs text-stone-600 mt-0.5">
                    Android's native WebAPK engine packages this app directly into an Android package installed in your app drawer.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs space-y-2 text-stone-700">
              <div className="flex items-center space-x-2 text-emerald-800 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>No sideloading or "Unknown Sources" warnings required</span>
              </div>
              <p className="text-[11px] text-stone-500">
                On your Android phone, open Chrome and tap <strong>"Install App"</strong> or tap the button below. Android will generate and install the official signed WebAPK into your phone's app drawer.
              </p>

              {/* QR Code and URL Sharing */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-emerald-100">
                <div className="bg-white p-1.5 rounded-lg border border-stone-200 shadow-2xs shrink-0 text-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(currentOrigin)}`}
                    alt="Scan with Android Camera"
                    className="w-24 h-24 rounded"
                  />
                  <span className="text-[9px] text-stone-500 font-medium block mt-0.5">Scan with Android</span>
                </div>
                <div className="space-y-1.5 flex-1 w-full">
                  <div className="text-[11px] font-semibold text-stone-700">Open on Android Phone:</div>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      readOnly
                      value={currentOrigin}
                      className="bg-stone-50 border border-stone-200 text-stone-600 px-2.5 py-1.5 rounded-lg text-xs flex-1 font-mono select-all truncate"
                    />
                    <button
                      onClick={() => copyToClipboard(currentOrigin, 'url')}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shrink-0 flex items-center space-x-1"
                    >
                      {copiedCode === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode === 'url' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-stone-500">
                    Scan the QR code with your phone camera or copy this link into Chrome on Android.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={async () => {
                  if (isInstallable) {
                    await install();
                  } else {
                    alert('To install the WebAPK on your Android device:\n1. Scan the QR code above or open this URL in Chrome on Android\n2. Tap the ⋮ menu in the top-right\n3. Tap "Install App" or "Add to Home screen"');
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>{isInstallable ? 'Install WebAPK Now' : 'Install on Android Phone'}</span>
              </button>

              <span className="text-[11px] text-stone-500">
                Package ID: <code className="bg-stone-100 px-1 py-0.5 rounded font-mono text-[10px]">com.pantrypal.app</code>
              </span>
            </div>
          </div>

          {/* Method 2: 1-Click Standalone APK (.apk & .aab) via PWABuilder */}
          <div className="p-4.5 rounded-2xl border border-stone-200 bg-stone-50/70 space-y-3">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded-full bg-stone-800 text-white flex items-center justify-center font-extrabold text-xs">
                2
              </span>
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Generate Sideloadable APK & Google Play AAB
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Generate a downloadable <code>.apk</code> file for sideloading or <code>.aab</code> for Google Play Store.
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              We have configured this app with full manifest compliance, 512x512 maskable icons, and digital asset links. You can generate the compiled APK file in 1 click using <strong>PWABuilder</strong> (backed by Microsoft & Google):
            </p>

            <div>
              <a
                href={pwaBuilderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <span>Compile APK on PWABuilder</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Method 3: Command-Line Bubblewrap CLI (For Android Developers) */}
          <div className="p-4.5 rounded-2xl border border-stone-200 bg-stone-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="w-6 h-6 rounded-full bg-stone-800 text-white flex items-center justify-center font-extrabold text-xs">
                  3
                </span>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    Build with Google Bubblewrap CLI
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Generate the native Android Studio project and APK locally
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-stone-900 text-stone-200 p-3 rounded-xl font-mono text-[11px] relative group">
              <pre className="whitespace-pre-wrap">{bubblewrapCommand}</pre>
              <button
                onClick={() => copyToClipboard(bubblewrapCommand, 'bubblewrap')}
                className="absolute top-2 right-2 p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs flex items-center space-x-1"
                title="Copy command"
              >
                {copiedCode === 'bubblewrap' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span className="text-[10px]">{copiedCode === 'bubblewrap' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="text-[11px] text-stone-500">
              Configuration ready: <code>public/twa-manifest.json</code> and <code>public/.well-known/assetlinks.json</code> are pre-configured.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="text-xs text-stone-500 flex items-center space-x-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Android Manifest, Icons, and AssetLinks Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
