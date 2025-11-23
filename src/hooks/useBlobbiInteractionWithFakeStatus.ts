/**
 * BLOBBI INTERACTION WITH FAKE STATUS - Refactored to prevent infinite loops
 *
 * CRITICAL CHANGES:
 * - Update fake status FIRST (optimistic)
 * - Publish 14919 ONCE
 * - Auto-state handles 31124 (with guards)
 * - NO reaction to own events
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useEnhancedNostrPublish } from '@/hooks/useEnhancedNostrPublish';
import { useBlobbiFakeStatus, applyStatChangesToBlobbi } from '@/contexts/BlobbiFakeStatusContext';
import {
  createBlobbiInteractionEvent,
  BLOBBI_EVENT_KINDS
} from '@/lib/blobbi-events';
import {
  BlobbiInteractionData,
  BlobbiInteractionType,
  Blobbi,
} from '@/types/blobbi';

interface InteractionWithFakeStatusParams {
  blobbiId: string;
  action: BlobbiInteractionType;
  actionCategory?: string;
  statChange?: [string, number];
  statChanges?: Array<[string, number]>;
  experienceGained?: number;
  carePoints?: number;
  gameType?: string;
  playDuration?: number;
  duration?: number; // For game interactions
  itemUsed?: string;
  itemEffects?: Record<string, number>; // For backwards compatibility
  customStatChange?: [string, number]; // For backwards compatibility
  energyCost?: number; // For game interactions
  score?: number; // For game interactions
  customData?: Record<string, string>;
  currentBlobbi?: Blobbi;
}

/**
 * Updates the specific timestamp for a given action on a Blobbi
 */
function updateActionTimestamp(blobbi: Blobbi, action: string, timestamp: number): void {
  switch (action) {
    case 'feed':
      blobbi.lastMeal = timestamp;
      break;
    case 'clean':
      blobbi.lastClean = timestamp;
      break;
    case 'warm':
      blobbi.lastWarm = timestamp;
      break;
    case 'talk':
      blobbi.lastTalk = timestamp;
      break;
    case 'check':
      blobbi.lastCheck = timestamp;
      break;
    case 'sing':
      blobbi.lastSing = timestamp;
      break;
    case 'medicine':
      blobbi.lastMedicine = timestamp;
      break;
  }
}

/**
 * Hook for publishing Blobbi interactions with optimistic fake status updates
 *
 * FLOW:
 * 1. Update fake status (optimistic)
 * 2. Publish 14919 interaction
 * 3. Auto-state generates 31124 (with guards)
 * 4. STOP (no cascading)
 */
/**
 * Main hook for Blobbi interactions with fake status
 */
export function useBlobbiInteractionWithFakeStatus() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useEnhancedNostrPublish();
  const { setFakeStatus, incrementPendingInteractions, getFakeStatus } = useBlobbiFakeStatus();

  return useMutation({
    mutationFn: async (params: InteractionWithFakeStatusParams) => {
      if (!user) throw new Error('Must be logged in to perform interaction');

      const {
        blobbiId,
        action,
        actionCategory = 'care',
        statChange,
        statChanges,
        experienceGained = 5,
        carePoints = 1,
        gameType,
        playDuration,
        itemUsed,
        itemEffects,
        score,
        customData,
        currentBlobbi,
      } = params;

      console.log('[INTERACTION] Publishing interaction:', action);

      // 1. OPTIMISTIC UPDATE (fake status first)
      if (currentBlobbi) {
        const allStatChanges = statChanges || (statChange ? [statChange] : []);
        const optimisticBlobbi = applyStatChangesToBlobbi(
          getFakeStatus(blobbiId) || currentBlobbi,
          allStatChanges
        );

        // Update action-specific timestamp
        const currentTimestamp = Math.floor(Date.now() / 1000);
        updateActionTimestamp(optimisticBlobbi, action, currentTimestamp);
        optimisticBlobbi.lastInteraction = currentTimestamp;
        optimisticBlobbi.experience = (optimisticBlobbi.experience || 0) + experienceGained;

        // Set fake status for immediate UI update
        setFakeStatus(blobbiId, optimisticBlobbi);
        incrementPendingInteractions(blobbiId);

        console.log('[INTERACTION] Applied optimistic update');
      }

      // 2. Build interaction data
      const interactionData: BlobbiInteractionData = {
        action,
        actionCategory,
        statChange: statChange ? [statChange[0], statChange[1].toString()] : ['happiness', '5'],
        statChanges: statChanges?.map(([stat, value]) => [stat, value.toString()]),
        experienceGained,
        carePoints,
        gameType,
        playDuration,
        itemUsed,
        ...customData,
      };

      // 3. Create and publish 14919 event
      const eventData = createBlobbiInteractionEvent(blobbiId, interactionData);

      await publishEvent({
        kind: BLOBBI_EVENT_KINDS.INTERACTION,
        content: eventData.content,
        tags: eventData.tags,
      });

      // 4. STOP - auto-state will handle 31124 (with guards)
      console.log('[INTERACTION] Interaction published, auto-state will handle state update');

      return interactionData;
    },
    onSuccess: (_, { blobbiId }) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-state', blobbiId] });
    },
    onError: (error, { blobbiId }) => {
      console.error('[INTERACTION] Failed to publish interaction:', error);

      // Clear fake status on error
      const currentFake = getFakeStatus(blobbiId);
      if (currentFake) {
        // Decrement pending count (will be handled by context)
        // The fake status will be cleared on next sync
      }
    },
  });
}

// Export aliases for backwards compatibility
export const useBlobbiCareInteractionWithFakeStatus = useBlobbiInteractionWithFakeStatus;
export const useBlobbiGameInteractionWithFakeStatus = useBlobbiInteractionWithFakeStatus;
