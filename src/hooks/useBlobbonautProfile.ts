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

// ========================
// QUERY HOOKS
// ========================

/** Hook to get a Blobbonaut Profile by ID or current user */
export function useBlobbonautProfile(profileId?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  
  const effectiveProfileId = useMemo(() => 
    profileId ?? (user ? `Blobbonaut-${user.pubkey.slice(0, 8)}` : undefined),
    [profileId, user?.pubkey]
  );

  return useQuery({
    queryKey: ['blobbonaut-profile', effectiveProfileId],
    queryFn: async ({ signal }) => {
      if (!effectiveProfileId || !nostr) return null;

      const events = await nostr.query(
        [{
          kinds: [BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE],
          '#d': [effectiveProfileId],
          limit: 1,
        }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      if (events.length === 0) return null;
      return parseBlobbonautProfileFromEvent(events[0]);
    },
    enabled: !!effectiveProfileId && !!nostr,
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

      const events = await nostr.query(
        [{
          kinds: [BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE],
          '#d': sortedProfileIds,
        }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      const eventsByProfile = new Map<string, { profile: BlobbonautProfile; created_at: number }>();

      events.forEach(event => {
        const profile = parseBlobbonautProfileFromEvent(event);
        if (!profile) return;

        const existing = eventsByProfile.get(profile.id);
        if (!existing || event.created_at > existing.created_at) {
          eventsByProfile.set(profile.id, { profile, created_at: event.created_at });
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (partialUpdate: Partial<BlobbonautProfile>) => {
      if (!currentProfile) {
        throw new Error('Profile not found. Cannot update without existing profile.');
      }

      // Merge partial update with current profile to create complete snapshot
      const updatedProfile: BlobbonautProfile = {
        ...currentProfile,
        ...partialUpdate,
        id: currentProfile.id,                    // Never lose the ID
        ownerPubkey: currentProfile.ownerPubkey,  // Never lose the owner
        lastModified: Math.floor(Date.now() / 1000),
      };

      const eventTemplate = createBlobbonautProfileEvent(updatedProfile);
      await publishEvent(eventTemplate);
      
      return updatedProfile;
    },
    onSuccess: (updatedProfile) => {
      // Invalidate profile queries with consistent keys
      queryClient.invalidateQueries({
        queryKey: ['blobbonaut-profile'],
      });
      queryClient.invalidateQueries({
        queryKey: ['blobbonaut-profiles'],
      });
      
      // Invalidate specific profile query
      queryClient.invalidateQueries({
        queryKey: ['blobbonaut-profile', updatedProfile.id],
      });
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

      const defaultProfileId = `Blobbonaut-${user.pubkey.slice(0, 8)}`;

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