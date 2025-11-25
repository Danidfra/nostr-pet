import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbiFakeStatus } from '@/contexts/BlobbiFakeStatusContext';
import { BLOBBI_EVENT_KINDS, parseBlobbiFromStateEvent, repairEventIfNeeded } from '@/lib/blobbi-events';
import { calculateStatDegradation, clampStat } from '@/lib/blobbi-events';
import { Blobbi } from '@/types/blobbi';
import { NostrEvent } from '@nostrify/nostrify';

/**
 * Hook to fetch all Blobbis owned by the current user
 */
export function useUserBlobbis() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { getFakeStatus } = useBlobbiFakeStatus();

  const queryResult = useQuery({
    queryKey: ['user-blobbis', user?.pubkey],
    queryFn: async () => {
      if (!user || !nostr) {
        return [];
      }

      const signal = AbortSignal.timeout(10000);

      // Query for all state events from the user
      const stateEvents = await nostr.query([
        {
          kinds: [BLOBBI_EVENT_KINDS.STATE],
          authors: [user.pubkey],
          limit: 50, // Get up to 50 Blobbis per user
        }
      ], { signal });

      // Parse and collect all valid Blobbis
      const blobbis: Blobbi[] = [];
      const seenIds = new Set<string>();
      const latestEventPerBlobbi = new Map<string, NostrEvent>();

      // Sort events by created_at descending to get latest state for each Blobbi
      const sortedEvents = stateEvents.sort((a, b) => b.created_at - a.created_at);

      // First pass: identify latest event per Blobbi and trigger repairs
      for (const event of sortedEvents) {
        const blobbiId = event.tags.find(([name]) => name === 'd')?.[1];
        if (blobbiId && !latestEventPerBlobbi.has(blobbiId)) {
          latestEventPerBlobbi.set(blobbiId, event);
          // Trigger repair for latest event only (fire and forget)
          repairEventIfNeeded(event).catch(error => {
            console.error(`[AutoRepair] Error repairing ${blobbiId}:`, error);
          });
        }
      }

      // Second pass: parse all Blobbis
      for (const event of sortedEvents) {
        try {
          const blobbi = parseBlobbiFromStateEvent(event);
          if (blobbi && !seenIds.has(blobbi.id)) {
            seenIds.add(blobbi.id);

            // Apply stat degradation
            const degradation = calculateStatDegradation(blobbi.lastInteraction * 1000);
            const updatedBlobbi = {
              ...blobbi,
              stats: {
                hunger: clampStat(blobbi.stats.hunger + (degradation.hunger || 0)),
                happiness: clampStat(blobbi.stats.happiness + (degradation.happiness || 0)),
                health: blobbi.stats.health, // Health doesn't auto-degrade
                hygiene: clampStat(blobbi.stats.hygiene + (degradation.hygiene || 0)),
                energy: clampStat(blobbi.stats.energy + (degradation.energy || 0)),
              },
            };

            blobbis.push(updatedBlobbi);
          }
        } catch (error) {
          console.warn('Failed to parse Blobbi event:', error);
        }
      }

      // Sort by creation time (newest first)
      return blobbis.sort((a, b) => b.birthTime - a.birthTime);
    },
    enabled: !!user && !!nostr,
    refetchInterval: 60000, // Refetch every minute
  });

  // Optimistic update logic
  const originalData = queryResult.data;
  if (originalData) {
    const optimisticData = originalData.map(blobbi => {
      const fakeStatus = getFakeStatus(blobbi.id);
      return fakeStatus || blobbi;
    });

    return {
      ...queryResult,
      data: optimisticData,
    };
  }

  return queryResult;
}

/**
 * Hook to fetch a specific Blobbi by ID
 */
export function useBlobbiById(blobbiId: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['blobbi-by-id', blobbiId, user?.pubkey],
    queryFn: async () => {
      if (!blobbiId || !nostr) {
        return null;
      }

      const signal = AbortSignal.timeout(10000);

      // Query for state events with the specific Blobbi ID
      const stateEvents = await nostr.query([
        {
          kinds: [BLOBBI_EVENT_KINDS.STATE],
          '#d': [blobbiId], // Use the 'd' tag to find the specific Blobbi
          limit: 10,
        }
      ], { signal });

      // Get the most recent state event
      const latestEvent = stateEvents.sort((a, b) => b.created_at - a.created_at)[0];

      if (!latestEvent) return null;

      try {
        const blobbi = parseBlobbiFromStateEvent(latestEvent);
        if (!blobbi) return null;

        // Apply stat degradation
        const degradation = calculateStatDegradation(blobbi.lastInteraction * 1000);
        return {
          ...blobbi,
          stats: {
            hunger: clampStat(blobbi.stats.hunger + (degradation.hunger || 0)),
            happiness: clampStat(blobbi.stats.happiness + (degradation.happiness || 0)),
            health: blobbi.stats.health, // Health doesn't auto-degrade
            hygiene: clampStat(blobbi.stats.hygiene + (degradation.hygiene || 0)),
            energy: clampStat(blobbi.stats.energy + (degradation.energy || 0)),
          },
        };
      } catch (error) {
        console.warn('Failed to parse Blobbi event:', error);
        return null;
      }
    },
    enabled: !!blobbiId && !!nostr,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}