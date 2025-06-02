import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { Blobbi } from '@/types/blobbi';
import { 
  applyDecay, 
  shouldEmitShellIntegrityPenalty, 
  calculateShellIntegrityPenalty 
} from '@/lib/blobbi-decay';
import { createShellIntegrityPenaltyEvent } from '@/lib/blobbi-events';

interface DecayManagerOptions {
  blobbi: Blobbi | null;
  updateBlobbi: (blobbi: Blobbi) => Promise<void>;
  enabled?: boolean;
}

/**
 * Hook to manage automatic decay and penalty events for a Blobbi
 */
export function useBlobbiDecayManager({ 
  blobbi, 
  updateBlobbi, 
  enabled = true 
}: DecayManagerOptions) {
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const lastPenaltyCheck = useRef<number>(0);
  const shellIntegrityBelowThresholdSince = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !blobbi || !user) {
      return;
    }

    const interval = setInterval(async () => {
      const now = Date.now();
      const hoursSinceLastUpdate = (now / 1000 - blobbi.lastInteraction) / (60 * 60);

      // Only apply decay if at least 1 hour has passed since last update and Blobbi is active
      if (hoursSinceLastUpdate >= 1 && blobbi.state === 'active') {
        try {
          // Apply decay
          const decayedBlobbi = applyDecay(blobbi, now);
          
          // Check if we need to emit shell integrity penalty
          if (shouldEmitShellIntegrityPenalty(decayedBlobbi)) {
            const currentShellIntegrity = decayedBlobbi.shellIntegrity ?? 100;
            
            // Track how long shell integrity has been below threshold
            if (shellIntegrityBelowThresholdSince.current === null) {
              shellIntegrityBelowThresholdSince.current = now;
            }
            
            const hoursBelowThreshold = (now - shellIntegrityBelowThresholdSince.current) / (1000 * 60 * 60);
            const hoursSinceLastPenalty = (now - lastPenaltyCheck.current) / (1000 * 60 * 60);
            
            // Emit penalty event every hour while below threshold
            if (hoursSinceLastPenalty >= 1) {
              const carePointsDeducted = calculateShellIntegrityPenalty(1); // 1 hour worth
              
              // Create and publish penalty event
              const penaltyEvent = createShellIntegrityPenaltyEvent(decayedBlobbi, carePointsDeducted);
              
              publishEvent({
                kind: penaltyEvent.kind,
                content: penaltyEvent.content,
                tags: penaltyEvent.tags,
              });
              
              // Deduct care points from experience (using experience as care points)
              const updatedBlobbi = {
                ...decayedBlobbi,
                experience: Math.max(0, decayedBlobbi.experience - carePointsDeducted),
              };
              
              await updateBlobbi(updatedBlobbi);
              lastPenaltyCheck.current = now;
              
              // Invalidate queries to refresh UI
              queryClient.invalidateQueries({ queryKey: ['blobbi-state'] });
              
              console.log(`Shell integrity penalty: ${carePointsDeducted} care points deducted for ${decayedBlobbi.name}`);
            }
          } else {
            // Reset tracking if shell integrity is above threshold
            shellIntegrityBelowThresholdSince.current = null;
          }
          
          // Update blobbi with decay (if no penalty was applied)
          if (!shouldEmitShellIntegrityPenalty(decayedBlobbi) || 
              (now - lastPenaltyCheck.current) < (1000 * 60 * 60)) {
            await updateBlobbi(decayedBlobbi);
          }
          
        } catch (error) {
          console.error('Error applying decay to Blobbi:', error);
        }
      }
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(interval);
  }, [blobbi, updateBlobbi, enabled, user, publishEvent, queryClient]);

  // Also provide a manual decay function for immediate use
  const applyManualDecay = async () => {
    if (!blobbi) return null;
    
    const decayedBlobbi = applyDecay(blobbi);
    await updateBlobbi(decayedBlobbi);
    return decayedBlobbi;
  };

  return {
    applyManualDecay,
    isShellIntegrityCritical: blobbi ? shouldEmitShellIntegrityPenalty(blobbi) : false,
    shellIntegrityValue: blobbi?.shellIntegrity ?? 100,
  };
}

/**
 * Hook to get decay information for display purposes
 */
export function useBlobbiDecayInfo(blobbi: Blobbi | null) {
  if (!blobbi) {
    return null;
  }

  const hoursSinceLastInteraction = (Date.now() / 1000 - blobbi.lastInteraction) / (60 * 60);
  
  return {
    hoursSinceLastInteraction,
    needsAttention: hoursSinceLastInteraction > 12, // More than 12 hours
    isCritical: hoursSinceLastInteraction > 24, // More than 24 hours
    isShellIntegrityCritical: shouldEmitShellIntegrityPenalty(blobbi),
  };
}