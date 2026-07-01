import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useMemo } from 'react';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { BlobbonautProfile, BlobbonautStorageItem } from '@/types/blobbi';
import {
  BLOBBI_EVENT_KINDS,
  createBlobbonautProfileEvent,
  parseBlobbonautProfileFromEvent
} from '@/lib/blobbi-events';
import { getCanonicalBlobbonautD } from '@/lib/blobbi';

// ========================
// QUERY HOOKS
// ========================

/** Hook to get a Blobbonaut Profile by ID or current user */
export function useBlobbonautProfile(profileId?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  // Use a stable query key based on profileId or user pubkey
  const queryKey = useMemo(() => {
    if (profileId) return ['blobbonaut-profile', profileId];
    if (user) return ['blobbonaut-profile', user.pubkey];
    return ['blobbonaut-profile', 'none'];
  }, [profileId, user?.pubkey]);

  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      if (!nostr) {
        return null;
      }

      let events;

      if (profileId) {
        // If a specific profileId is provided, query by that exact ID
        // Query both new (11125) and legacy (31125) kinds
        console.log('[Blobbonaut] Querying by specific profileId:', profileId);
        events = await nostr.query(
          [{
            kinds: [BLOBBI_EVENT_KINDS.BLOBBONAUT_PROFILE, 31125],
            '#d': [profileId],
            limit: 10,
          }],
          { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
        );
      } else if (user) {
        // If no profileId, query by author to support both old and new formats
        // Query both new (11125) and legacy (31125) kinds
        console.log('[Blobbonaut] Querying by author pubkey:', user.pubkey.slice(0, 8));
        events = await nostr.query(
          [{
            kinds: [BLOBBI_EVENT_KINDS.BLOBBONAUT_PROFILE, 31125],
            authors: [user.pubkey],
            limit: 20, // Get multiple to find the latest
          }],
          { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
        );

        // Filter to only Blobbi ecosystem events
        events = events.filter(event => {
          const hasBlobbiTag = event.tags.some(([name, value]) =>
            name === 'b' && value === 'blobbi:ecosystem:v1'
          );
          const hasTopicTag = event.tags.some(([name, value]) =>
            name === 't' && (value === 'blobbi' || value === 'Blobbi')
          );
          return hasBlobbiTag || hasTopicTag;
        });

        // Prefer new kind (11125) over legacy kind (31125)
        const newKindEvents = events.filter(e => e.kind === BLOBBI_EVENT_KINDS.BLOBBONAUT_PROFILE);
        const legacyKindEvents = events.filter(e => e.kind === 31125);
        
        // If we have new kind events, use only those. Otherwise use legacy.
        if (newKindEvents.length > 0) {
          events = newKindEvents;
          console.log('[Blobbonaut] Using new kind (11125) events');
        } else if (legacyKindEvents.length > 0) {
          events = legacyKindEvents;
          console.log('[Blobbonaut] Using legacy kind (31125) events - migration needed');
        }

        // Sort by created_at to get the latest
        events.sort((a, b) => b.created_at - a.created_at);
      } else {
        return null;
      }

      console.log('[Blobbonaut] Found profile events:', events.length);

      if (events.length === 0) {
        return null;
      }

      // Use the most recent event
      const latestEvent = events[0];
      console.log('[Blobbonaut] Using profile event:', latestEvent.id.slice(0, 8), latestEvent.created_at, latestEvent.tags.find(t => t[0] === 'd'));

      // Parse the profile (handles both kind 11125 and legacy kind 31125)
      const profile = parseBlobbonautProfileFromEvent(latestEvent);
      
      // Store migration flag if this is a legacy event
      if (latestEvent.kind === 31125 && profile) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profile as any).__needsMigration = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profile as any).__legacyEvent = latestEvent;
      }
      
      return profile;
    },
    enabled: (!!profileId || !!user) && !!nostr,
    staleTime: 30000, // 30 seconds
  });
}

