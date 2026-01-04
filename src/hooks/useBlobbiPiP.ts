import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Blobbi } from '@/types/blobbi';

interface BlobbiPiPState {
  isActive: boolean;
  isPiPSupported: boolean;
  canActivate: boolean;
  activatePiP: () => Promise<void>;
  deactivatePiP: () => void;
}

// Game routes where Blobbi is actively being interacted with
const GAME_ROUTES = [
  '/blobbi',
  '/blobbi/dashboard',
  '/games/bubble-pop',
  '/games/number-guess',
  '/games/tic-tac-toe',
];

// Routes where we should NOT show PiP (e.g., already showing Blobbi)
const EXCLUDED_ROUTES = [
  '/blobbi/adopt',
  '/',
];

/**
 * Hook to manage Picture-in-Picture state for Blobbi
 * Automatically activates when user leaves game screens
 */
export function useBlobbiPiP(blobbi: Blobbi | null): BlobbiPiPState {
  const location = useLocation();
  const [isActive, setIsActive] = useState(false);
  const [isPiPSupported] = useState(() => {
    return 'documentPictureInPicture' in window;
  });
  const pipWindowRef = useRef<Window | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Determine if we're on a game route
  const isOnGameRoute = GAME_ROUTES.some(route =>
    location.pathname === route || location.pathname.startsWith(route + '/')
  );

  // Determine if we're on an excluded route
  const isOnExcludedRoute = EXCLUDED_ROUTES.some(route =>
    location.pathname === route || location.pathname.startsWith(route + '/')
  );

  // Can activate PiP if we have a blobbi, not on game route, not on excluded route, and PiP is supported
  const canActivate = !!blobbi && !isOnGameRoute && !isOnExcludedRoute && isPiPSupported;

  // Activate Picture-in-Picture
  const activatePiP = useCallback(async () => {
    if (!blobbi || !isPiPSupported || isActive) return;

    try {
      // For browsers that support Document Picture-in-Picture API
      const docPiP = (window as Window & { documentPictureInPicture?: { requestWindow: (options: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
      if (docPiP) {
        const pipWindow = await docPiP.requestWindow({
          width: 300,
          height: 300,
        });

        pipWindowRef.current = pipWindow;

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
            pipWindow.document.head.appendChild(link);
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
          setIsActive(false);
          pipWindowRef.current = null;
        });

        setIsActive(true);
      }
    } catch (error) {
      console.error('Failed to activate Picture-in-Picture:', error);
    }
  }, [blobbi, isPiPSupported, isActive]);

  // Deactivate Picture-in-Picture
  const deactivatePiP = useCallback(() => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
    }
    if (videoRef.current && document.pictureInPictureElement) {
      document.exitPictureInPicture();
    }
    setIsActive(false);
  }, []);

  // Auto-activate PiP when leaving game routes
  useEffect(() => {
    if (canActivate && !isActive) {
      // Small delay to ensure route transition is complete
      const timer = setTimeout(() => {
        activatePiP();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [canActivate, isActive, activatePiP]);

  // Auto-deactivate PiP when returning to game routes
  useEffect(() => {
    if (isOnGameRoute && isActive) {
      deactivatePiP();
    }
  }, [isOnGameRoute, isActive, deactivatePiP]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && canActivate && !isActive) {
        activatePiP();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [canActivate, isActive, activatePiP]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      deactivatePiP();
    };
  }, [deactivatePiP]);

  return {
    isActive,
    isPiPSupported,
    canActivate,
    activatePiP,
    deactivatePiP,
  };
}
