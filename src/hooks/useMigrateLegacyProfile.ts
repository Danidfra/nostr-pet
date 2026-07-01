import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NostrEvent } from '@nostrify/nostrify';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import { BLOBBI_EVENT_KINDS } from '@/lib/blobbi-events';

/**
 * Hook to migrate legacy kind 31125 profile to new kind 11125
 * This should be called once when a legacy profile is detected
 */
export function useMigrateLegacyProfile() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (legacyEvent: NostrEvent) => {
      if (!user) {
        throw new Error('User must be logged in to migrate profile');
      }

      if (legacyEvent.kind !== 31125) {
        throw new Error('Not a legacy profile event');
      }

      console.log('[Migration] Migrating legacy profile from kind 31125 to kind 11125');

      // Create a new event with the same content and tags but with new kind
      const migratedEvent = {
        kind: BLOBBI_EVENT_KINDS.BLOBBONAUT_PROFILE, // New kind: 11125
        content: legacyEvent.content,
        tags: legacyEvent.tags, // Preserve all tags exactly as they were
      };

      // Publish the migrated event
      await publishEvent(migratedEvent);

      console.log('[Migration] Successfully migrated profile to kind 11125');

      return migratedEvent;
    },
    onSuccess: () => {
      // Invalidate all profile queries to refetch with new kind
      queryClient.invalidateQueries({
        queryKey: ['blobbonaut-profile'],
      });
      queryClient.invalidateQueries({
        queryKey: ['blobbonaut-profiles'],
      });
      queryClient.invalidateQueries({
        queryKey: ['blobbonaut-profile-event'],
      });
    },
    onError: (error) => {
      console.error('[Migration] Failed to migrate legacy profile:', error);
    },
  });
}