/** Hook to get multiple Blobbonaut Profiles by their IDs */
export function useBlobbonautProfiles(profileIds: string[]) {
  const { nostr } = useNostr();

  const sortedProfileIds = useMemo(() =>
    [...profileIds].sort(),
    [profileIds]
  );

  return useQuery<BlobbonautProfile[]>({
    queryKey: ['blobbonaut-profiles', sortedProfileIds],
    queryFn: async ({ signal }) => {
      if (!sortedProfileIds.length || !nostr) return [];

      // Query both new (11125) and legacy (31125) kinds for migration support
      const events = await nostr.query(
        [{
          kinds: [BLOBBI_EVENT_KINDS.BLOBBONAUT_PROFILE, 31125],
          '#d': sortedProfileIds,
        }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      const eventsByProfile = new Map<string, { profile: BlobbonautProfile; created_at: number; kind: number }>();

      events.forEach(event => {
        const profile = parseBlobbonautProfileFromEvent(event);
        if (!profile) return;

        const existing = eventsByProfile.get(profile.id);
        
        // Prefer new kind (11125) over legacy kind (31125)
        // If same kind, prefer newer created_at
        const shouldUpdate = !existing || 
          (event.kind === BLOBBI_EVENT_KINDS.BLOBBONAUT_PROFILE && existing.kind === 31125) ||
          (event.kind === existing.kind && event.created_at > existing.created_at);
        
        if (shouldUpdate) {
          eventsByProfile.set(profile.id, { profile, created_at: event.created_at, kind: event.kind });
        }
      });

      return Array.from(eventsByProfile.values()).map(({ profile }) => profile);
    },
    enabled: sortedProfileIds.length > 0 && !!nostr,
    staleTime: 30000, // 30 seconds
  });
}

// ========================
// MUTATION HOOKS
// ========================

/** Core hook to update Blobbonaut Profile with partial updates */
export function useUpdateBlobbonautProfile() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { data: currentProfile } = useBlobbonautProfile();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (partialUpdate: Partial<BlobbonautProfile>) => {
      if (!currentProfile) {
        throw new Error('Profile not found. Cannot update without existing profile.');
      }

      // Automatic migration: Convert old ID format to new format
      let profileId = currentProfile.id;

      // Check if this is an old format ID (Blobbanaut-xxx or Blobbonaut-{8hex})
      if ((profileId.startsWith('Blobbanaut-') || profileId.startsWith('Blobbonaut-')) && user) {
        // Migrate to canonical format (blobbonaut-{12hex})
        const newProfileId = getCanonicalBlobbonautD(user.pubkey);
        console.log('[Blobbonaut Migration] Migrating profile ID:', profileId, '→', newProfileId);
        profileId = newProfileId;
      }

      // Merge partial update with current profile to create complete snapshot
      const updatedProfile: BlobbonautProfile = {
        ...currentProfile,
        ...partialUpdate,
        id: profileId,                            // Use migrated ID
        ownerPubkey: currentProfile.ownerPubkey,  // Never lose the owner
        lastModified: Math.floor(Date.now() / 1000),
      };

      const eventTemplate = createBlobbonautProfileEvent(updatedProfile);
      await publishEvent(eventTemplate);

      return updatedProfile;
    },
    onSuccess: (updatedProfile, variables, context) => {
      // Invalidate profile queries with consistent keys
      queryClient.invalidateQueries({
        queryKey: ['blobbonaut-profile'],
      });
      queryClient.invalidateQueries({
        queryKey: ['blobbonaut-profiles'],
      });

      // Invalidate specific profile query (new ID)
      queryClient.invalidateQueries({
        queryKey: ['blobbonaut-profile', updatedProfile.id],
      });

      // If ID was migrated, also invalidate the old ID query
      if (currentProfile && currentProfile.id !== updatedProfile.id) {
        console.log('[Blobbonaut Migration] Invalidating old profile ID:', currentProfile.id);
        queryClient.invalidateQueries({
          queryKey: ['blobbonaut-profile', currentProfile.id],
        });
      }

      // Also invalidate by pubkey (for author-based queries)
      if (user) {
        queryClient.invalidateQueries({
          queryKey: ['blobbonaut-profile', user.pubkey],
        });
      }
    },
    onError: (error) => {
      console.error('Failed to update Blobbonaut Profile:', error);
    },
  });
}

