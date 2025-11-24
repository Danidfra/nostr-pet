import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useBlobbonautProfile } from './useBlobbonautProfile';
import { useNostrPublish } from './useNostrPublish';
import { BlobbonautProfile } from '@/types/blobbi';
import { BLOBBI_EVENT_KINDS, createBlobbonautProfileEvent } from '@/lib/blobbi-events';
import { canBlobbiBeCompanion, getCompanionValidationMessage } from '@/lib/blobbi-companion-validation';

export function useSetCurrentCompanion() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutate: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blobbiId: string | null) => {
      if (!user || !currentProfile) {
        throw new Error('User must be logged in and have a profile');
      }

      // Validate that the user owns this Blobbi
      if (blobbiId && !currentProfile.ownedBlobbis.includes(blobbiId)) {
        throw new Error('You do not own this Blobbi');
      }

      // If setting a companion, validate that the Blobbi can be a companion
      if (blobbiId) {
        // Fetch the Blobbi to check its life stage
        const blobbiEvents = await nostr.query(
          [{
            kinds: [BLOBBI_EVENT_KINDS.STATE],
            '#d': [blobbiId],
            authors: [user.pubkey],
            limit: 1
          }],
          { signal: AbortSignal.timeout(5000) }
        );

        if (blobbiEvents.length === 0) {
          throw new Error('Could not find Blobbi data');
        }

        // Parse the Blobbi from the state event
        const { parseBlobbiFromStateEvent } = await import('@/lib/blobbi-events');
        const blobbi = parseBlobbiFromStateEvent(blobbiEvents[0]);
        
        if (!blobbi) {
          throw new Error('Could not parse Blobbi data');
        }

        // Validate that this Blobbi can be a companion
        if (!canBlobbiBeCompanion(blobbi)) {
          throw new Error(getCompanionValidationMessage(blobbi));
        }
      }

      // Fetch the latest profile event to ensure we have all tags
      const profileEvents = await nostr.query(
        [{
          kinds: [BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE],
          authors: [user.pubkey],
          limit: 1
        }],
        { signal: AbortSignal.timeout(5000) }
      );

      if (profileEvents.length === 0) {
        throw new Error('Could not find existing profile');
      }

      const latestEvent = profileEvents[0];
      
      // Create a new profile with updated current_companion
      const updatedProfile: BlobbonautProfile = {
        ...currentProfile,
        currentCompanion: blobbiId || undefined,
      };

      // Create the event template
      const eventTemplate = createBlobbonautProfileEvent(updatedProfile);

      return new Promise<void>((resolve, reject) => {
        publishEvent(eventTemplate, {
          onSuccess: () => {
            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ['blobbonaut-profile'] });
            queryClient.invalidateQueries({ queryKey: ['current-companion'] });
            resolve();
          },
          onError: reject,
        });
      });
    },
  });
}