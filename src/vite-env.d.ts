/// <reference types="vite/client" />

// Virtual module for PWA registration
declare module 'virtual:pwa-register' {
  export function registerSW(options?: {
    immediate?: boolean;
    onOfflineReady?: () => void;
    onNeedRefresh?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration) => void;
    onRegisterError?: (error: Error) => void;
  }): (reloadPage?: boolean) => Promise<void>;
}

// Global window properties for Blobbi Companion
declare global {
  interface Window {
    blobbiCompanion?: {
      show: () => void;
      hide: () => void;
      setPosition: (x: number, y: number) => void;
      loadCustomSVG: (url: string) => void;
      destroy: () => void;
    };
    openFeedModal?: () => void;
    flammiToast?: (message: string, title?: string) => void;
    documentPictureInPicture?: {
      requestWindow(options?: {
        width?: number;
        height?: number;
      }): Promise<Window>;
      window: Window | null;
    };
  }

  interface DocumentPictureInPictureEvent extends Event {
    window: Window;
  }
}
