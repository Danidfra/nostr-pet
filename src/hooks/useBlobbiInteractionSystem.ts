import { useBlobbiWithFakeStatus } from '@/hooks/useBlobbiWithFakeStatus';
import {
  useBlobbiInteractionWithFakeStatus,
  useBlobbiCareInteractionWithFakeStatus,
  useBlobbiGameInteractionWithFakeStatus
} from '@/hooks/useBlobbiInteractionWithFakeStatus';
import { useBlobbiFakeStatus } from '@/contexts/BlobbiFakeStatusContext';
import { Blobbi, BlobbiInteractionType } from '@/types/blobbi';

/**
 * Comprehensive hook that provides all Blobbi interaction functionality
 * with consistent fake status support across the entire application.
 *
 * This hook ensures that:
 * 1. All interactions update fake status immediately for responsive UI
 * 2. Real Nostr events are published in the background
 * 3. Fake status is synced with real data when available
 * 4. All components use the same interaction patterns
 */
export function useBlobbiInteractionSystem(pubkey?: string, blobbiId?: string) {
  // Core Blobbi data with fake status support
  const blobbiHook = useBlobbiWithFakeStatus(pubkey, blobbiId);

  // Interaction hooks with fake status support
  const baseInteraction = useBlobbiInteractionWithFakeStatus();
  const careInteraction = useBlobbiCareInteractionWithFakeStatus();
  const gameInteraction = useBlobbiGameInteractionWithFakeStatus();

  // Fake status management
  const fakeStatusHook = useBlobbiFakeStatus();

  /**
   * Enhanced care action that uses fake status for immediate feedback
   */
  const performCareAction = async (
    action: 'feed' | 'clean' | 'rest' | 'warm' | 'medicine' | 'check' | 'sing' | 'talk' | 'play' | 'wake',
    options?: {
      itemUsed?: string;
      itemEffects?: Record<string, number>;
      customStatChange?: [string, number];
    }
  ) => {
    if (!blobbiHook.blobbi) {
      throw new Error('No Blobbi available for interaction');
    }

    return await careInteraction.mutateAsync({
      blobbiId: blobbiHook.blobbi.id,
      action,
      itemUsed: options?.itemUsed,
      itemEffects: options?.itemEffects,
      customStatChange: options?.customStatChange,
      currentBlobbi: blobbiHook.blobbi,
    });
  };

  /**
   * Enhanced game interaction that uses fake status for immediate feedback
   */
  const performGameAction = async (
    gameType: string,
    score: number,
    duration: number,
    energyCost?: number
  ) => {
    if (!blobbiHook.blobbi) {
      throw new Error('No Blobbi available for game interaction');
    }

    return await gameInteraction.mutateAsync({
      blobbiId: blobbiHook.blobbi.id,
      gameType,
      score,
      duration,
      energyCost,
      currentBlobbi: blobbiHook.blobbi,
    });
  };

  /**
   * Generic interaction for custom actions
   */
  const performCustomInteraction = async (
    action: BlobbiInteractionType,
    options?: {
      actionCategory?: string;
      statChanges?: Array<[string, number]>;
      experienceGained?: number;
      carePoints?: number;
      customData?: Record<string, string>;
    }
  ) => {
    if (!blobbiHook.blobbi) {
      throw new Error('No Blobbi available for interaction');
    }

    return await baseInteraction.mutateAsync({
      blobbiId: blobbiHook.blobbi.id,
      action,
      actionCategory: options?.actionCategory,
      statChanges: options?.statChanges,
      experienceGained: options?.experienceGained,
      carePoints: options?.carePoints,
      customData: options?.customData,
      currentBlobbi: blobbiHook.blobbi,
    });
  };

  /**
   * Check if there are pending interactions (optimistic updates not yet confirmed)
   */
  const hasPendingInteractions = () => {
    if (!blobbiHook.blobbi) return false;
    return fakeStatusHook.getPendingInteractionCount(blobbiHook.blobbi.id) > 0;
  };

  /**
   * Get the pending interaction count
   */
  const pendingInteractionCount = blobbiHook.blobbi ? fakeStatusHook.getPendingInteractionCount(blobbiHook.blobbi.id) : 0;

  /**
   * Get the current fake status for the Blobbi (if any)
   */
  const getFakeStatus = () => {
    if (!blobbiHook.blobbi) return null;
    return fakeStatusHook.getFakeStatus(blobbiHook.blobbi.id);
  };

  /**
   * Clear fake status (useful for debugging or manual sync)
   */
  const clearFakeStatus = () => {
    if (!blobbiHook.blobbi) return;
    fakeStatusHook.clearFakeStatus(blobbiHook.blobbi.id);
  };

  /**
   * Force sync with real data (useful for debugging)
   */
  const forceSyncWithRealData = () => {
    if (!blobbiHook.blobbi) return;
    // This will trigger a refetch of the real data
    // The fake status hook will automatically sync when new real data arrives
  };

  return {
    // Core Blobbi data (with fake status applied)
    ...blobbiHook,

    // Enhanced interaction methods
    performCareAction,
    performGameAction,
    performCustomInteraction,

    // Fake status utilities
    hasPendingInteractions,
    pendingInteractionCount,
    getFakeStatus,
    clearFakeStatus,
    forceSyncWithRealData,

    // Status indicators
    isPerformingCareAction: careInteraction.isPending,
    isPerformingGameAction: gameInteraction.isPending,
    isPerformingCustomAction: baseInteraction.isPending,

    // Legacy compatibility (maps to performCareAction)
    performAction: async (action: string, itemEffect?: Record<string, number>) => {
      // Map legacy performAction calls to the new care action system
      const careActions = ['feed', 'clean', 'rest', 'warm', 'medicine', 'check', 'sing', 'talk', 'play', 'wake'];

      if (careActions.includes(action)) {
        return await performCareAction(action as 'feed' | 'clean' | 'rest' | 'warm' | 'medicine' | 'check' | 'sing' | 'talk' | 'play' | 'wake', {
          itemEffects: itemEffect,
        });
      } else {
        // For non-care actions, use custom interaction
        return await performCustomInteraction(action as BlobbiInteractionType);
      }
    },
  };
}

/**
 * Hook specifically for game interactions with fake status support
 */
export function useBlobbiGameSystem(blobbiId?: string) {
  const gameInteraction = useBlobbiGameInteractionWithFakeStatus();
  const { blobbi, isLoading } = useBlobbiWithFakeStatus(undefined, blobbiId);

  const playGame = async (
    gameType: string,
    score: number,
    duration: number,
    energyCost?: number
  ) => {
    if (!blobbi) {
      throw new Error('No Blobbi available for game');
    }

    return await gameInteraction.mutateAsync({
      blobbiId: blobbi.id,
      gameType,
      score,
      duration,
      energyCost,
      currentBlobbi: blobbi,
    });
  };

  return {
    blobbi,
    playGame,
    isPlaying: gameInteraction.isPending,
    isLoading,
  };
}

/**
 * Hook for components that only need to display Blobbi data with fake status
 */
export function useBlobbiDisplay(pubkey?: string, blobbiId?: string) {
  const { blobbi, isLoading, hasFakeStatus, pendingInteractionCount } = useBlobbiWithFakeStatus(pubkey, blobbiId);

  return {
    blobbi,
    isLoading,
    hasFakeStatus,
    pendingInteractionCount,
    // Visual indicators for fake status
    isOptimistic: hasFakeStatus,
    hasUnconfirmedChanges: pendingInteractionCount > 0,
  };
}