/** Hook to add coins to current user's profile */
export function useAddCoins() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutateAsync: updateProfile } = useUpdateBlobbonautProfile();

  return useMutation({
    mutationFn: async (coinsToAdd: number) => {
      if (!currentProfile) {
        throw new Error('Profile not found');
      }

      if (coinsToAdd <= 0) {
        throw new Error('Coins to add must be positive');
      }

      await updateProfile({
        id: currentProfile.id,
        coins: currentProfile.coins + coinsToAdd,
      });
    },
  });
}

/** Hook to spend coins from current user's profile */
export function useSpendCoins() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutateAsync: updateProfile } = useUpdateBlobbonautProfile();

  return useMutation({
    mutationFn: async (coinsToSpend: number) => {
      if (!currentProfile) {
        throw new Error('Profile not found');
      }

      if (coinsToSpend <= 0) {
        throw new Error('Coins to spend must be positive');
      }

      if (currentProfile.coins < coinsToSpend) {
        throw new Error('Insufficient coins');
      }

      await updateProfile({
        id: currentProfile.id,
        coins: currentProfile.coins - coinsToSpend,
      });
    },
  });
}

/** Hook to add a Blobbi to user's collection */
export function useAddBlobbi() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutateAsync: updateProfile } = useUpdateBlobbonautProfile();

  return useMutation({
    mutationFn: async (blobbiId: string) => {
      if (!currentProfile) {
        throw new Error('Profile not found');
      }

      if (currentProfile.ownedBlobbis.includes(blobbiId)) {
        return; // Already owned
      }

      await updateProfile({
        id: currentProfile.id,
        ownedBlobbis: [...currentProfile.ownedBlobbis, blobbiId],
        lifetimeBlobbis: currentProfile.lifetimeBlobbis + 1,
        starterBlobbi: currentProfile.ownedBlobbis.length === 0 ? blobbiId : currentProfile.starterBlobbi,
      });
    },
  });
}

/** Hook to remove a Blobbi from user's collection */
export function useRemoveBlobbi() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutateAsync: updateProfile } = useUpdateBlobbonautProfile();

  return useMutation({
    mutationFn: async (blobbiId: string) => {
      if (!currentProfile) {
        throw new Error('Profile not found');
      }

      await updateProfile({
        id: currentProfile.id,
        ownedBlobbis: currentProfile.ownedBlobbis.filter(id => id !== blobbiId),
        favoriteBlobbi: currentProfile.favoriteBlobbi === blobbiId ? undefined : currentProfile.favoriteBlobbi,
      });
    },
  });
}

/** Hook to update petting level */
export function useUpdatePettingLevel() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutateAsync: updateProfile } = useUpdateBlobbonautProfile();

  return useMutation({
    mutationFn: async (newLevel: number) => {
      if (!currentProfile) {
        throw new Error('Profile not found');
      }

      await updateProfile({
        id: currentProfile.id,
        pettingLevel: Math.max(0, newLevel),
      });
    },
  });
}

/** Hook to add an achievement */
export function useAddAchievement() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutateAsync: updateProfile } = useUpdateBlobbonautProfile();

  return useMutation({
    mutationFn: async (achievementId: string) => {
      if (!currentProfile) {
        throw new Error('Profile not found');
      }

      if (currentProfile.achievements.includes(achievementId)) {
        return; // Already achieved
      }

      await updateProfile({
        id: currentProfile.id,
        achievements: [...currentProfile.achievements, achievementId],
      });
    },
  });
}

