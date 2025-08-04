import { useBlobbiOnLoadDecayManager } from '@/hooks/useBlobbiOnLoadDecayManager';

/**
 * Component that automatically handles on-load decay for all user's Blobbis.
 * This component should be placed high in the component tree to ensure it runs
 * when the user enters the website.
 */
export function BlobbiOnLoadDecayIntegration() {
  // This hook will automatically calculate and apply decay to all Blobbis
  // when the user enters the website
  const { hasProcessedInitialDecay, processedBlobbisCount } = useBlobbiOnLoadDecayManager();

  // This component doesn't render anything visible
  // It just runs the decay logic in the background
  return null;
}