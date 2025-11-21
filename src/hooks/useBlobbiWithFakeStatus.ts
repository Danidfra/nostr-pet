import { useEffect, useMemo } from 'react';
import { useBlobbi } from '@/hooks/useBlobbi';
import { useBlobbiFakeStatus, applyStatChangesToBlobbi } from '@/contexts/BlobbiFakeStatusContext';
import { Blobbi, BlobbiState } from '@/types/blobbi';

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

  // 🔥 FIX: Enhanced sync logic with better timing and validation
  useEffect(() => {
    if (originalHook.blobbi && effectiveBlobbiId && fakeStatus) {
      // 🔥 CRITICAL: Only sync if real data is significantly newer (30+ seconds)
      // This prevents premature clearing of legitimate optimistic updates
      const realTimestamp = originalHook.blobbi.lastInteraction;
      const fakeTimestamp = fakeStatus.lastInteraction;
      const timeDifference = realTimestamp - fakeTimestamp;

      // 🔥 FIX: More conservative sync - only clear if real data is much newer AND no pending interactions
      if (timeDifference >= 30 && pendingInteractionCount === 0) {
        console.log(`🔄 [FakeStatus] Clearing outdated fake status for ${effectiveBlobbiId} (real: ${realTimestamp}, fake: ${fakeTimestamp})`);
        syncWithRealData(effectiveBlobbiId, originalHook.blobbi);
      } else if (timeDifference < -60) {
        // 🔥 FIX: If fake data is more than 60 seconds ahead of real data, something is wrong - clear it
        console.log(`⚠️ [FakeStatus] Fake status too far ahead of real data for ${effectiveBlobbiId}, clearing`);
        syncWithRealData(effectiveBlobbiId, originalHook.blobbi);
      }
    }
  }, [originalHook.blobbi, effectiveBlobbiId, fakeStatus, syncWithRealData, pendingInteractionCount]);

  // 🔥 FIX: Enhanced perform action that only creates fake status when actually needed
  const performActionWithFakeStatus = async (action: string, itemEffect?: Record<string, number>) => {
    if (!effectiveBlobbiId) return originalHook.performAction(action as 'feed' | 'play' | 'clean' | 'rest' | 'warm' | 'check' | 'sing' | 'talk' | 'medicine' | 'cruzar', itemEffect);

    // 🔥 CRITICAL: Use real data only, never create fake status from potentially stale data
    const currentBlobbi = originalHook.blobbi;
    if (!currentBlobbi) return originalHook.performAction(action as 'feed' | 'play' | 'clean' | 'rest' | 'warm' | 'check' | 'sing' | 'talk' | 'medicine' | 'cruzar', itemEffect);

    console.log(`🎮 [FakeStatus] Performing action "${action}" for ${effectiveBlobbiId}`);

    // Calculate optimistic stat changes for immediate UI feedback
    const statChanges: Array<[string, number]> = [];

    // Apply basic stat changes based on action
    if (action === 'feed' && currentBlobbi.stats.hunger < 90) {
      statChanges.push(['hunger', Math.min(30, 100 - currentBlobbi.stats.hunger)]);
    } else if (action === 'play' && currentBlobbi.stats.energy > 10) {
      statChanges.push(['energy', -10], ['happiness', Math.min(25, 100 - currentBlobbi.stats.happiness)]);
    } else if (action === 'rest') {
      statChanges.push(['energy', Math.min(35, 100 - currentBlobbi.stats.energy)]);
    } else if (action === 'clean') {
      statChanges.push(['hygiene', Math.min(40, 100 - currentBlobbi.stats.hygiene)], ['happiness', 5]);
    } else if (action === 'warm') {
      if (currentBlobbi.lifeStage === 'egg') {
        statChanges.push(['egg_temperature', Math.min(10, 100 - (currentBlobbi.eggTemperature || 50))]);
      } else {
        statChanges.push(['health', 5]);
      }
    } else if (action === 'check') {
      statChanges.push(['happiness', 3]);
    } else if (action === 'sing') {
      statChanges.push(['happiness', 8]);
    } else if (action === 'talk') {
      statChanges.push(['happiness', 6]);
    } else if (action === 'medicine') {
      statChanges.push(['health', Math.min(20, 100 - currentBlobbi.stats.health)]);
    }

    // Apply item effects if provided
    if (itemEffect && typeof itemEffect === 'object') {
      Object.entries(itemEffect).forEach(([stat, value]) => {
        if (typeof value === 'number') {
          statChanges.push([stat, value]);
        }
      });
    }

    // 🔥 FIX: Only create fake status if there are actual stat changes
    if (statChanges.length > 0) {
      const updatedBlobbi = applyStatChangesToBlobbi(currentBlobbi, statChanges);
      // Update lastInteraction to current timestamp for proper sync logic
      updatedBlobbi.lastInteraction = Math.floor(Date.now() / 1000);

      console.log(`📊 [FakeStatus] Creating optimistic update:`, statChanges);
      setFakeStatus(effectiveBlobbiId, updatedBlobbi);
      incrementPendingInteractions(effectiveBlobbiId);
    }

    // Perform the real action in the background
    try {
      const result = await originalHook.performAction(action as 'feed' | 'play' | 'clean' | 'rest' | 'warm' | 'check' | 'sing' | 'talk' | 'medicine' | 'cruzar', itemEffect);
      console.log(`✅ [FakeStatus] Real action "${action}" completed successfully`);
      return result;
    } catch (error) {
      console.error(`❌ [FakeStatus] Real action "${action}" failed:`, error);
      // 🔥 FIX: Clear fake status on error to prevent stale optimistic updates
      if (statChanges.length > 0) {
        syncWithRealData(effectiveBlobbiId, currentBlobbi);
      }
      throw error;
    }
  };

  const updateCustomizationWithFakeStatus = async (customization: Partial<Blobbi['customization']>) => {
    if (!effectiveBlobbiId) return originalHook.updateCustomization(customization);

    const currentBlobbi = fakeStatus || originalHook.blobbi;
    if (!currentBlobbi) return originalHook.updateCustomization(customization);

    const updatedBlobbi = {
      ...currentBlobbi,
      customization: {
        ...currentBlobbi.customization,
        ...customization,
      },
      lastInteraction: Math.floor(Date.now() / 1000),
    };

    setFakeStatus(effectiveBlobbiId, updatedBlobbi);
    incrementPendingInteractions(effectiveBlobbiId);

    try {
      await originalHook.updateCustomization(customization);
    } catch (error) {
      console.error('Real customization update failed, but fake status was updated:', error);
    }
  };

  const setSleepStateOptimistic = (isSleeping: boolean) => {
    if (!effectiveBlobbiId) return;

    const currentBlobbi = fakeStatus || originalHook.blobbi;
    if (!currentBlobbi) return;

    const updatedBlobbi = {
      ...currentBlobbi,
      isSleeping,
      state: (isSleeping ? 'sleeping' : 'active') as BlobbiState,
      lastInteraction: Math.floor(Date.now() / 1000),
      // Add sleep-specific fields when going to sleep
      ...(isSleeping && {
        sleepStartedAt: Math.floor(Date.now() / 1000),
        lastSleepUpdate: Math.floor(Date.now() / 1000),
      }),
      // Clear sleep-specific fields when waking up
      ...(!isSleeping && {
        sleepStartedAt: undefined,
        lastSleepUpdate: undefined,
      }),
    };

    setFakeStatus(effectiveBlobbiId, updatedBlobbi);
    // We don't increment pending interactions here because the sleep system handles the real update.
    // The optimistic state should persist until the real sleep state update completes.
  };

  // 🔥 FIX: Enhanced memoization with strict validation
  const finalBlobbi = useMemo(() => {
    // 🔥 CRITICAL: Always prefer real data unless fake status represents a very recent optimistic update
    if (fakeStatus && originalHook.blobbi && pendingInteractionCount > 0) {
      const fakeTimestamp = fakeStatus.lastInteraction;
      const realTimestamp = originalHook.blobbi.lastInteraction;
      const timeDifference = fakeTimestamp - realTimestamp;

      // Only use fake status if:
      // 1. It's newer than real data (optimistic update)
      // 2. The difference is reasonable (< 5 minutes to prevent stale data)
      // 3. There are pending interactions (indicating legitimate optimistic state)
      if (timeDifference > 0 && timeDifference < 300 && pendingInteractionCount > 0) {
        console.log(`🎭 [FakeStatus] Using fake status for ${effectiveBlobbiId} (fake: ${fakeTimestamp}, real: ${realTimestamp}, pending: ${pendingInteractionCount})`);
        return fakeStatus;
      } else {
        console.log(`📊 [FakeStatus] Using real status for ${effectiveBlobbiId} - fake data invalid or stale`);
        return originalHook.blobbi;
      }
    }

    // 🔥 ALWAYS DEFAULT TO REAL DATA - this ensures we never show wrong stats
    return originalHook.blobbi;
  }, [fakeStatus, originalHook.blobbi, effectiveBlobbiId, pendingInteractionCount]);

  return {
    ...originalHook,
    blobbi: finalBlobbi,
    performAction: performActionWithFakeStatus,
    updateCustomization: updateCustomizationWithFakeStatus,
    setSleepStateOptimistic,
    hasFakeStatus: !!fakeStatus,
    pendingInteractionCount,
  };
}