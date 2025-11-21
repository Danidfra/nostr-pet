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
  BlobbiStats,
  Blobbi,
} from '@/types/blobbi';

interface InteractionWithFakeStatusParams {
  blobbiId: string;
  action: BlobbiInteractionType;
  actionCategory?: string;
  statChange?: [string, number];
  statChanges?: Array<[string, number]>; // Multiple stat changes for items
  experienceGained?: number;
  carePoints?: number;
  gameType?: string;
  playDuration?: number;
  itemUsed?: string;
  customData?: Record<string, string>;
  currentBlobbi?: Blobbi; // Current blobbi state for fake status updates
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
    case 'rest':
      // For rest, handle sleep state
      if (!blobbi.isSleeping) {
        blobbi.isSleeping = true;
        blobbi.sleepStartedAt = timestamp;
        blobbi.lastSleepUpdate = timestamp;
      }
      break;
    case 'wake':
      // For wake, handle sleep state
      if (blobbi.isSleeping) {
        blobbi.isSleeping = false;
        blobbi.state = 'active';
        blobbi.sleepStartedAt = undefined;
        blobbi.lastSleepUpdate = undefined;
      }
      break;
    // 'play' and other actions don't have specific timestamps
  }
}

/**
 * Enhanced hook that handles Blobbi interactions with immediate fake status updates
 * and automatic state event publishing
 */
export function useBlobbiInteractionWithFakeStatus() {
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useEnhancedNostrPublish();
  const queryClient = useQueryClient();
  const {
    getFakeStatus,
    setFakeStatus,
    updateFakeStatus,
    incrementPendingInteractions,
    decrementPendingInteractions
  } = useBlobbiFakeStatus();

  return useMutation({
    mutationFn: async (params: InteractionWithFakeStatusParams) => {
      if (!user) {
        throw new Error('Must be logged in to perform interactions');
      }

      const {
        blobbiId,
        action,
        actionCategory = 'general',
        statChange = ['happiness', 5],
        statChanges,
        experienceGained = 5,
        carePoints = 1,
        gameType,
        playDuration,
        itemUsed,
        customData = {},
        currentBlobbi,
      } = params;

      // Get current blobbi state (fake or real)
      const blobbi = getFakeStatus(blobbiId) || currentBlobbi;
      if (!blobbi) {
        throw new Error('Blobbi not found for fake status update');
      }

      // Use multiple stat changes if provided, otherwise use single stat change
      const finalStatChanges = statChanges || [statChange];
      const primaryStatChange = finalStatChanges[0];

      // Calculate all updates first before applying fake status
      const now = Math.floor(Date.now() / 1000);

      // Apply stat changes
      const updatedBlobbi = applyStatChangesToBlobbi(blobbi, finalStatChanges);

      // Update experience and care points
      updatedBlobbi.experience = (updatedBlobbi.experience || 0) + experienceGained;
      updatedBlobbi.careStreak = (updatedBlobbi.careStreak || 0) + carePoints;

      // Update ONLY the specific timestamp for this action
      updateActionTimestamp(updatedBlobbi, action, now);

      // Update general last interaction time
      updatedBlobbi.lastInteraction = now;

      try {
        // Create interaction data
        const interactionData: BlobbiInteractionData = {
          action,
          actionCategory,
          statChange: [primaryStatChange[0], primaryStatChange[1] > 0 ? `+${primaryStatChange[1]}` : `${primaryStatChange[1]}`],
          statChanges: finalStatChanges.map(([stat, value]) => [stat, value > 0 ? `+${value}` : `${value}`]),
          experienceGained,
          carePoints,
          timeOfDay: getTimeOfDay(),
          gameType,
          playDuration,
          itemUsed,
          // Add any custom data as additional fields
          ...customData,
        };

        // Create and publish interaction event
        const interactionEventData = createBlobbiInteractionEvent(blobbiId, interactionData);

        // The enhanced publish hook will automatically handle state updates
        const interactionEvent = await publishEvent({
          ...interactionEventData,
        });

        // Only apply fake status AFTER successful calculations and event creation
        setFakeStatus(blobbiId, updatedBlobbi);
        incrementPendingInteractions(blobbiId);

        return {
          interactionEvent,
          interactionData,
          updatedBlobbi,
        };
      } catch (error) {
        // If publishing fails, we still keep the fake status for UI consistency
        // but we don't decrement pending interactions so user knows it failed
        console.error('Failed to publish interaction event:', error);
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      // Decrement pending interactions on successful publish
      decrementPendingInteractions(variables.blobbiId);

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['blobbi-state', variables.blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', variables.blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status', variables.blobbiId] });

    },
    onError: (error, variables) => {
      // On error, decrement pending interactions but keep fake status
      // This allows user to see the optimistic update while knowing it failed
      decrementPendingInteractions(variables.blobbiId);

      console.error('Failed to record interaction with fake status:', {
        blobbiId: variables.blobbiId,
        action: variables.action,
        error: error.message,
      });
    },
  });
}

