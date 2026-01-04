import { useEffect } from 'react';
import { useCurrentCompanion } from '@/hooks/useCurrentCompanion';
import { useBlobbiPiP } from '@/hooks/useBlobbiPiP';
import { renderBlobbiPiP } from '@/lib/blobbi-pip-render';

/**
 * Manager component for Blobbi Picture-in-Picture functionality
 * Automatically handles PiP activation/deactivation based on user navigation
 */
export function BlobbiPiPManager() {
  const { data: companionData } = useCurrentCompanion();
  const companion = companionData?.blobbi ?? null;
  const { isActive, isPiPSupported } = useBlobbiPiP(companion);

  // Listen for PiP window open events and render Blobbi
  useEffect(() => {
    if (!isPiPSupported) return;

    const handlePiPOpened = (event: CustomEvent) => {
      const { window: pipWindow, blobbi } = event.detail;

      if (pipWindow && blobbi) {
        // Render Blobbi in the PiP window
        const cleanup = renderBlobbiPiP(pipWindow, blobbi);

        // Store cleanup function to be called when window closes
        pipWindow.addEventListener('pagehide', () => {
          cleanup?.();
        }, { once: true });
      }
    };

    window.addEventListener('blobbi-pip-opened', handlePiPOpened as EventListener);

    return () => {
      window.removeEventListener('blobbi-pip-opened', handlePiPOpened as EventListener);
    };
  }, [isPiPSupported]);

  // This component doesn't render anything in the main DOM
  return null;
}
