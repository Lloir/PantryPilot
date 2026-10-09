import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Chrome fires `beforeinstallprompt` once, early. It is caught here, when the app loads, so that
// the install button works no matter which screen asks for it later.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedViaPrompt = false;
const listeners = new Set<() => void>();

const detect = () => {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent.toLowerCase();
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://'));
  return {
    isInstallable: deferredPrompt !== null,
    isInstalled: installedViaPrompt || Boolean(standalone),
    isAndroid: /android/.test(ua),
    isIOS: /iphone|ipad|ipod/.test(ua),
    // Browsers only allow installing (and the camera) on https pages or localhost
    isSecure: typeof window !== 'undefined' && window.isSecureContext,
    origin: typeof window !== 'undefined' ? window.location.origin : '',
  };
};

let snapshot = detect();
const refresh = () => {
  snapshot = detect();
  listeners.forEach(l => l());
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault(); // keep it so our own button can show the prompt
    deferredPrompt = e as BeforeInstallPromptEvent;
    refresh();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedViaPrompt = true;
    refresh();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function usePWAInstall() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);

  /** Shows the browser's install prompt. Returns true if the person accepted it. */
  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'accepted') installedViaPrompt = true;
    refresh();
    return outcome === 'accepted';
  };

  return { ...state, install };
}
