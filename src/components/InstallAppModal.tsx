import React, { useState } from 'react';
import { X, Smartphone, CheckCircle2, Download, Copy, Check, ShieldCheck, Settings2, Home } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CopyBox: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center space-x-2 bg-stone-100 border border-stone-200 rounded-lg px-3 py-2">
      <code className="text-xs text-stone-800 break-all flex-1 select-all">{value}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }).catch(() => {});
        }}
        className="shrink-0 p-1.5 text-stone-500 hover:text-stone-900 rounded"
        aria-label="Copy"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
};

const Step: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <li className="flex items-start space-x-2.5">
    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
    <span className="text-xs text-stone-700 leading-relaxed">{children}</span>
  </li>
);

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isAndroid, isIOS, isSecure, origin, install } = usePWAInstall();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900 flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-emerald-600" />
            <span>Install PantryPal as an app</span>
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {isInstalled ? (
            <div className="flex items-center space-x-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>PantryPal is already installed on this device and is running as an app.</span>
            </div>
          ) : isInstallable ? (
            <div className="space-y-3">
              <p className="text-xs text-stone-600">
                Your browser can install PantryPal right now. It gets its own icon and opens full screen, with no address bar.
              </p>
              <button
                onClick={async () => { if (await install()) onClose(); }}
                className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold inline-flex items-center justify-center space-x-2 shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Install PantryPal</span>
              </button>
            </div>
          ) : !isSecure ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5">
                <p className="font-bold">Why there's no install button here</p>
                <p>
                  Browsers only offer "install" (and the camera) on secure pages. You're on <strong>{origin}</strong>, which is plain http, so
                  Chrome treats it as an ordinary website. No QR code or APK is needed. Pick one of these:
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-xs font-bold text-stone-900 flex items-center space-x-1.5"><ShieldCheck className="w-4 h-4 text-emerald-600" /><span>Option 1: a trusted https address (best, works on every phone)</span></h3>
                <p className="text-xs text-stone-600">
                  Give PantryPal a proper https address and Chrome will show Install, the camera will work, and there are no warnings. The easy ways on Unraid:
                </p>
                <ul className="text-xs text-stone-600 list-disc pl-5 space-y-1">
                  <li><strong>Tailscale</strong> (free): install the Tailscale plugin, then run <code className="bg-stone-100 px-1 rounded">tailscale serve --bg 3000</code>. You get a real https address like <code className="bg-stone-100 px-1 rounded">https://your-server.your-tailnet.ts.net</code>. Install Tailscale on the phones too.</li>
                  <li><strong>Your own domain</strong> with Nginx Proxy Manager or SWAG (point it at port 3000, let it get a free certificate).</li>
                  <li><strong>Cloudflare Tunnel</strong> if you want it reachable away from home.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-bold text-stone-900 flex items-center space-x-1.5"><Settings2 className="w-4 h-4 text-emerald-600" /><span>Option 2: one-time setting on each Android phone (no setup on the server)</span></h3>
                <ol className="space-y-2">
                  <Step n={1}>In Chrome on the phone, type <code className="bg-stone-100 px-1 rounded">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> into the address bar.</Step>
                  <Step n={2}>Turn it <strong>Enabled</strong> and paste this address into the box:</Step>
                </ol>
                <CopyBox value={origin} />
                <ol className="space-y-2" start={3}>
                  <Step n={3}>Tap <strong>Relaunch</strong>, then open PantryPal again. The camera now works and Chrome offers <strong>Install app</strong> in the ⋮ menu (or the button above).</Step>
                </ol>
                <p className="text-[11px] text-stone-500">This only applies to that phone and that address. If your server's IP changes, repeat it with the new address.</p>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-bold text-stone-900 flex items-center space-x-1.5"><Home className="w-4 h-4 text-emerald-600" /><span>Option 3: just a home-screen shortcut</span></h3>
                <p className="text-xs text-stone-600">
                  In Chrome tap ⋮ then <strong>Add to Home screen</strong>. It's a shortcut to the website: it opens in the browser, with no
                  camera on this address. {isIOS ? 'On iPhone: Share, then Add to Home Screen.' : ''}
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-stone-600">
                Your browser hasn't offered an install button yet. You can still install it from the browser menu:
              </p>
              <ol className="space-y-2">
                {isIOS ? (
                  <>
                    <Step n={1}>Open this page in <strong>Safari</strong>.</Step>
                    <Step n={2}>Tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.</Step>
                  </>
                ) : isAndroid ? (
                  <>
                    <Step n={1}>Open this page in <strong>Chrome</strong>.</Step>
                    <Step n={2}>Tap <strong>⋮</strong> (top right), then <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</Step>
                    <Step n={3}>If neither shows, use PantryPal for a minute or two and check the menu again. Chrome waits a little before offering it.</Step>
                  </>
                ) : (
                  <>
                    <Step n={1}>In Chrome or Edge, click the <strong>install icon</strong> at the right end of the address bar (or the menu, then <strong>Install PantryPal</strong>).</Step>
                  </>
                )}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