/**
 * Specialized hook for game interactions with fake status
 */
export function useBlobbiGameInteractionWithFakeStatus() {
  const baseHook = useBlobbiInteractionWithFakeStatus();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      blobbiId: string;
      gameType: string;
      score: number;
      duration: number;
      energyCost?: number;
      currentBlobbi?: Blobbi;
    }) => {
      const { blobbiId, gameType, score, duration, energyCost = 10, currentBlobbi } = params;

      return await baseHook.mutateAsync({
        blobbiId,
        action: 'play',
        actionCategory: 'game',
        statChange: ['energy', -energyCost],
        statChanges: [
          ['energy', -energyCost],
          ['happiness', Math.min(15, Math.floor(score / 20))], // Happiness based on score
        ],
        experienceGained: Math.floor(score / 20),
        carePoints: Math.floor(score / 50),
        gameType,
        playDuration: duration,
        customData: {
          game_score: score.toString(),
          achievement_progress: `${gameType}_score:${score}`,
        },
        currentBlobbi,
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['blobbi-state', variables.blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', variables.blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status', variables.blobbiId] });

    },
    onError: (error, variables) => {
      console.error('Failed to record game interaction with fake status:', {
        blobbiId: variables.blobbiId,
        gameType: variables.gameType,
        error: error.message,
      });
    },
  });
}

/**
 * Hook for care interactions with fake status (feed, clean, rest, etc.)
 */
export function useBlobbiCareInteractionWithFakeStatus() {
  const baseHook = useBlobbiInteractionWithFakeStatus();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      blobbiId: string;
      action: 'feed' | 'clean' | 'rest' | 'warm' | 'medicine' | 'check' | 'sing' | 'talk' | 'play' | 'cruzar' | 'wake';
      itemUsed?: string;
      itemEffects?: Partial<BlobbiStats & { egg_temperature?: number; shell_integrity?: number }>;
      customStatChange?: [string, number];
      currentBlobbi?: Blobbi;
    }) => {
      const { blobbiId, action, itemUsed, itemEffects, customStatChange, currentBlobbi } = params;

      // Static actions that don't depend on items
      const staticActionChanges: Record<string, Array<[string, number]>> = {
        rest: [['energy', 35]],
        warm: [['egg_temperature', 5]],
        check: [['happiness', 3]],
        sing: [['happiness', 8]],
        talk: [['happiness', 6]],
        wake: [['happiness', 5]], // Default wake action gives happiness
      };

      let statChanges: Array<[string, number]>;

      // If item effects are provided (for feed, clean, medicine, play), use them
      if (itemEffects && ['feed', 'clean', 'medicine', 'play'].includes(action)) {
        statChanges = Object.entries(itemEffects).map(([stat, value]) => [stat, value as number]);
      }
      // If custom stat change is provided, use it
      else if (customStatChange) {
        statChanges = [customStatChange];
      }
      // For static actions, use predefined values
      else if (staticActionChanges[action]) {
        statChanges = staticActionChanges[action];
      }
      // Fallback
      else {
        statChanges = [['happiness', 5]];
      }

      return await baseHook.mutateAsync({
        blobbiId,
        action: action as BlobbiInteractionType,
        actionCategory: getCareActionCategory(action),
        statChanges,
        experienceGained: 5,
        carePoints: action === 'feed' || action === 'clean' ? 3 : 2,
        itemUsed,
        currentBlobbi,
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['blobbi-state', variables.blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', variables.blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status', variables.blobbiId] });

    },
    onError: (error, variables) => {
      console.error('Failed to record care interaction with fake status:', {
        blobbiId: variables.blobbiId,
        action: variables.action,
        error: error.message,
      });
    },
  });
}

// Helper functions
function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function getCareActionCategory(action: string): string {
  switch (action) {
    case 'feed':
      return 'nutrition';
    case 'clean':
      return 'hygiene';
    case 'rest':
      return 'recovery';
    case 'warm':
    case 'medicine':
    case 'check':
      return 'care';
    case 'sing':
    case 'talk':
      return 'social';
    default:
      return 'general';
  }
}