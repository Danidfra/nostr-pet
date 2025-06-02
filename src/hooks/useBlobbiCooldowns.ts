/**
 * Blobbi Cooldowns Hook
 * 
 * Manages cooldown state with local cache and relay synchronization
 * according to the cooldown specification.
 */

import { useState, useEffect, useCallback } from 'react';
import { BlobbiAction, BlobbiLifeStage, Blobbi } from '@/types/blobbi';
import { 
  cooldownStorage, 
  formatCooldownTime, 
  getCooldownDuration, 
  getSyncWindow,
  isActionAvailableForStage,
  COOLDOWN_DURATIONS
} from '@/lib/cooldown-storage';

// Interface for cooldown state
export interface CooldownState {
  [action: string]: {
    isOnCooldown: boolean;
    remainingTime: number;
    lastTimestamp: number | null;
    sessionInfo: {
      usesInSession: number;
      maxUses: number;
      isInGlobalCooldown: boolean;
      globalCooldownRemaining: number;
    };
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
 * Now uses pre-loaded kind 31124 data instead of separate fetches
 */
export function useBlobbiCooldowns(blobbi: Blobbi | null): UseBlobbiCooldownsReturn {
  const [cooldowns, setCooldowns] = useState<CooldownState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const blobbiId = blobbi?.id;
  const stage = blobbi?.lifeStage;

  /**
   * Initialize cooldowns from the already-loaded Blobbi data
   * Always uses the current blobbiState as the source of truth
   */
  const initializeCooldownsFromBlobbi = useCallback(async (blobbi: Blobbi) => {
    try {
      setIsLoading(true);
      setError(null);

      // Import utilities
      const { extractActionTimestamps } = await import('@/lib/blobbi-events');
      const { logCooldownSync } = await import('@/lib/interaction-logger');

      // Extract action timestamps from the already-loaded Blobbi object
      const actionTimestamps = extractActionTimestamps(blobbi);
      
      // Always initialize from the current blobbiState data - this is the source of truth
      // Remove any localStorage checks that could cause bugs
      await cooldownStorage.initializeFromActionTimestamps(blobbi.id, actionTimestamps, blobbi.lifeStage);
      
      // Log successful initialization
      logCooldownSync(blobbi.id, Object.keys(actionTimestamps), 'relay');
      
      console.log(`📊 COOLDOWNS INITIALIZED FROM BLOBBI STATE | ${blobbi.id} | ${blobbi.lifeStage} | Actions: ${Object.keys(actionTimestamps).join(', ')}`);

    } catch (err) {
      console.error('Failed to initialize cooldowns from Blobbi data:', err);
      setError(err instanceof Error ? err : new Error('Failed to initialize cooldowns'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load and update cooldown state
   */
  const updateCooldownState = useCallback(async (blobbiId: string, stage: BlobbiLifeStage) => {
    try {
      const activeCooldowns = await cooldownStorage.getActiveCooldowns(blobbiId, stage);
      const newCooldowns: CooldownState = {};

      // Get all possible actions for this stage
      const allActions: BlobbiAction[] = ['feed', 'play', 'clean', 'rest', 'warm', 'check', 'sing', 'talk', 'medicine', 'cruzar'];

      for (const action of allActions) {
        const isAvailable = isActionAvailableForStage(action, stage);
        const remainingTime = activeCooldowns[action] || 0;
        const sessionInfo = cooldownStorage.getSessionInfo(blobbiId, action, stage);

        newCooldowns[action] = {
          isOnCooldown: isAvailable && remainingTime > 0,
          remainingTime,
          lastTimestamp: null, // We'll get this from cache if needed
          sessionInfo,
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
    if (!blobbi) {
      throw new Error('Blobbi is required');
    }

    await cooldownStorage.recordInteraction(blobbi.id, action, blobbi.lifeStage);
    await updateCooldownState(blobbi.id, blobbi.lifeStage);
    
    // Import and log the interaction recording
    const { logCooldownSync } = await import('@/lib/interaction-logger');
    logCooldownSync(blobbi.id, [action], 'local');
  }, [blobbi, updateCooldownState]);

  /**
   * Refresh cooldowns (re-initialize from Blobbi data and update state)
   */
  const refreshCooldowns = useCallback(async () => {
    if (!blobbi) return;

    // Re-initialize from the current Blobbi data
    await initializeCooldownsFromBlobbi(blobbi);
    
    // Then update local state
    await updateCooldownState(blobbi.id, blobbi.lifeStage);
  }, [blobbi, initializeCooldownsFromBlobbi, updateCooldownState]);

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
    if (!blobbi) return false;
    const isAvailableForStage = isActionAvailableForStage(action, blobbi.lifeStage);
    const isOnCooldown = isActionOnCooldown(action);
    return isAvailableForStage && !isOnCooldown;
  }, [blobbi, isActionOnCooldown]);

  // Initialize cooldowns when blobbi changes
  useEffect(() => {
    if (blobbi) {
      // Log cooldown system initialization
      import('@/lib/interaction-logger').then(({ logCooldownSystemInit }) => {
        logCooldownSystemInit(blobbi.id);
      });
      
      // Initialize cooldowns from the already-loaded Blobbi data
      initializeCooldownsFromBlobbi(blobbi);
    }
  }, [blobbi, initializeCooldownsFromBlobbi]);

  // Update cooldown timers every second
  useEffect(() => {
    if (!blobbi) return;

    const interval = setInterval(async () => {
      await updateCooldownState(blobbi.id, blobbi.lifeStage);
    }, 1000);

    return () => clearInterval(interval);
  }, [blobbi, updateCooldownState]);

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