/** Hook to add items to storage */
export function useAddToStorage() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutateAsync: updateProfile } = useUpdateBlobbonautProfile();

  return useMutation({
    mutationFn: async ({ itemId, quantity = 1 }: { itemId: string; quantity?: number }) => {
      if (!currentProfile) {
        throw new Error('Profile not found');
      }

      if (quantity <= 0) {
        throw new Error('Quantity must be positive');
      }

      const existingItemIndex = currentProfile.storage.findIndex(item => item.itemId === itemId);
      let updatedStorage: BlobbonautStorageItem[];

      if (existingItemIndex >= 0) {
        // Update existing item
        updatedStorage = [...currentProfile.storage];
        updatedStorage[existingItemIndex] = {
          ...updatedStorage[existingItemIndex],
          quantity: updatedStorage[existingItemIndex].quantity + quantity,
        };
      } else {
        // Add new item
        updatedStorage = [...currentProfile.storage, { itemId, quantity }];
      }

      await updateProfile({
        id: currentProfile.id,
        storage: updatedStorage,
      });
    },
  });
}

/** Hook to set onboarding completion status */
export function useSetOnboardingDone() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutateAsync: updateProfile } = useUpdateBlobbonautProfile();

  return useMutation({
    mutationFn: async (done: boolean = true) => {
      if (!currentProfile) {
        throw new Error('Profile not found');
      }

      await updateProfile({
        id: currentProfile.id,
        onboardingDone: done,
      });
    },
  });
}

/** Hook to create initial profile for new users */
export function useCreateInitialProfile() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();

  return useMutation({
    mutationFn: async (customizations?: Partial<BlobbonautProfile>) => {
      if (!user) {
        throw new Error('User must be logged in to create profile');
      }

      // Use canonical profile ID format: blobbonaut-{12hex}
      const defaultProfileId = getCanonicalBlobbonautD(user.pubkey);

      // Get user's Nostr metadata for default name
      let defaultName: string | undefined;
      try {
        if (nostr) {
          const [metadataEvent] = await nostr.query(
            [{ kinds: [0], authors: [user.pubkey], limit: 1 }],
            { signal: AbortSignal.timeout(2000) }
          );

          if (metadataEvent) {
            const metadata = JSON.parse(metadataEvent.content);
            defaultName = metadata.name || metadata.display_name;
          }
        }
      } catch (error) {
        // Ignore errors when fetching metadata
      }

      // Build complete initial profile with all required fields
      const initialProfile: BlobbonautProfile = {
        id: defaultProfileId,
        ownerPubkey: user.pubkey,
        name: defaultName,
        coins: 500,
        ownedBlobbis: [],
        pettingLevel: 0,
        lifetimeBlobbis: 0,
        achievements: [],
        storage: [],
        onboardingDone: false,
        lastModified: Math.floor(Date.now() / 1000),
        ...customizations,
      };

      // Publish complete profile event directly
      const eventTemplate = createBlobbonautProfileEvent(initialProfile);
      await publishEvent(eventTemplate);

      return initialProfile;
    },
    onSuccess: (initialProfile) => {
      // Invalidate all profile-related queries
      queryClient.invalidateQueries({
        queryKey: ['blobbonaut-profile'],
      });
      queryClient.invalidateQueries({
        queryKey: ['blobbonaut-profiles'],
      });

      // Invalidate specific profile query
      queryClient.invalidateQueries({
        queryKey: ['blobbonaut-profile', initialProfile.id],
      });
    },
    onError: (error) => {
      console.error('Failed to create initial Blobbonaut Profile:', error);
    },
  });
}

// ========================
// HELPER HOOKS
// ========================

/** Hook to get storage item quantity */
export function useStorageItemQuantity(itemId: string): number {
  const { data: currentProfile } = useBlobbonautProfile();

  return useMemo(() => {
    if (!currentProfile) return 0;
    return currentProfile.storage.find(item => item.itemId === itemId)?.quantity ?? 0;
  }, [currentProfile, itemId]);
}