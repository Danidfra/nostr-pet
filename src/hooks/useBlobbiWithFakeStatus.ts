import { useEffect } from 'react';
import { useBlobbi } from '@/hooks/useBlobbi';
import { useBlobbiFakeStatus, applyStatChangesToBlobbi } from '@/contexts/BlobbiFakeStatusContext';
import { Blobbi } from '@/types/blobbi';

export function useBlobbiWithFakeStatus(pubkey?: string, blobbiId?: string) {
  const originalHook = useBlobbi(pubkey, blobbiId);
  const { 
    getFakeStatus, 
    setFakeStatus, 
    syncWithRealData, 
    getPendingInteractionCount,
    incrementPendingInteractions 
  } = useBlobbiFakeStatus();

  const effectiveBlobbiId = blobbiId || originalHook.blobbi?.id;
  const fakeStatus = effectiveBlobbiId ? getFakeStatus(effectiveBlobbiId) : null;
  const pendingInteractionCount = effectiveBlobbiId ? getPendingInteractionCount(effectiveBlobbiId) : 0;

  // Initialize fake status when real blobbi loads
  useEffect(() => {
    if (originalHook.blobbi && effectiveBlobbiId && !fakeStatus) {
      setFakeStatus(effectiveBlobbiId, { ...originalHook.blobbi });
    }
  }, [originalHook.blobbi, effectiveBlobbiId, fakeStatus, setFakeStatus]);

  // Sync fake status with real status when it updates
  useEffect(() => {
    if (originalHook.blobbi && effectiveBlobbiId) {
      syncWithRealData(effectiveBlobbiId, originalHook.blobbi);
    }
  }, [originalHook.blobbi, effectiveBlobbiId, syncWithRealData]);

  // Enhanced perform action that updates fake status immediately
  const performActionWithFakeStatus = async (action: string, itemEffect?: Record<string, number>) => {
    if (!effectiveBlobbiId) return originalHook.performAction(action as 'feed' | 'play' | 'clean' | 'rest' | 'warm' | 'check' | 'sing' | 'talk' | 'medicine' | 'cruzar', itemEffect);
    
    const currentBlobbi = fakeStatus || originalHook.blobbi;
    if (!currentBlobbi) return originalHook.performAction(action as 'feed' | 'play' | 'clean' | 'rest' | 'warm' | 'check' | 'sing' | 'talk' | 'medicine' | 'cruzar', itemEffect);

    // Update fake status immediately for UI responsiveness
    const statChanges: Array<[string, number]> = [];
    
    // Apply basic stat changes based on action
    if (action === 'feed' && currentBlobbi.stats.hunger < 90) {
      statChanges.push(['hunger', 20]);
    } else if (action === 'play' && currentBlobbi.stats.energy > 10) {
      statChanges.push(['energy', -10], ['happiness', 15]);
    } else if (action === 'rest') {
      statChanges.push(['energy', 35]);
    } else if (action === 'clean') {
      statChanges.push(['hygiene', 15], ['happiness', 5]);
    } else if (action === 'warm') {
      statChanges.push(['egg_temperature', 5]);
    } else if (action === 'check') {
      statChanges.push(['happiness', 3]);
    } else if (action === 'sing') {
      statChanges.push(['happiness', 8]);
    } else if (action === 'talk') {
      statChanges.push(['happiness', 6]);
    } else if (action === 'medicine') {
      statChanges.push(['health', 10]);
    }

    // Apply item effects if provided
    if (itemEffect && typeof itemEffect === 'object') {
      Object.entries(itemEffect).forEach(([stat, value]) => {
        if (typeof value === 'number') {
          statChanges.push([stat, value]);
        }
      });
    }

    if (statChanges.length > 0) {
      const updatedBlobbi = applyStatChangesToBlobbi(currentBlobbi, statChanges);
      setFakeStatus(effectiveBlobbiId, updatedBlobbi);
      incrementPendingInteractions(effectiveBlobbiId);
    }

    // Perform the real action in the background
    try {
      await originalHook.performAction(action as 'feed' | 'play' | 'clean' | 'rest' | 'warm' | 'check' | 'sing' | 'talk' | 'medicine' | 'cruzar', itemEffect);
    } catch (error) {
      console.error('Real action failed, but fake status was updated:', error);
    }
  };

  return {
    ...originalHook,
    blobbi: fakeStatus || originalHook.blobbi,
    performAction: performActionWithFakeStatus,
    hasFakeStatus: !!fakeStatus,
    pendingInteractionCount,
    // Additional methods for compatibility
    addCoins: originalHook.addCoins,
    isLoading: originalHook.isLoading,
  };
}