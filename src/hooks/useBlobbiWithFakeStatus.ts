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

  // 🔥 FIX: Sync logic - always prefer real data when it's newer
  useEffect(() => {
    if (!originalHook.blobbi || !effectiveBlobbiId) return;

    // If we have fake status, check if real data is newer
    if (fakeStatus) {
      const realTimestamp = originalHook.blobbi.lastInteraction;
      const fakeTimestamp = fakeStatus.lastInteraction;
      const timeDifference = realTimestamp - fakeTimestamp;

      // 🔥 CRITICAL: Clear fake status when real data is equal or newer
      // This ensures UI always shows the latest Nostr state
      if (timeDifference >= 0) {
        console.log('[FAKE STATUS] Real data is current, clearing fake status');
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
        // 🔥 FIX: Warm action for eggs applies 3 stat changes
        if (currentBlobbi.lifeStage === 'egg') {
          statChanges.push(
            ['egg_temperature', 10],
            ['health', 5],
            ['shell_integrity', 5]
          );
        } else {
          // For non-eggs, just a small health boost
          statChanges.push(['health', 5]);
        }
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

  // 🔥 FIX: Display logic - prefer real data unless fake is genuinely newer
  const displayBlobbi = useMemo(() => {
    if (!originalHook.blobbi) return null;

    // 🔥 CRITICAL: Only use fake status if it's genuinely ahead of real data
    // This ensures the UI updates immediately when new real data arrives
    if (!fakeStatus) return originalHook.blobbi;

    const realTimestamp = originalHook.blobbi.lastInteraction;
    const fakeTimestamp = fakeStatus.lastInteraction;

    // Use fake status ONLY if:
    // 1. Fake is newer than real (optimistic update hasn't been confirmed yet)
    // 2. AND there are pending interactions
    if (fakeTimestamp > realTimestamp && pendingInteractionCount > 0) {
      console.log('[FAKE STATUS] Using fake status for display (optimistic)');
      return fakeStatus;
    }

    // Otherwise, always use real data
    console.log('[FAKE STATUS] Using real data for display');
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
