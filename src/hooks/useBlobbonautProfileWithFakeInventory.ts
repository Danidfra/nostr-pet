import { useEffect, useMemo, useRef } from 'react';
import { useBlobbonautProfile, useUpdateBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useCoinBalance } from '@/hooks/useCoinBalance';
import { useBlobbiFakeInventory } from '@/contexts/BlobbiFakeInventoryContext';
import { BlobbonautProfile } from '@/types/blobbi';

export function useBlobbonautProfileWithFakeInventory(profileId?: string) {
  const originalHook = useBlobbonautProfile(profileId);
  const {
    getFakeInventory,
    setFakeInventory,
    syncWithRealData,
    updateFakeInventory,
    incrementPendingInteractions,
  } = useBlobbiFakeInventory();
  const { mutate: updateProfile } = useUpdateBlobbonautProfile();
  const { data: coinBalance } = useCoinBalance();

  const effectiveProfileId = profileId || originalHook.data?.id;

  // 🔥 FIX: Track initialization to prevent redundant setFakeInventory calls
  const initializedRef = useRef<Set<string>>(new Set());

  // 🔥 FIX: Get fake inventory in useMemo to avoid calling during every render
  const fakeInventory = useMemo(() => {
    return effectiveProfileId ? getFakeInventory(effectiveProfileId) : null;
  }, [effectiveProfileId, getFakeInventory]);

  // 🔥 FIX: Initialize fake inventory only once per profile
  useEffect(() => {
    if (originalHook.data && effectiveProfileId && !fakeInventory && !initializedRef.current.has(effectiveProfileId)) {
      console.log('[FAKE INVENTORY] Initializing for profile:', effectiveProfileId);
      setFakeInventory(effectiveProfileId, { ...originalHook.data });
      initializedRef.current.add(effectiveProfileId);
    }
  }, [originalHook.data, effectiveProfileId, fakeInventory, setFakeInventory]);

  // 🔥 FIX: Sync only when real data's lastModified actually changes
  const lastSyncedModified = useRef<number>(0);
  useEffect(() => {
    if (originalHook.data && effectiveProfileId && originalHook.data.lastModified !== lastSyncedModified.current) {
      console.log('[FAKE INVENTORY] Syncing with real data, lastModified:', originalHook.data.lastModified);
      syncWithRealData(effectiveProfileId, originalHook.data);
      lastSyncedModified.current = originalHook.data.lastModified;
    }
  }, [originalHook.data?.lastModified, effectiveProfileId, syncWithRealData]);

  // Enhanced update function that updates fake inventory immediately
  const updateProfileWithFakeInventory = async (updatedProfile: BlobbonautProfile) => {
    if (!effectiveProfileId) return updateProfile(updatedProfile);

    // Update fake inventory immediately for UI responsiveness
    setFakeInventory(effectiveProfileId, updatedProfile);
    incrementPendingInteractions(effectiveProfileId);

    // Perform the real update in the background
    try {
      await updateProfile(updatedProfile);
    } catch (error) {
      console.error('Real profile update failed, but fake inventory was updated:', error);
    }
  };

  const purchaseItemWithFakeInventory = async ({ itemId, price, quantity = 1 }: { itemId: string; price: number; quantity?: number }) => {
    const currentProfile = fakeInventory || originalHook.data;
    if (!currentProfile || !effectiveProfileId) {
      throw new Error('User must be logged in and have a profile');
    }

    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    const totalCost = price * quantity;

    // Check balance using the coin balance system
    const availableCoins = coinBalance?.balance || currentProfile.coins;

    if (availableCoins < totalCost) {
      throw new Error(`Insufficient coins. Need ${totalCost}, have ${availableCoins}`);
    }

    // Find existing item in storage
    const existingItemIndex = currentProfile.storage.findIndex(item => item.itemId === itemId);

    let updatedStorage: BlobbonautProfile['storage'];
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

    // Create a single updated profile with both storage and coin balance changes
    const updatedProfile: BlobbonautProfile = {
      ...currentProfile,
      coins: currentProfile.coins - totalCost, // Subtract coins in the same event
      storage: updatedStorage,
      lastModified: Math.floor(Date.now() / 1000),
    };

    // Update profile with both storage and coin changes in a single event
    await updateProfileWithFakeInventory(updatedProfile);
  };

  const removeFromStorageWithFakeInventory = async ({ itemId, quantity = 1 }: { itemId: string; quantity?: number }) => {
    const currentProfile = fakeInventory || originalHook.data;
    if (!currentProfile || !effectiveProfileId) {
      throw new Error('User must be logged in and have a profile');
    }

    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    const existingItemIndex = currentProfile.storage.findIndex(item => item.itemId === itemId);

    if (existingItemIndex < 0) {
      throw new Error(`Item ${itemId} not found in storage`);
    }

    const existingItem = currentProfile.storage[existingItemIndex];

    if (existingItem.quantity < quantity) {
      throw new Error(`Insufficient quantity. Have ${existingItem.quantity}, trying to remove ${quantity}`);
    }

    let updatedStorage;
    if (existingItem.quantity === quantity) {
      updatedStorage = currentProfile.storage.filter((_, index) => index !== existingItemIndex);
    } else {
      updatedStorage = [...currentProfile.storage];
      updatedStorage[existingItemIndex] = {
        ...existingItem,
        quantity: existingItem.quantity - quantity,
      };
    }

    const updatedProfile: BlobbonautProfile = {
      ...currentProfile,
      storage: updatedStorage,
      lastModified: Math.floor(Date.now() / 1000),
    };

    await updateProfileWithFakeInventory(updatedProfile);
  };

  // Hook to set onboarding completion status with fake inventory support
  const setOnboardingDoneWithFakeInventory = async (done: boolean = true) => {
    const currentProfile = fakeInventory || originalHook.data;
    if (!currentProfile || !effectiveProfileId) {
      throw new Error('User must be logged in and have a profile');
    }

    const updatedProfile: BlobbonautProfile = {
      ...currentProfile,
      onboardingDone: done,
      lastModified: Math.floor(Date.now() / 1000),
    };

    await updateProfileWithFakeInventory(updatedProfile);
  };

  return {
    ...originalHook,
    data: fakeInventory || originalHook.data,
    purchaseItem: purchaseItemWithFakeInventory,
    removeFromStorage: removeFromStorageWithFakeInventory,
    setOnboardingDone: setOnboardingDoneWithFakeInventory,
  };
}
