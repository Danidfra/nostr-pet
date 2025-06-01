import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useEnhancedNostrPublish } from '@/hooks/useEnhancedNostrPublish';
import { 
  createBlobbiInteractionEvent, 
  BLOBBI_EVENT_KINDS 
} from '@/lib/blobbi-events';
import { 
  BlobbiInteractionData, 
  BlobbiInteractionType,
  BlobbiStats,
} from '@/types/blobbi';

interface InteractionWithStateUpdateParams {
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
}

/**
 * Hook that handles Blobbi interactions and automatically updates the corresponding state event
 */
export function useBlobbiInteractionWithStateUpdate() {
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useEnhancedNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: InteractionWithStateUpdateParams) => {
      if (!user) {
        throw new Error('Must be logged in to perform interactions');
      }

      const {
        blobbiId,
        action,
        actionCategory = 'game',
        statChange = ['energy', -10],
        statChanges,
        experienceGained = 5,
        carePoints = 1,
        gameType,
        playDuration,
        itemUsed,
        customData = {},
      } = params;

      // Use multiple stat changes if provided, otherwise use single stat change
      const finalStatChanges = statChanges || [statChange];
      const primaryStatChange = finalStatChanges[0];

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

      return {
        interactionEvent,
        interactionData,
      };
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['blobbi-state', variables.blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', variables.blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status', variables.blobbiId] });
      
      console.log('Interaction recorded with automatic state update:', {
        blobbiId: variables.blobbiId,
        action: variables.action,
        interactionId: data.interactionEvent.id,
      });
    },
    onError: (error, variables) => {
      console.error('Failed to record interaction:', {
        blobbiId: variables.blobbiId,
        action: variables.action,
        error: error.message,
      });
    },
  });
}

/**
 * Specialized hook for game interactions
 */
export function useBlobbiGameInteraction() {
  const baseHook = useBlobbiInteractionWithStateUpdate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      blobbiId: string;
      gameType: string;
      score: number;
      duration: number;
      energyCost?: number;
    }) => {
      const { blobbiId, gameType, score, duration, energyCost = 10 } = params;

      return await baseHook.mutateAsync({
        blobbiId,
        action: 'play',
        actionCategory: 'game',
        statChange: ['energy', -energyCost],
        experienceGained: Math.floor(score / 20),
        carePoints: Math.floor(score / 50),
        gameType,
        playDuration: duration,
        customData: {
          game_score: score.toString(),
          achievement_progress: `${gameType}_score:${score}`,
        },
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['blobbi-state', variables.blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', variables.blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status', variables.blobbiId] });
      
      console.log('Game interaction recorded with automatic state update:', {
        blobbiId: variables.blobbiId,
        gameType: variables.gameType,
        score: variables.score,
        interactionId: data.interactionEvent.id,
      });
    },
    onError: (error, variables) => {
      console.error('Failed to record game interaction:', {
        blobbiId: variables.blobbiId,
        gameType: variables.gameType,
        error: error.message,
      });
    },
  });
}

/**
 * Hook for care interactions (feed, clean, rest, etc.)
 */
export function useBlobbiCareInteraction() {
  const baseHook = useBlobbiInteractionWithStateUpdate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      blobbiId: string;
      action: 'feed' | 'clean' | 'rest' | 'warm' | 'medicine' | 'check' | 'sing' | 'talk' | 'play' | 'cruzar';
      itemUsed?: string;
      itemEffects?: Partial<BlobbiStats & { egg_temperature?: number }>;
      customStatChange?: [string, number];
    }) => {
      const { blobbiId, action, itemUsed, itemEffects, customStatChange } = params;

      // Static actions that don't depend on items
      const staticActionChanges: Record<string, [string, number]> = {
        rest: ['energy', 35],
        warm: ['egg_temperature', 5],
        check: ['happiness', 3],
        sing: ['happiness', 8],
        talk: ['happiness', 6],
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
        statChanges = [staticActionChanges[action]];
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
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['blobbi-state', variables.blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', variables.blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status', variables.blobbiId] });
      
      console.log('Care interaction recorded with automatic state update:', {
        blobbiId: variables.blobbiId,
        action: variables.action,
        interactionId: data.interactionEvent.id,
      });
    },
    onError: (error, variables) => {
      console.error('Failed to record care interaction:', {
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