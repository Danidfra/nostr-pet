import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useEnhancedNostrPublish } from '@/hooks/useEnhancedNostrPublish';
import { useNostr } from '@/hooks/useNostr';
import { useUserBlobbis } from '@/hooks/useUserBlobbis';
import { applyDecay } from '@/lib/blobbi-decay';
import { createBlobbiStateEvent } from '@/lib/blobbi-events';
import { Blobbi } from '@/types/blobbi';

/**
 * Hook that automatically calculates and applies decay to all user's Blobbis
 * when they enter the website. This ensures the UI always shows current stats
 * and publishes updated state events for Blobbis that need decay applied.
 */
export function useBlobbiOnLoadDecayManager() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { data: userBlobbis, isLoading } = useUserBlobbis();
  const { mutateAsync: publishEvent } = useEnhancedNostrPublish();
  const queryClient = useQueryClient();
  const hasProcessedInitialDecay = useRef(false);
  const processedBlobbis = useRef(new Set<string>());

  useEffect(() => {
    // Only run once per session and only when we have user and Blobbis
    if (!user || isLoading || !userBlobbis || hasProcessedInitialDecay.current) {
      return;
    }

    const processDecayForAllBlobbis = async () => {
        if (userBlobbis.length === 0) {
          hasProcessedInitialDecay.current = true;
          return;
        }

        const currentTime = Date.now();
        const blobbisNeedingDecay: Blobbi[] = [];

        // Check each Blobbi to see if it needs decay applied
        for (const blobbi of userBlobbis) {
          // Skip if already processed in this session
          if (processedBlobbis.current.has(blobbi.id)) {
            continue;
          }

          const minutesSinceLastInteraction = (currentTime / 1000 - blobbi.lastInteraction) / 60;

          // 🔥 FIX: Only apply decay if more than 30 minutes has passed since last interaction
          // This reduces unnecessary processing and event publishing on frequent page loads
          if (minutesSinceLastInteraction >= 30) {
            blobbisNeedingDecay.push(blobbi);
          }

          // Mark as processed regardless
          processedBlobbis.current.add(blobbi.id);
        }

        if (blobbisNeedingDecay.length === 0) {
          hasProcessedInitialDecay.current = true;
          return;
        }

        console.log(`🔄 Silently applying on-load decay to ${blobbisNeedingDecay.length} Blobbis (30+ min since last interaction)...`);

        // Process each Blobbi that needs decay with minimal blocking
        const processPromises = blobbisNeedingDecay.map(async (blobbi, index) => {
          // Stagger the processing to avoid overwhelming the relay
          await new Promise(resolve => setTimeout(resolve, index * 30));

          try {
            // Calculate decay
            const decayedBlobbi = applyDecay(blobbi, currentTime);

            // Check if decay actually changed anything significant
            const hasSignificantChanges = hasSignificantStatChanges(blobbi, decayedBlobbi);

            if (hasSignificantChanges) {
              // CRITICAL FIX: Use enhanced publish hook to preserve incubation/quest tags
              // Instead of directly creating state event, use the enhanced hook
              // that properly merges tags to preserve incubation and quest data

              // First, fetch current state to get existing tags
              const signal = AbortSignal.timeout(3000);
              const currentStateEvents = await nostr.query([
                {
                  kinds: [31124],
                  authors: [user?.pubkey || ''],
                  '#d': [blobbi.id],
                  limit: 1,
                }
              ], { signal });

              const currentStateEvent = currentStateEvents[0];

              if (currentStateEvent) {
                // Create new state event data
                const stateEventData = createBlobbiStateEvent(decayedBlobbi);

                // Use mergeBlobbiStateTags to preserve incubation/quest tags
                const { mergeBlobbiStateTags } = await import('@/lib/blobbi-state-merge');
                const mergedTags = mergeBlobbiStateTags(currentStateEvent.tags, {
                  additionalTags: stateEventData.tags,
                  preserveIncubationAndQuestTags: true,
                });

                await publishEvent({
                  kind: stateEventData.kind,
                  content: stateEventData.content,
                  tags: mergedTags,
                });
              } else {
                // Fallback to direct state creation if no current state found
                const stateEventData = createBlobbiStateEvent(decayedBlobbi);
                await publishEvent({
                  kind: stateEventData.kind,
                  content: stateEventData.content,
                  tags: stateEventData.tags,
                });
              }

              console.log(`✅ Silently applied decay to ${blobbi.name} (${blobbi.id})`);
              return blobbi.id;
            } else {
              console.log(`⏭️ No significant changes for ${blobbi.name} (${blobbi.id})`);
              return null;
            }
          } catch (error) {
            console.error(`❌ Failed to apply decay to ${blobbi.name} (${blobbi.id}):`, error);
            return null;
          }
        });

        // Wait for all processing to complete, then batch invalidate
        const processedIds = await Promise.all(processPromises);
        const successfulIds = processedIds.filter(Boolean);

        if (successfulIds.length > 0) {
          // Single batch invalidation after all processing
          queryClient.invalidateQueries({ queryKey: ['user-blobbis'] });
        }

        hasProcessedInitialDecay.current = true;
    };

    // Run the decay process
    processDecayForAllBlobbis().catch(error => {
      console.error('Error during on-load decay processing:', error);
      hasProcessedInitialDecay.current = true;
    });
  }, [user, userBlobbis, isLoading, publishEvent, queryClient]);

  // Reset processing state when user changes
  useEffect(() => {
    hasProcessedInitialDecay.current = false;
    processedBlobbis.current.clear();
  }, [user?.pubkey]);

  return {
    hasProcessedInitialDecay: hasProcessedInitialDecay.current,
    processedBlobbisCount: processedBlobbis.current.size,
  };
}

