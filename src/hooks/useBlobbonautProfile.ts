import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { BlobbonautProfile, BlobbonautStorageItem } from '@/types/blobbi';
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
  const { nostr } = useNostr();

  return useMutation({
    mutationFn: async (customizations?: Partial<BlobbonautProfile>) => {
      if (!user) {
        throw new Error('User must be logged in to create profile');
      }

      const defaultProfileId = `Blobbanaut-${user.pubkey.slice(0, 8)}`;
      
      // Try to get user's Nostr metadata for default name
      let defaultName: string | undefined;
      try {
        const [metadataEvent] = await nostr.query(
          [{ kinds: [0], authors: [user.pubkey], limit: 1 }],
          { signal: AbortSignal.timeout(2000) }
        );
        
        if (metadataEvent) {
          const metadata = JSON.parse(metadataEvent.content);
          defaultName = metadata.name || metadata.display_name;
        }
      } catch (error) {
        // Ignore errors when fetching metadata, we'll use fallback
        console.log('Could not fetch user metadata for default name:', error);
      }
      
      const initialProfile: BlobbonautProfile = {
        id: defaultProfileId,
        ownerPubkey: user.pubkey,
        name: defaultName, // Include default name from Nostr metadata
        coins: 500, // Starting coins
        ownedBlobbis: [],
        pettingLevel: 0,
        lifetimeBlobbis: 0,
        achievements: [],
        storage: [], // Initialize empty storage
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

// Hook to add items to storage
export function useAddToStorage() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutate: updateProfile } = useUpdateBlobbonautProfile();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ itemId, quantity = 1 }: { itemId: string; quantity?: number }) => {
      if (!user || !currentProfile) {
        throw new Error('User must be logged in and have a profile');
      }

      if (quantity <= 0) {
        throw new Error('Quantity must be positive');
      }

      // Find existing item in storage
      const existingItemIndex = currentProfile.storage.findIndex(item => item.itemId === itemId);
      
      let updatedStorage: BlobbonautStorageItem[];
      
      if (existingItemIndex >= 0) {
        // Update existing item quantity
        updatedStorage = [...currentProfile.storage];
        updatedStorage[existingItemIndex] = {
          ...updatedStorage[existingItemIndex],
          quantity: updatedStorage[existingItemIndex].quantity + quantity,
        };
      } else {
        // Add new item to storage
        updatedStorage = [
          ...currentProfile.storage,
          { itemId, quantity },
        ];
      }

      const updatedProfile: BlobbonautProfile = {
        ...currentProfile,
        storage: updatedStorage,
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

// Hook to remove items from storage
export function useRemoveFromStorage() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutate: updateProfile } = useUpdateBlobbonautProfile();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ itemId, quantity = 1 }: { itemId: string; quantity?: number }) => {
      if (!user || !currentProfile) {
        throw new Error('User must be logged in and have a profile');
      }

      if (quantity <= 0) {
        throw new Error('Quantity must be positive');
      }

      // Find existing item in storage
      const existingItemIndex = currentProfile.storage.findIndex(item => item.itemId === itemId);
      
      if (existingItemIndex < 0) {
        throw new Error(`Item ${itemId} not found in storage`);
      }

      const existingItem = currentProfile.storage[existingItemIndex];
      
      if (existingItem.quantity < quantity) {
        throw new Error(`Insufficient quantity. Have ${existingItem.quantity}, trying to remove ${quantity}`);
      }

      let updatedStorage: BlobbonautStorageItem[];
      
      if (existingItem.quantity === quantity) {
        // Remove item completely if quantity becomes 0
        updatedStorage = currentProfile.storage.filter((_, index) => index !== existingItemIndex);
      } else {
        // Reduce quantity
        updatedStorage = [...currentProfile.storage];
        updatedStorage[existingItemIndex] = {
          ...existingItem,
          quantity: existingItem.quantity - quantity,
        };
      }

      const updatedProfile: BlobbonautProfile = {
        ...currentProfile,
        storage: updatedStorage,
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

// Hook to purchase items (spend coins and add to storage in single transaction)
export function usePurchaseItem() {
  const { data: currentProfile } = useBlobbonautProfile();
  const { mutate: updateProfile } = useUpdateBlobbonautProfile();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ itemId, price, quantity = 1 }: { itemId: string; price: number; quantity?: number }) => {
      if (!user || !currentProfile) {
        throw new Error('User must be logged in and have a profile');
      }

      if (quantity <= 0) {
        throw new Error('Quantity must be positive');
      }

      const totalCost = price * quantity;

      // Check if user has enough coins
      if (currentProfile.coins < totalCost) {
        throw new Error(`Insufficient coins. Need ${totalCost}, have ${currentProfile.coins}`);
      }

      // Find existing item in storage
      const existingItemIndex = currentProfile.storage.findIndex(item => item.itemId === itemId);
      
      let updatedStorage: BlobbonautStorageItem[];
      
      if (existingItemIndex >= 0) {
        // Update existing item quantity
        updatedStorage = [...currentProfile.storage];
        updatedStorage[existingItemIndex] = {
          ...updatedStorage[existingItemIndex],
          quantity: updatedStorage[existingItemIndex].quantity + quantity,
        };
      } else {
        // Add new item to storage
        updatedStorage = [
          ...currentProfile.storage,
          { itemId, quantity },
        ];
      }

      // Update profile with both coin deduction and storage addition
      const updatedProfile: BlobbonautProfile = {
        ...currentProfile,
        coins: currentProfile.coins - totalCost,
        storage: updatedStorage,
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

// Hook to get storage item quantity
export function useStorageItemQuantity(itemId: string): number {
  const { data: currentProfile } = useBlobbonautProfile();
  
  if (!currentProfile) return 0;
  
  const storageItem = currentProfile.storage.find(item => item.itemId === itemId);
  return storageItem?.quantity || 0;
}