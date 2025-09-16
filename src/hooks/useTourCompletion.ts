import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { BLOBBI_EVENT_KINDS } from '@/lib/blobbi-events';
import { useBlobbonautProfile } from './useBlobbonautProfile';

/**
 * Hook to handle tour completion by updating the user's kind 31125 event
 * with onboarding_done=true while preserving all existing tags
 */
export function useTourCompletion() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutate: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error('User must be logged in to complete tour');
      }

      if (!currentProfile) {
        throw new Error('User profile not found');
      }

      // Get the latest kind 31125 event for this user
      const profileId = `Blobbanaut-${user.pubkey.slice(0, 8)}`;
      const events = await nostr.query(
        [{
          kinds: [BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE],
          '#d': [profileId],
          authors: [user.pubkey],
          limit: 1,
        }],
        { signal: AbortSignal.timeout(5000) }
      );

      if (events.length === 0) {
        throw new Error('No existing profile event found');
      }

      const latestEvent = events[0];
      
      // Create a copy of existing tags
      const updatedTags = [...latestEvent.tags];
      
      // Find and remove any existing onboarding_done tags
      const filteredTags = updatedTags.filter(([tagName]) => tagName !== 'onboarding_done');
      
      // Add the new onboarding_done tag with value "true"
      filteredTags.push(['onboarding_done', 'true']);

      // Create the updated event
      const updatedEvent = {
        kind: BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE,
        content: '', // Content must be empty according to spec
        tags: filteredTags,
      };

      // Publish the updated event
      return publishEvent(updatedEvent);
    },
    onSuccess: () => {
      // Invalidate and refetch the profile to get the updated data
      queryClient.invalidateQueries({
        queryKey: ['blobbanaut-profile']
      });
    },
    onError: (error) => {
      console.error('Failed to complete tour:', error);
    },
  });
}