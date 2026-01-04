import { useState, useCallback, useRef, useEffect } from 'react';
import { Blobbi } from '@/types/blobbi';
import { useToast } from '@/hooks/useToast';

interface PiPState {
  isActive: boolean;
  activeBlobbiId: string | null;
  isLoading: boolean;
}

interface BlobbiPiPController {
  isPiPActive: boolean;
  activeBlobbiId: string | null;
  isLoading: boolean;
  isPiPSupported: boolean;
  startPiP: (params: { blobbiId: string; blobbi: Blobbi }) => Promise<void>;
  stopPiP: () => void;
}

// Global state to persist across component unmounts
let globalPiPState: PiPState = {
  isActive: false,
  activeBlobbiId: null,
  isLoading: false,
};

// Global PiP window reference
let globalPiPWindow: Window | null = null;

// Subscribers for state changes
const subscribers = new Set<(state: PiPState) => void>();

function notifySubscribers() {
  subscribers.forEach(callback => callback(globalPiPState));
}

/**
 * Centralized Picture-in-Picture controller for Blobbi
 * Manages PiP state globally across the application
 */
export function useBlobbiPiPController(): BlobbiPiPController {
  const { toast } = useToast();
  const [localState, setLocalState] = useState<PiPState>(globalPiPState);
  
  const [isPiPSupported] = useState(() => {
    return 'documentPictureInPicture' in window;
  });

  // Subscribe to global state changes
  useEffect(() => {
    const updateState = (state: PiPState) => {
      setLocalState({ ...state });
    };
    
    subscribers.add(updateState);
    
    return () => {
      subscribers.delete(updateState);
    };
  }, []);

  /**
   * Start PiP for a specific Blobbi
   * If PiP is already active for a different Blobbi, it will be switched
   */
  const startPiP = useCallback(async ({ blobbiId, blobbi }: { blobbiId: string; blobbi: Blobbi }) => {
    if (!isPiPSupported) {
      toast({
        title: "PiP Not Supported",
        description: "Your browser doesn't support Picture-in-Picture mode.",
        variant: "destructive",
      });
      return;
    }

    // If already active for this Blobbi, do nothing
    if (globalPiPState.isActive && globalPiPState.activeBlobbiId === blobbiId) {
      return;
    }

    // Update loading state
    globalPiPState = { ...globalPiPState, isLoading: true };
    notifySubscribers();

    try {
      // Close existing PiP window if switching Blobbis
      if (globalPiPWindow && globalPiPState.activeBlobbiId !== blobbiId) {
        globalPiPWindow.close();
        globalPiPWindow = null;
      }

      // For browsers that support Document Picture-in-Picture API
      const docPiP = (window as Window & { 
        documentPictureInPicture?: { 
          requestWindow: (options: { width: number; height: number }) => Promise<Window> 
        } 
      }).documentPictureInPicture;

      if (!docPiP) {
        throw new Error('Document Picture-in-Picture API not available');
      }

      const pipWindow = await docPiP.requestWindow({
        width: 300,
        height: 300,
      });

      globalPiPWindow = pipWindow;

      // Copy styles from parent document
      const styleSheets = Array.from(document.styleSheets);
      styleSheets.forEach((styleSheet) => {
        try {
          const cssRules = Array.from(styleSheet.cssRules)
            .map((rule) => rule.cssText)
            .join('');
          const style = pipWindow.document.createElement('style');
          style.textContent = cssRules;
          pipWindow.document.head.appendChild(style);
        } catch (e) {
          // Some stylesheets may not be accessible due to CORS
          const link = pipWindow.document.createElement('link');
          link.rel = 'stylesheet';
          link.href = (styleSheet as CSSStyleSheet).href || '';
          if (link.href) {
            pipWindow.document.head.appendChild(link);
          }
        }
      });

      // Create container for Blobbi
      const container = pipWindow.document.createElement('div');
      container.id = 'blobbi-pip-container';
      container.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        position: relative;
        overflow: hidden;
      `;

      // Add close button
      const closeButton = pipWindow.document.createElement('button');
      closeButton.textContent = '×';
      closeButton.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        transition: background 0.2s;
      `;
      closeButton.onmouseover = () => {
        closeButton.style.background = 'rgba(0, 0, 0, 0.7)';
      };
      closeButton.onmouseout = () => {
        closeButton.style.background = 'rgba(0, 0, 0, 0.5)';
      };
      closeButton.onclick = () => {
        pipWindow.close();
      };

      container.appendChild(closeButton);
      pipWindow.document.body.appendChild(container);

      // Trigger custom event to render Blobbi in PiP window
      window.dispatchEvent(new CustomEvent('blobbi-pip-opened', {
        detail: { window: pipWindow, blobbi }
      }));

      // Handle PiP window close
      pipWindow.addEventListener('pagehide', () => {
        globalPiPState = {
          isActive: false,
          activeBlobbiId: null,
          isLoading: false,
        };
        globalPiPWindow = null;
        notifySubscribers();
      });

      // Update state to active
      globalPiPState = {
        isActive: true,
        activeBlobbiId: blobbiId,
        isLoading: false,
      };
      notifySubscribers();

      toast({
        title: "PiP Activated",
        description: `${blobbi.name} is now in Picture-in-Picture mode.`,
      });
    } catch (error) {
      console.error('Failed to activate Picture-in-Picture:', error);
      
      globalPiPState = {
        isActive: false,
        activeBlobbiId: null,
        isLoading: false,
      };
      notifySubscribers();

      toast({
        title: "PiP Failed",
        description: "Could not activate Picture-in-Picture mode. Please try again.",
        variant: "destructive",
      });
    }
  }, [isPiPSupported, toast]);

  /**
   * Stop PiP and close the window
   */
  const stopPiP = useCallback(() => {
    if (globalPiPWindow) {
      globalPiPWindow.close();
      globalPiPWindow = null;
    }

    globalPiPState = {
      isActive: false,
      activeBlobbiId: null,
      isLoading: false,
    };
    notifySubscribers();
  }, []);

  return {
    isPiPActive: localState.isActive,
    activeBlobbiId: localState.activeBlobbiId,
    isLoading: localState.isLoading,
    isPiPSupported,
    startPiP,
    stopPiP,
  };
}
