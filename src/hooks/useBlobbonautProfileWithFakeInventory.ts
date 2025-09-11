import { useEffect } from 'react';
import { useBlobbonautProfile, useUpdateBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useCoinBalance, useSpendCoins } from '@/hooks/useCoinBalance';
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
  const spendCoins = useSpendCoins();

  const effectiveProfileId = profileId || originalHook.data?.id;
  const fakeInventory = effectiveProfileId ? getFakeInventory(effectiveProfileId) : null;

  // Initialize fake inventory when real profile loads
  useEffect(() => {
    if (originalHook.data && effectiveProfileId && !fakeInventory) {
      setFakeInventory(effectiveProfileId, { ...originalHook.data });
    }
  }, [originalHook.data, effectiveProfileId, fakeInventory, setFakeInventory]);

  // Sync fake inventory with real inventory when it updates
  useEffect(() => {
    if (originalHook.data && effectiveProfileId) {
      syncWithRealData(effectiveProfileId, originalHook.data);
    }
  }, [originalHook.data, effectiveProfileId, syncWithRealData]);

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

    const existingItemIndex = currentProfile.storage.findIndex(item => item.itemId === itemId);

    let updatedStorage;
    if (existingItemIndex >= 0) {
      updatedStorage = [...currentProfile.storage];
      updatedStorage[existingItemIndex] = {
        ...updatedStorage[existingItemIndex],
        quantity: updatedStorage[existingItemIndex].quantity + quantity,
      };
    } else {
      updatedStorage = [...currentProfile.storage, { itemId, quantity }];
    }

    const updatedProfile: BlobbonautProfile = {
      ...currentProfile,
      storage: updatedStorage,
      lastModified: Math.floor(Date.now() / 1000),
    };

    // Update storage first
    await updateProfileWithFakeInventory(updatedProfile);

    // Then spend coins
    await spendCoins(totalCost, `Purchase ${quantity}x ${itemId}`);
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
