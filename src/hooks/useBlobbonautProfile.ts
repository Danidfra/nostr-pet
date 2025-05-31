import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { BlobbonautProfile } from '@/types/blobbi';
import { 
  BLOBBI_EVENT_KINDS, 
  createBlobbonautProfileEvent,
  parseBlobbonautProfileFromEvent 
} from '@/lib/blobbi-events';

// Hook to get the current user's Blobbanaut Profile
export function useBlobbonautProfile(profileId?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  
  // Use provided profileId or generate default one from user pubkey
  const actualProfileId = profileId || (user ? `Blobbanaut-${user.pubkey.slice(0, 8)}` : undefined);

  return useQuery({
    queryKey: ['blobbanaut-profile', actualProfileId],
    queryFn: async ({ signal }) => {
      if (!actualProfileId) return null;
      
      const events = await nostr.query(
        [{ 
          kinds: [BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE], 
          '#d': [actualProfileId],
          limit: 1 
        }], 
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      if (events.length === 0) return null;
      
      // Get the most recent event (should be only one due to NIP-33 replaceable)
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
      return parseBlobbonautProfileFromEvent(latestEvent);
    },
    enabled: !!actualProfileId,
  });
}

// Hook to get multiple Blobbanaut Profiles by their IDs
export function useBlobbonautProfiles(profileIds: string[]) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['blobbanaut-profiles', profileIds.sort()],
    queryFn: async ({ signal }) => {
      if (profileIds.length === 0) return [];
      
      const events = await nostr.query(
        [{ 
          kinds: [BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE], 
          '#d': profileIds,
        }], 
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      // Group events by profile ID and get the latest for each
      const profileMap = new Map<string, BlobbonautProfile>();
      
      // Group events by profile ID and get the latest for each
      const eventsByProfile = new Map<string, { profile: BlobbonautProfile; created_at: number }>();
      
      events.forEach(event => {
        const profile = parseBlobbonautProfileFromEvent(event);
        if (profile) {
          const existing = eventsByProfile.get(profile.id);
          if (!existing || event.created_at > existing.created_at) {
            eventsByProfile.set(profile.id, { profile, created_at: event.created_at });
          }
        }
      });

      return Array.from(eventsByProfile.values()).map(({ profile }) => profile);
    },
    enabled: profileIds.length > 0,
  });
}

// Hook to update/create a Blobbanaut Profile
export function useUpdateBlobbonautProfile() {
  const { mutate: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (profile: BlobbonautProfile) => {
      if (!user) {
        throw new Error('User must be logged in to update profile');
      }

      const eventTemplate = createBlobbonautProfileEvent(profile);
      return publishEvent(eventTemplate);
    },
    onSuccess: (_, profile) => {
      // Invalidate and refetch the profile
      queryClient.invalidateQueries({ 
        queryKey: ['blobbanaut-profile', profile.id] 
      });
      
      // Also invalidate profiles list if this profile is part of any list
      queryClient.invalidateQueries({ 
        queryKey: ['blobbanaut-profiles'] 
      });
    },
    onError: (error) => {
      console.error('Failed to update Blobbanaut Profile:', error);
    },
  });
}

// Hook to add coins to the current user's profile
export function useAddCoins() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutate: updateProfile } = useUpdateBlobbonautProfile();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (coinsToAdd: number) => {
      if (!user || !currentProfile) {
        throw new Error('User must be logged in and have a profile');
      }

      const updatedProfile: BlobbonautProfile = {
        ...currentProfile,
        coins: currentProfile.coins + coinsToAdd,
      };

      return new Promise<void>((resolve, reject) => {
        updateProfile(updatedProfile, {
          onSuccess: () => resolve(),
          onError: reject,
        });
      });
    },
  });
}

// Hook to spend coins from the current user's profile
export function useSpendCoins() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutate: updateProfile } = useUpdateBlobbonautProfile();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (coinsToSpend: number) => {
      if (!user || !currentProfile) {
        throw new Error('User must be logged in and have a profile');
      }

      if (currentProfile.coins < coinsToSpend) {
        throw new Error('Insufficient coins');
      }

      const updatedProfile: BlobbonautProfile = {
        ...currentProfile,
        coins: currentProfile.coins - coinsToSpend,
      };

      return new Promise<void>((resolve, reject) => {
        updateProfile(updatedProfile, {
          onSuccess: () => resolve(),
          onError: reject,
        });
      });
    },
  });
}

