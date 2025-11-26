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
 * 🔥 NEW: Calculate stat changes based on action type and Blobbi state
 */
function calculateActionStatChanges(
  action: BlobbiInteractionType,
  blobbi: Blobbi
): Array<[string, number]> {
  switch (action) {
    case 'feed':
      return [['hunger', 30], ['happiness', 5]];

    case 'play':
      return [['happiness', 25], ['energy', -10]];

    case 'clean':
      return [['hygiene', 40], ['happiness', 10]];

    case 'rest':
      return [['energy', 35]];

    case 'warm':
      // 🔥 CRITICAL: Warm action for eggs applies 3 stat changes
      if (blobbi.lifeStage === 'egg') {
        return [
          ['egg_temperature', 10],
          ['health', 5],
          ['shell_integrity', 5]
        ];
      }
      // For non-eggs, just health boost
      return [['health', 5]];

    case 'medicine':
      // Medicine for eggs affects shell_integrity
      if (blobbi.lifeStage === 'egg') {
        return [['shell_integrity', 20], ['health', 10]];
      }
      return [['health', 20]];

    case 'check':
      return [['happiness', 3]];

    case 'sing':
      return [['happiness', 8]];

    case 'talk':
      return [['happiness', 6]];

    default:
      return [['happiness', 5]];
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

      // 🔥 FIX: OPTIMISTIC UPDATE - use item effects or action-based stat changes
      if (currentBlobbi) {
        // 🔥 CRITICAL: Build stat changes from item effects OR action type
        let allStatChanges: Array<[string, number]> = [];

        if (itemEffects && Object.keys(itemEffects).length > 0) {
          // Use all item effects
          allStatChanges = Object.entries(itemEffects)
            .filter(([_, value]) => value !== undefined && value !== 0)
            .map(([stat, value]) => [stat, value as number]);
        } else if (statChanges) {
          // Use explicitly provided stat changes
          allStatChanges = statChanges;
        } else if (statChange) {
          // Use single stat change
          allStatChanges = [statChange];
        } else {
          // 🔥 NEW: Calculate stat changes based on action type and Blobbi state
          allStatChanges = calculateActionStatChanges(action, currentBlobbi);
        }

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

        console.log('[INTERACTION] Applied optimistic update with', allStatChanges.length, 'stat changes:', allStatChanges.map(([s, v]) => `${s}:${v}`).join(', '));
      }

      // 🔥 FIX: Build interaction data with proper item effects or action-based changes
      // Convert itemEffects to statChanges array
      let finalStatChanges: Array<[string, string]> = [];

      if (itemEffects && Object.keys(itemEffects).length > 0) {
        // 🔥 CRITICAL: Include ALL item effects as stat changes
        finalStatChanges = Object.entries(itemEffects)
          .filter(([_, value]) => value !== undefined && value !== 0)
          .map(([stat, value]) => [stat, value.toString()]);
      } else if (statChanges) {
        // Use provided statChanges
        finalStatChanges = statChanges.map(([stat, value]) => [stat, value.toString()]);
      } else if (statChange) {
        // Use single statChange
        finalStatChanges = [[statChange[0], statChange[1].toString()]];
      } else if (currentBlobbi) {
        // 🔥 NEW: Calculate stat changes based on action type and Blobbi state
        const calculatedChanges = calculateActionStatChanges(action, currentBlobbi);
        finalStatChanges = calculatedChanges.map(([stat, value]) => [stat, value.toString()]);
      } else {
        // Default fallback
        finalStatChanges = [['happiness', '5']];
      }

      // The first stat change is the primary one (for backward compatibility)
      const primaryStatChange = finalStatChanges[0];

      console.log('[INTERACTION] Building event with stat changes:', finalStatChanges.map(([s, v]) => `${s}:${v}`).join(', '));

      const interactionData: BlobbiInteractionData = {
        action,
        actionCategory,
        statChange: primaryStatChange,
        statChanges: finalStatChanges, // 🔥 CRITICAL: Include ALL stat changes
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
      // 🔥 FIX: Comprehensive query invalidation to ensure UI updates
      console.log('[INTERACTION] Invalidating queries for', blobbiId);

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-state', blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status', blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-by-id', blobbiId] });

      // Also invalidate user blobbis list
      queryClient.invalidateQueries({ queryKey: ['user-blobbis'] });
      queryClient.invalidateQueries({ queryKey: ['user-blobbi'] });
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
