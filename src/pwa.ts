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
      console.log('App is ready to work offline');
      onOfflineReady?.();
    },
    onNeedRefresh() {
      console.log('New content available, please refresh');
      onNeedRefresh?.();
    },
    onRegistered(registration) {
      console.log('Service Worker registered:', registration);
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
      console.log('Ready for offline use');
      // Optionally show a toast notification
      if ('toast' in window && typeof window.toast === 'function') {
        // @ts-ignore - toast might be available globally
        window.toast('Ready for offline use', { duration: 3000 });
      }
    },
  };
}