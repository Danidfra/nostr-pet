import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BLOBBI_EVENT_KINDS, parseBlobbiFromStateEvent } from '@/lib/blobbi-events';

/**
 * Hook to find the current user's Blobbi by querying their state events
 */
export function useUserBlobbi() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['user-blobbi', user?.pubkey],
    queryFn: async () => {
      if (!user) return null;
      
      const signal = AbortSignal.timeout(5000);
      
      // Query for state events from the user
      const stateEvents = await nostr.query([
        {
          kinds: [BLOBBI_EVENT_KINDS.STATE],
          authors: [user.pubkey],
          limit: 10, // Get a few in case there are multiple
        }
      ], { signal });
      
      // Parse and return the first valid Blobbi
      for (const event of stateEvents) {
        const blobbi = parseBlobbiFromStateEvent(event);
        if (blobbi) {
          return blobbi;
        }
      }
      
      return null;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}