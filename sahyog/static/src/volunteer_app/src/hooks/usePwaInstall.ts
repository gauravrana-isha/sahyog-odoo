import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      const val = localStorage.getItem('sahyog_pwa_dismissed');
      if (!val) return false;
      // Allow re-prompting after 7 days
      const ts = parseInt(val, 10);
      return Date.now() - ts < 7 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }
    // iOS standalone check
    if ((navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      setIsInstalled(true);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem('sahyog_pwa_dismissed', String(Date.now()));
    } catch { /* ignore */ }
  }, []);

  // Show the banner if: not installed, not dismissed, and either we have a prompt (Android/Chrome)
  // or it's iOS Safari (which doesn't fire beforeinstallprompt)
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(window as any).MSStream;
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;
  const showIosBanner = isIos && !isInStandaloneMode;

  const canShow = !isInstalled && !dismissed && (deferredPrompt !== null || showIosBanner);

  return { canShow, isIos: showIosBanner, install, dismiss };
}
