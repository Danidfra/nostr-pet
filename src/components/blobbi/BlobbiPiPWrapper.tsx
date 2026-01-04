import { useState, useEffect } from 'react';
import { useSafeLocation } from '@/hooks/useSafeLocation';
import { useCurrentCompanion } from '@/hooks/useCurrentCompanion';
import { BlobbiPiPManager } from './BlobbiPiPManager';
import { BlobbiFloatingCompanion } from './BlobbiFloatingCompanion';

// Game routes where Blobbi is actively being interacted with
const GAME_ROUTES = [
  '/blobbi',
  '/games/bubble-pop',
  '/games/number-guess',
  '/games/tic-tac-toe',
];

// Routes where we should NOT show PiP
const EXCLUDED_ROUTES = [
  '/blobbi/adopt',
  '/',
];

/**
 * Unified wrapper for Blobbi Picture-in-Picture experience
 * Uses native PiP API when available, falls back to floating companion
 */
export function BlobbiPiPWrapper() {
  const location = useSafeLocation();
  const { data: companionData } = useCurrentCompanion();
  const companion = companionData?.blobbi ?? null;
  const [showFloatingCompanion, setShowFloatingCompanion] = useState(false);
  const [isPiPSupported] = useState(() => 'documentPictureInPicture' in window);

  // Determine if we're on a game route
  const isOnGameRoute = GAME_ROUTES.some(route =>
    location.pathname === route || location.pathname.startsWith(route + '/')
  );

  // Determine if we're on an excluded route
  const isOnExcludedRoute = EXCLUDED_ROUTES.some(route =>
    location.pathname === route || location.pathname.startsWith(route + '/')
  );

  // Should show companion when not on game route and not on excluded route
  const shouldShowCompanion = companion && !isOnGameRoute && !isOnExcludedRoute;

  // Update floating companion visibility
  useEffect(() => {
    if (!isPiPSupported) {
      setShowFloatingCompanion(!!shouldShowCompanion);
    }
  }, [shouldShowCompanion, isPiPSupported]);

  // Handle page visibility changes for fallback
  useEffect(() => {
    if (isPiPSupported) return;

    const handleVisibilityChange = () => {
      if (document.hidden && shouldShowCompanion) {
        setShowFloatingCompanion(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [shouldShowCompanion, isPiPSupported]);

  return (
    <>
      {/* Native PiP for supported browsers */}
      {isPiPSupported && <BlobbiPiPManager />}

      {/* Fallback floating companion for unsupported browsers */}
      {!isPiPSupported && companion && (
        <BlobbiFloatingCompanion
          blobbi={companion}
          isVisible={showFloatingCompanion}
          onClose={() => setShowFloatingCompanion(false)}
        />
      )}
    </>
  );
}