// Hook to add a Blobbi to the user's collection
export function useAddBlobbi() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutate: updateProfile } = useUpdateBlobbonautProfile();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (blobbiId: string) => {
      if (!user || !currentProfile) {
        throw new Error('User must be logged in and have a profile');
      }

      // Don't add if already owned
      if (currentProfile.ownedBlobbis.includes(blobbiId)) {
        return;
      }

      const updatedProfile: BlobbonautProfile = {
        ...currentProfile,
        ownedBlobbis: [...currentProfile.ownedBlobbis, blobbiId],
        lifetimeBlobbis: currentProfile.lifetimeBlobbis + 1,
        // Set as starter Blobbi if this is the first one
        starterBlobbi: currentProfile.ownedBlobbis.length === 0 ? blobbiId : currentProfile.starterBlobbi,
      };

      return new Promise<void>((resolve, reject) => {
        updateProfile(updatedProfile, {
          onSuccess: () => resolve(),
          onError: reject,
        });
      });
    },
  });
}

// Hook to remove a Blobbi from the user's collection (for trading/releasing)
export function useRemoveBlobbi() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutate: updateProfile } = useUpdateBlobbonautProfile();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (blobbiId: string) => {
      if (!user || !currentProfile) {
        throw new Error('User must be logged in and have a profile');
      }

      const updatedProfile: BlobbonautProfile = {
        ...currentProfile,
        ownedBlobbis: currentProfile.ownedBlobbis.filter(id => id !== blobbiId),
        // Clear favorite if it was the removed Blobbi
        favoriteBlobbi: currentProfile.favoriteBlobbi === blobbiId ? undefined : currentProfile.favoriteBlobbi,
      };

      return new Promise<void>((resolve, reject) => {
        updateProfile(updatedProfile, {
          onSuccess: () => resolve(),
          onError: reject,
        });
      });
    },
  });
}

// Hook to update petting level
export function useUpdatePettingLevel() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutate: updateProfile } = useUpdateBlobbonautProfile();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (newLevel: number) => {
      if (!user || !currentProfile) {
        throw new Error('User must be logged in and have a profile');
      }

      const updatedProfile: BlobbonautProfile = {
        ...currentProfile,
        pettingLevel: Math.max(0, newLevel),
      };

      return new Promise<void>((resolve, reject) => {
        updateProfile(updatedProfile, {
          onSuccess: () => resolve(),
          onError: reject,
        });
      });
    },
  });
}

// Hook to add an achievement
export function useAddAchievement() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutate: updateProfile } = useUpdateBlobbonautProfile();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (achievementId: string) => {
      if (!user || !currentProfile) {
        throw new Error('User must be logged in and have a profile');
      }

      // Don't add if already achieved
      if (currentProfile.achievements.includes(achievementId)) {
        return;
      }

      const updatedProfile: BlobbonautProfile = {
        ...currentProfile,
        achievements: [...currentProfile.achievements, achievementId],
      };

      return new Promise<void>((resolve, reject) => {
        updateProfile(updatedProfile, {
          onSuccess: () => resolve(),
          onError: reject,
        });
      });
    },
  });
}

// Hook to create initial profile for new users
export function useCreateInitialProfile() {
  const { mutate: updateProfile } = useUpdateBlobbonautProfile();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (customizations?: Partial<BlobbonautProfile>) => {
      if (!user) {
        throw new Error('User must be logged in to create profile');
      }

      const defaultProfileId = `Blobbanaut-${user.pubkey.slice(0, 8)}`;
      
      const initialProfile: BlobbonautProfile = {
        id: defaultProfileId,
        ownerPubkey: user.pubkey,
        coins: 100, // Starting coins
        ownedBlobbis: [],
        pettingLevel: 0,
        lifetimeBlobbis: 0,
        achievements: [],
        ...customizations,
      };

      return new Promise<BlobbonautProfile>((resolve, reject) => {
        updateProfile(initialProfile, {
          onSuccess: () => resolve(initialProfile),
          onError: reject,
        });
      });
    },
  });
}