/**
 * Check if decay resulted in significant stat changes worth publishing
 * 🔥 FIX: Much higher thresholds to prevent unnecessary event publishing
 */
function hasSignificantStatChanges(originalBlobbi: Blobbi, decayedBlobbi: Blobbi): boolean {
  // For eggs, check egg-specific stats with higher thresholds
  if (originalBlobbi.lifeStage === 'egg') {
    const tempChange = Math.abs((originalBlobbi.eggTemperature ?? 100) - (decayedBlobbi.eggTemperature ?? 100));
    const shellChange = Math.abs((originalBlobbi.shellIntegrity ?? 100) - (decayedBlobbi.shellIntegrity ?? 100));
    const happinessChange = Math.abs(originalBlobbi.stats.happiness - decayedBlobbi.stats.happiness);
    const hygieneChange = Math.abs(originalBlobbi.stats.hygiene - decayedBlobbi.stats.hygiene);

    // 🔥 FIX: Higher thresholds - only publish if changes are substantial (5+ points)
    // This prevents micro-decay updates that clutter the network
    return tempChange >= 5 || shellChange >= 5 || happinessChange >= 5 || hygieneChange >= 5;
  }

  // For post-hatch Blobbis, check all stats with higher thresholds
  const hungerChange = Math.abs(originalBlobbi.stats.hunger - decayedBlobbi.stats.hunger);
  const happinessChange = Math.abs(originalBlobbi.stats.happiness - decayedBlobbi.stats.happiness);
  const energyChange = Math.abs(originalBlobbi.stats.energy - decayedBlobbi.stats.energy);
  const hygieneChange = Math.abs(originalBlobbi.stats.hygiene - decayedBlobbi.stats.hygiene);
  const healthChange = Math.abs(originalBlobbi.stats.health - decayedBlobbi.stats.health);

  // 🔥 FIX: Higher thresholds - only publish if changes are substantial (5+ points)
  // This prevents micro-decay updates and reduces unnecessary network traffic
  return hungerChange >= 5 || happinessChange >= 5 || energyChange >= 5 || hygieneChange >= 5 || healthChange >= 5;
}

