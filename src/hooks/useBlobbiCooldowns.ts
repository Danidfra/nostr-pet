/**
 * Blobbi Cooldowns Hook
 * 
 * Manages cooldown state with local cache and relay synchronization
 * according to the cooldown specification.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { BlobbiAction, BlobbiLifeStage, Blobbi } from '@/types/blobbi';
import { BLOBBI_EVENT_KINDS } from '@/lib/blobbi-events';
import { 
  cooldownStorage, 
  formatCooldownTime, 
  getCooldownDuration, 
  getSyncWindow,
  isActionAvailableForStage 
} from '@/lib/cooldown-storage';

// Interface for cooldown state
export interface CooldownState {
  [action: string]: {
    isOnCooldown: boolean;
    remainingTime: number;
    lastTimestamp: number | null;
  };
}

// Interface for the hook return value
export interface UseBlobbiCooldownsReturn {
  cooldowns: CooldownState;
  isLoading: boolean;
  error: Error | null;
  recordInteraction: (action: BlobbiAction) => Promise<void>;
  refreshCooldowns: () => Promise<void>;
  formatRemainingTime: (action: BlobbiAction) => string;
  isActionOnCooldown: (action: BlobbiAction) => boolean;
  isActionAvailable: (action: BlobbiAction) => boolean;
}

/**
 * Hook for managing Blobbi interaction cooldowns
 */
