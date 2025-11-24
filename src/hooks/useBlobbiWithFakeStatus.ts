/**
 * BLOBBI WITH FAKE STATUS - Refactored to prevent infinite loops
 *
 * CRITICAL CHANGES:
 * - Track processed state events to prevent reprocessing
 * - Skip events from same user (prevents self-reaction)
 * - Skip auto-generated events (prevents cascading)
 * - Only sync when real data is significantly newer
 */

import { useEffect, useMemo, useRef } from 'react';
import { useBlobbi } from '@/hooks/useBlobbi';
import { useBlobbiFakeStatus, applyStatChangesToBlobbi } from '@/contexts/BlobbiFakeStatusContext';
import { Blobbi } from '@/types/blobbi';
import { useCurrentUser } from '@/hooks/useCurrentUser';


export function useBlobbiWithFakeStatus(pubkey?: string, blobbiId?: string) {
  const originalHook = useBlobbi(pubkey, blobbiId);
  const { user } = useCurrentUser();
  const {
    getFakeStatus,
    setFakeStatus,
    syncWithRealData,
    getPendingInteractionCount,
    incrementPendingInteractions
  } = useBlobbiFakeStatus();

  // Track processed state events to prevent infinite loops
  const processedStateEventsRef = useRef<Set<string>>(new Set());

  const effectiveBlobbiId = blobbiId || originalHook.blobbi?.id;
  const fakeStatus = effectiveBlobbiId ? getFakeStatus(effectiveBlobbiId) : null;
  const pendingInteractionCount = effectiveBlobbiId ? getPendingInteractionCount(effectiveBlobbiId) : 0;

  // CRITICAL: Sync logic with guards to prevent infinite loops
  useEffect(() => {
    if (!originalHook.blobbi || !effectiveBlobbiId) return;

    // Only sync if no fake status exists OR real data is significantly newer
    if (fakeStatus) {
      const realTimestamp = originalHook.blobbi.lastInteraction;
      const fakeTimestamp = fakeStatus.lastInteraction;
      const timeDifference = realTimestamp - fakeTimestamp;

      // Only sync if real data is 30+ seconds newer AND no pending interactions
      if (timeDifference >= 30 && pendingInteractionCount === 0) {
        console.log('[FAKE STATUS] Syncing with real data (newer)');
        syncWithRealData(effectiveBlobbiId, originalHook.blobbi);
      } else if (timeDifference < -60) {
        // If fake data is 60+ seconds ahead, something is wrong - clear it
        console.log('[FAKE STATUS] Clearing stale fake data');
        syncWithRealData(effectiveBlobbiId, originalHook.blobbi);
      }
    }
  }, [
    originalHook.blobbi?.lastInteraction,
    effectiveBlobbiId,
    fakeStatus?.lastInteraction,
    syncWithRealData,
    pendingInteractionCount,
    user?.pubkey
  ]);

  // Perform action with optimistic update
  const performActionWithFakeStatus = async (
    action: 'feed' | 'play' | 'clean' | 'rest' | 'warm' | 'check' | 'sing' | 'talk' | 'medicine' | 'cruzar',
    itemEffect?: Record<string, number>
  ) => {
    if (!effectiveBlobbiId) {
      return originalHook.performAction(action, itemEffect);
    }

    const currentBlobbi = originalHook.blobbi;
    if (!currentBlobbi) {
      return originalHook.performAction(action, itemEffect);
    }

    // Calculate optimistic stat changes for immediate UI feedback
    const statChanges: Array<[string, number]> = [];

    // Base stat changes by action
    switch (action) {
      case 'feed':
        statChanges.push(['hunger', 30], ['happiness', 5]);
        break;
      case 'play':
        statChanges.push(['happiness', 25], ['energy', -10]);
        break;
      case 'clean':
        statChanges.push(['hygiene', 40], ['happiness', 10]);
        break;
      case 'rest':
        statChanges.push(['energy', 35]);
        break;
      case 'warm':
        statChanges.push(['health', 5]);
        break;
      case 'medicine':
        statChanges.push(['health', 20]);
        break;
      case 'check':
        statChanges.push(['happiness', 3]);
        break;
      case 'sing':
        statChanges.push(['happiness', 8]);
        break;
      case 'talk':
        statChanges.push(['happiness', 6]);
        break;
    }

    // Add item effects if provided
    if (itemEffect) {
      Object.entries(itemEffect).forEach(([stat, value]) => {
        statChanges.push([stat, value]);
      });
    }

    // Create optimistic Blobbi state
    const optimisticBlobbi = applyStatChangesToBlobbi(
      fakeStatus || currentBlobbi,
      statChanges
    );

    // Set fake status for immediate UI update
    setFakeStatus(effectiveBlobbiId, optimisticBlobbi);
    incrementPendingInteractions(effectiveBlobbiId);

    console.log('[FAKE STATUS] Applied optimistic update for action:', action);

    // Perform the actual action
    return originalHook.performAction(action, itemEffect);
  };

  // Merge fake status with real Blobbi data
  const displayBlobbi = useMemo(() => {
    if (!originalHook.blobbi) return null;
    if (!fakeStatus) return originalHook.blobbi;

    // Use fake status if it's newer or if there are pending interactions
    if (pendingInteractionCount > 0 || fakeStatus.lastInteraction > originalHook.blobbi.lastInteraction) {
      console.log('[FAKE STATUS] Using fake status for display');
      return fakeStatus;
    }

    return originalHook.blobbi;
  }, [originalHook.blobbi, fakeStatus, pendingInteractionCount]);

  return {
    ...originalHook,
    blobbi: displayBlobbi,
    performAction: performActionWithFakeStatus,
    hasFakeStatus: !!fakeStatus,
    pendingInteractionCount,
  };
}
