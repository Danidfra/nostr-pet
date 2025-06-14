/// <reference types="vite/client" />

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
  }
}
