import { registerSW } from 'virtual:pwa-register';

interface PWARegisterOptions {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration) => void;
  onRegisterError?: (error: Error) => void;
}

export function setupPWA(options: PWARegisterOptions = {}) {
  const {
    onNeedRefresh,
    onOfflineReady,
    onRegistered,
    onRegisterError,
  } = options;

  const updateSW = registerSW({
    onOfflineReady() {

      onOfflineReady?.();
    },
    onNeedRefresh() {

      onNeedRefresh?.();
    },
    onRegistered(registration) {

      onRegistered?.(registration);
    },
    onRegisterError(error) {
      console.error('Service Worker registration error:', error);
      onRegisterError?.(error);
    },
  });

  return { updateSW };
}

// Toast notification handler for PWA updates
export function createPWAToastHandler() {
  return {
    onNeedRefresh: () => {
      if (confirm('New version available — Reload?')) {
        window.location.reload();
      }
    },
    onOfflineReady: () => {

      // Optionally show a toast notification
      if ('toast' in window && typeof window.toast === 'function') {
        // @ts-ignore - toast might be available globally
        window.toast('Ready for offline use', { duration: 3000 });
      }
    },
  };
}