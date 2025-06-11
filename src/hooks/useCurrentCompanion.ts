import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useUserBlobbis } from './useUserBlobbis';
import { BLOBBI_EVENT_KINDS, parseBlobbiFromStateEvent } from '@/lib/blobbi-events';
import { Blobbi } from '@/types/blobbi';

export interface CurrentCompanion {
  blobbiId: string;
  blobbi: Blobbi | null;
}

export function useCurrentCompanion() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: userBlobbis, isLoading: isBlobbisLoading } = useUserBlobbis();

  return useQuery({
    queryKey: ['current-companion', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user) return null;

      // First, get the user's Blobbanaut profile to find the current companion
      const profileEvents = await nostr.query(
        [{
          kinds: [BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE],
          authors: [user.pubkey],
          limit: 1
        }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      if (profileEvents.length === 0) return null;

      const profileEvent = profileEvents[0];
      const currentCompanionTag = profileEvent.tags.find(tag => tag[0] === 'current_companion');
      
      if (!currentCompanionTag || !currentCompanionTag[1]) {
        return null;
      }

      const blobbiId = currentCompanionTag[1];

      // Look for the blobbi in the already loaded user blobbis
      // This ensures we get the correct stage and adult_type information
      if (userBlobbis && userBlobbis.length > 0) {
        const blobbi = userBlobbis.find(b => b.id === blobbiId);
        if (blobbi) {
          return { blobbiId, blobbi };
        }
      }

      // Fallback: fetch the Blobbi's current state directly if not found in user blobbis
      const blobbiEvents = await nostr.query(
        [{
          kinds: [BLOBBI_EVENT_KINDS.STATE],
          '#d': [blobbiId],
          limit: 1
        }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      if (blobbiEvents.length === 0) {
        return { blobbiId, blobbi: null };
      }

      const blobbi = parseBlobbiFromStateEvent(blobbiEvents[0]);
      
      return { blobbiId, blobbi };
    },
    enabled: !!user && !isBlobbisLoading,
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}