export function useBlobbiCooldowns(blobbi: Blobbi | null): UseBlobbiCooldownsReturn {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const [cooldowns, setCooldowns] = useState<CooldownState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const blobbiId = blobbi?.id;
  const stage = blobbi?.lifeStage;

  /**
   * Fetch recent interaction events from relay for cooldown sync
   */
  const fetchRecentInteractions = useCallback(async (blobbiId: string, stage: BlobbiLifeStage) => {
    if (!nostr) return [];

    const syncWindow = getSyncWindow(stage);
    const since = Math.floor((Date.now() - syncWindow) / 1000);

    try {
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([
        {
          kinds: [BLOBBI_EVENT_KINDS.INTERACTION],
          '#blobbi_id': [blobbiId],
          since,
          limit: 100,
        }
      ], { signal });

      return events.sort((a, b) => b.created_at - a.created_at);
    } catch (error) {
      console.warn('Failed to fetch recent interactions:', error);
      return [];
    }
  }, [nostr]);

  /**
   * Fetch status events for egg stage to restore UI state
   */
  const fetchStatusEvents = useCallback(async (blobbiId: string) => {
    if (!nostr) return [];

    try {
      const signal = AbortSignal.timeout(3000);
      const events = await nostr.query([
        {
          kinds: [BLOBBI_EVENT_KINDS.STATE],
          '#d': [blobbiId],
          limit: 10,
        }
      ], { signal });

      return events.sort((a, b) => b.created_at - a.created_at);
    } catch (error) {
      console.warn('Failed to fetch status events:', error);
      return [];
    }
  }, [nostr]);

  /**
   * Sync cooldowns from relay events
   */
  const syncCooldownsFromRelay = useCallback(async (blobbiId: string, stage: BlobbiLifeStage) => {
    try {
      setIsLoading(true);
      setError(null);

      // Import logger
      const { logCooldownSync } = await import('@/lib/interaction-logger');

      // Fetch recent interaction events
      const interactionEvents = await fetchRecentInteractions(blobbiId, stage);
      
      // For egg stage, also fetch status events
      let statusEvents: Array<{ tags: string[][]; created_at: number }> = [];
      if (stage === 'egg') {
        statusEvents = await fetchStatusEvents(blobbiId);
      }

      // Process interaction events to extract action timestamps
      const actionTimestamps: Record<string, number> = {};
      
      for (const event of interactionEvents) {
        const actionTag = event.tags.find(([name]) => name === 'action');
        if (actionTag && actionTag[1]) {
          const action = actionTag[1] as BlobbiAction;
          const timestamp = event.created_at * 1000; // Convert to milliseconds
          
          // Keep the most recent timestamp for each action
          if (!actionTimestamps[action] || timestamp > actionTimestamps[action]) {
            actionTimestamps[action] = timestamp;
          }
        }
      }

      // Update local storage with synced data
      for (const [action, timestamp] of Object.entries(actionTimestamps)) {
        await cooldownStorage.setCooldown(blobbiId, action as BlobbiAction, timestamp, stage);
      }

      // Log sync event
      logCooldownSync(blobbiId, Object.keys(actionTimestamps), 'relay');

      // Process status events for egg stage warming state
      if (stage === 'egg' && statusEvents.length > 0) {
        const latestStatus = statusEvents[0];
        const lastInteractionTag = latestStatus.tags.find(([name]) => name === 'last_interaction');
        if (lastInteractionTag && lastInteractionTag[1]) {
          const lastInteractionTime = new Date(lastInteractionTag[1]).getTime();
          // This could be used to infer warming state, but we'll rely on interaction events
        }
      }

    } catch (err) {
      console.error('Failed to sync cooldowns from relay:', err);
      setError(err instanceof Error ? err : new Error('Failed to sync cooldowns'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchRecentInteractions, fetchStatusEvents]);

  /**
   * Load and update cooldown state
   */
  const updateCooldownState = useCallback(async (blobbiId: string, stage: BlobbiLifeStage) => {
    try {
      const activeCooldowns = await cooldownStorage.getActiveCooldowns(blobbiId, stage);
      const newCooldowns: CooldownState = {};

      // Get all possible actions for this stage
      const allActions: BlobbiAction[] = ['feed', 'play', 'clean', 'rest', 'warming', 'checking', 'singing', 'talking', 'medicine', 'cruzar'];

      for (const action of allActions) {
        const isAvailable = isActionAvailableForStage(action, stage);
        const remainingTime = activeCooldowns[action] || 0;
        const lastTimestamp = await cooldownStorage.getCooldown(blobbiId, action);

        newCooldowns[action] = {
          isOnCooldown: isAvailable && remainingTime > 0,
          remainingTime,
          lastTimestamp,
        };
      }

      setCooldowns(newCooldowns);
    } catch (err) {
      console.error('Failed to update cooldown state:', err);
      setError(err instanceof Error ? err : new Error('Failed to update cooldown state'));
    }
  }, []);

  /**
   * Record a new interaction and update cooldowns
   */
  const recordInteraction = useCallback(async (action: BlobbiAction) => {
    if (!blobbiId || !stage) {
      throw new Error('Blobbi ID and stage are required');
    }

    const timestamp = Date.now();
    await cooldownStorage.setCooldown(blobbiId, action, timestamp, stage);
    await updateCooldownState(blobbiId, stage);
    
    // Import and log the interaction recording
    const { logCooldownSync } = await import('@/lib/interaction-logger');
    logCooldownSync(blobbiId, [action], 'local');
  }, [blobbiId, stage, updateCooldownState]);

  /**
   * Refresh cooldowns (sync from relay and update state)
   */
  const refreshCooldowns = useCallback(async () => {
    if (!blobbiId || !stage) return;

    // First try to sync from relay
    await syncCooldownsFromRelay(blobbiId, stage);
    
    // Then update local state
    await updateCooldownState(blobbiId, stage);
  }, [blobbiId, stage, syncCooldownsFromRelay, updateCooldownState]);

  /**
   * Format remaining time for display
   */
  const formatRemainingTime = useCallback((action: BlobbiAction): string => {
    const cooldown = cooldowns[action];
    if (!cooldown || !cooldown.isOnCooldown) return '';
    return formatCooldownTime(cooldown.remainingTime);
  }, [cooldowns]);

  /**
   * Check if an action is currently on cooldown
   */
  const isActionOnCooldown = useCallback((action: BlobbiAction): boolean => {
    const cooldown = cooldowns[action];
    return cooldown?.isOnCooldown || false;
  }, [cooldowns]);

  /**
   * Check if an action is available (not on cooldown and valid for stage)
   */
  const isActionAvailable = useCallback((action: BlobbiAction): boolean => {
    if (!stage) return false;
    const isAvailableForStage = isActionAvailableForStage(action, stage);
    const isOnCooldown = isActionOnCooldown(action);
    return isAvailableForStage && !isOnCooldown;
  }, [stage, isActionOnCooldown]);

  // Initialize cooldowns when blobbi changes
  useEffect(() => {
    if (blobbiId && stage) {
      // Log cooldown system initialization
      import('@/lib/interaction-logger').then(({ logCooldownSystemInit }) => {
        logCooldownSystemInit(blobbiId);
      });
      refreshCooldowns();
    }
  }, [blobbiId, stage, refreshCooldowns]);

  // Update cooldown timers every second
  useEffect(() => {
    if (!blobbiId || !stage) return;

    const interval = setInterval(async () => {
      await updateCooldownState(blobbiId, stage);
    }, 1000);

    return () => clearInterval(interval);
  }, [blobbiId, stage, updateCooldownState]);

  // Clean up old cooldowns periodically
  useEffect(() => {
    const cleanup = async () => {
      await cooldownStorage.clearOldCooldowns();
    };

    // Clean up on mount and then every hour
    cleanup();
    const interval = setInterval(cleanup, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    cooldowns,
    isLoading,
    error,
    recordInteraction,
    refreshCooldowns,
    formatRemainingTime,
    isActionOnCooldown,
    isActionAvailable,
  };
}

/**
 * Hook for managing cooldowns across multiple Blobbis
 */
export function useMultipleBlobbiCooldowns(blobbis: Blobbi[]): Record<string, UseBlobbiCooldownsReturn> {
  const cooldownHooks: Record<string, UseBlobbiCooldownsReturn> = {};

  for (const blobbi of blobbis) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    cooldownHooks[blobbi.id] = useBlobbiCooldowns(blobbi);
  }

  return cooldownHooks;
}

/**
 * Utility hook for checking if any actions are on cooldown
 */
export function useHasActiveCooldowns(blobbi: Blobbi | null): boolean {
  const { cooldowns } = useBlobbiCooldowns(blobbi);
  
  return Object.values(cooldowns).some(cooldown => cooldown.isOnCooldown);
}

/**
 * Utility hook for getting the next action that will be available
 */
export function useNextAvailableAction(blobbi: Blobbi | null): { action: BlobbiAction | null; timeUntilAvailable: number } {
  const { cooldowns } = useBlobbiCooldowns(blobbi);
  
  let nextAction: BlobbiAction | null = null;
  let shortestTime = Infinity;

  for (const [action, cooldown] of Object.entries(cooldowns)) {
    if (cooldown.isOnCooldown && cooldown.remainingTime < shortestTime) {
      shortestTime = cooldown.remainingTime;
      nextAction = action as BlobbiAction;
    }
  }

  return {
    action: nextAction,
    timeUntilAvailable: shortestTime === Infinity ? 0 : shortestTime,
  };
}