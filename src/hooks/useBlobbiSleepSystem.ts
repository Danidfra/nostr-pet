/**
 * BLOBBI SLEEP SYSTEM - Refactored to prevent infinite loops
 * 
 * KEY CHANGES:
 * - Update fake status FIRST (optimistic)
 * - Publish 14919 ONCE
 * - Publish 31124 ONCE (with source='user')
 * - NEVER react to own events
 * - NO automatic 14919 from recovery
 */

import { useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Blobbi } from '@/types/blobbi';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostr } from '@/hooks/useNostr';
import { buildBlobbiStateTags } from '@/lib/blobbi-state-builder';
import { createBlobbiInteractionEvent, BLOBBI_EVENT_KINDS } from '@/lib/blobbi-events';

interface SleepSystemOptions {
  blobbi: Blobbi | null;
  isOwner: boolean;
  previousStateTags?: string[][];
  onOptimisticUpdate?: (updatedBlobbi: Blobbi) => void; // Callback to update fake status
}

export function useBlobbiSleepSystem({ 
  blobbi, 
  isOwner, 
  previousStateTags,
  onOptimisticUpdate 
}: SleepSystemOptions) {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  
  // Track recovery state to prevent loops
  const recoveryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastRecoveryTimeRef = useRef<number>(0);
  const hasAutoWokenRef = useRef<Set<string>>(new Set());
  
  /**
   * Publish a kind 31124 state update
   * CRITICAL: Uses source='user' to prevent auto-reaction
   */
  const publishStateUpdate = useCallback(async (updatedBlobbi: Blobbi, source: 'user' | 'auto' | 'system' = 'user') => {
    if (!user) return;
    
    console.log('[SLEEP] Publishing state update, source:', source);
    
    const tags = buildBlobbiStateTags(updatedBlobbi, previousStateTags, source);
    const content = `${updatedBlobbi.name} is a ${updatedBlobbi.lifeStage} Blobbi.`;
    
    const event = await user.signer.signEvent({
      kind: BLOBBI_EVENT_KINDS.STATE,
      content,
      tags,
      created_at: Math.floor(Date.now() / 1000),
    });
    
    await nostr.event(event, { signal: AbortSignal.timeout(5000) });
    
    // Invalidate queries to refresh UI
    queryClient.invalidateQueries({ queryKey: ['blobbi-state', updatedBlobbi.id] });
  }, [user, nostr, queryClient, previousStateTags]);
  
  /**
   * Publish a kind 14919 interaction event
   * CRITICAL: Only called by user actions, NEVER by auto-recovery
   */
  const publishInteraction = useCallback(async (
    blobbiId: string,
    action: 'rest' | 'wake',
    statChange: [string, string],
    experienceGained: number = 0,
    carePoints: number = 0
  ) => {
    if (!user) return;
    
    console.log('[SLEEP] Publishing interaction:', action);
    
    const interactionData = createBlobbiInteractionEvent(blobbiId, {
      action,
      actionCategory: 'recovery',
      statChange,
      experienceGained,
      carePoints,
      timeOfDay: getTimeOfDay(),
    });
    
    const event = await user.signer.signEvent({
      kind: BLOBBI_EVENT_KINDS.INTERACTION,
      content: interactionData.content,
      tags: interactionData.tags,
      created_at: Math.floor(Date.now() / 1000),
    });
    
    await nostr.event(event, { signal: AbortSignal.timeout(5000) });
  }, [user, nostr]);
  
  /**
   * Put Blobbi to sleep
   * User-triggered only
   * 
   * FLOW:
   * 1. Update fake status (optimistic)
   * 2. Publish 14919 interaction
   * 3. Publish 31124 state (source='user')
   * 4. STOP (no auto-reaction)
   */
  const putToSleep = useCallback(async () => {
    if (!blobbi || !isOwner || blobbi.isSleeping) {
      console.warn('[SLEEP] Cannot sleep:', { blobbi: !!blobbi, isOwner, isSleeping: blobbi?.isSleeping });
      return;
    }
    
    console.log('[SLEEP] putToSleep() called for:', blobbi.name);
    
    const currentTime = Math.floor(Date.now() / 1000);
    
    // 1. OPTIMISTIC UPDATE (fake status first)
    const updatedBlobbi: Blobbi = {
      ...blobbi,
      isSleeping: true,
      state: 'sleeping',
      sleepStartedAt: currentTime,
      lastSleepUpdate: currentTime,
      lastInteraction: currentTime,
    };
    
    // Update fake status immediately
    if (onOptimisticUpdate) {
      onOptimisticUpdate(updatedBlobbi);
    }
    
    try {
      // 2. Publish interaction event (kind 14919)
      await publishInteraction(blobbi.id, 'rest', ['energy', '0'], 0, 0);
      
      // 3. Update state to sleeping (kind 31124) with source='user'
      await publishStateUpdate(updatedBlobbi, 'user');
      
      // Reset auto-wake tracking
      hasAutoWokenRef.current.delete(blobbi.id);
      lastRecoveryTimeRef.current = Date.now();
      
      console.log('[SLEEP] Successfully put to sleep');
    } catch (error) {
      console.error('[SLEEP] Failed to put Blobbi to sleep:', error);
      
      // Revert optimistic update on error
      if (onOptimisticUpdate) {
        onOptimisticUpdate(blobbi);
      }
      
      throw error;
    }
  }, [blobbi, isOwner, publishInteraction, publishStateUpdate, onOptimisticUpdate]);
  
  /**
   * Wake up Blobbi
   * User-triggered only
   * 
   * FLOW:
   * 1. Update fake status (optimistic)
   * 2. Publish 14919 interaction
   * 3. Publish 31124 state (source='user', NO sleep tags)
   * 4. STOP (no auto-reaction)
   */
  const wakeUp = useCallback(async () => {
    if (!blobbi || !isOwner || !blobbi.isSleeping) {
      console.warn('[SLEEP] Cannot wake:', { blobbi: !!blobbi, isOwner, isSleeping: blobbi?.isSleeping });
      return;
    }
    
    console.log('[SLEEP] wakeUp() called for:', blobbi.name);
    
    const currentTime = Math.floor(Date.now() / 1000);
    const happinessChange = blobbi.stats.energy >= 50 ? 5 : -5;
    
    // 1. OPTIMISTIC UPDATE (fake status first)
    // CRITICAL: Set sleep fields to undefined to remove tags
    const updatedBlobbi: Blobbi = {
      ...blobbi,
      isSleeping: false,
      state: 'active',
      sleepStartedAt: undefined, // REMOVE
      lastSleepUpdate: undefined, // REMOVE
      lastInteraction: currentTime,
      stats: {
        ...blobbi.stats,
        happiness: Math.max(0, Math.min(100, blobbi.stats.happiness + happinessChange)),
      },
      experience: blobbi.experience + 2,
      careStreak: blobbi.careStreak + 1,
    };
    
    // Update fake status immediately
    if (onOptimisticUpdate) {
      onOptimisticUpdate(updatedBlobbi);
    }
    
    try {
      // 2. Publish interaction event (kind 14919)
      await publishInteraction(
        blobbi.id,
        'wake',
        ['happiness', happinessChange >= 0 ? `+${happinessChange}` : happinessChange.toString()],
        2,
        1
      );
      
      // 3. Update state to awake (kind 31124) with source='user'
      // buildBlobbiStateTags will NOT add sleep tags because isSleeping=false
      await publishStateUpdate(updatedBlobbi, 'user');
      
      // Reset auto-wake tracking
      hasAutoWokenRef.current.delete(blobbi.id);
      
      console.log('[SLEEP] Successfully woken up');
    } catch (error) {
      console.error('[SLEEP] Failed to wake up Blobbi:', error);
      
      // Revert optimistic update on error
      if (onOptimisticUpdate) {
        onOptimisticUpdate(blobbi);
      }
      
      throw error;
    }
  }, [blobbi, isOwner, publishInteraction, publishStateUpdate, onOptimisticUpdate]);
  
  /**
   * Apply passive sleep recovery (when app was closed)
   * Called once when Blobbi is loaded
   * 
   * CRITICAL: ONLY publishes 31124, NEVER publishes 14919
   */
  const applyPassiveRecovery = useCallback(async () => {
    if (!blobbi || !blobbi.isSleeping || !isOwner) return;
    
    const referenceTime = blobbi.lastSleepUpdate || blobbi.sleepStartedAt;
    if (!referenceTime) return;
    
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = currentTime - referenceTime;
    
    if (timeDiff < 0) return; // Future timestamp, skip
    
    const thirtyMinutes = 30 * 60; // 30 minutes in seconds
    const blocksElapsed = Math.floor(timeDiff / thirtyMinutes);
    
    if (blocksElapsed <= 0) return; // No recovery needed
    
    const energyGain = blocksElapsed * 10;
    const newEnergy = Math.min(100, blobbi.stats.energy + energyGain);
    const actualGain = newEnergy - blobbi.stats.energy;
    
    if (actualGain <= 0) return; // No change
    
    console.log('[SLEEP] Applying passive recovery:', {
      blocksElapsed,
      energyGain: actualGain,
      newEnergy,
    });
    
    try {
      // Check if auto-wake is needed
      const shouldAutoWake = newEnergy >= 100 && !hasAutoWokenRef.current.has(blobbi.id);
      
      const updatedBlobbi: Blobbi = {
        ...blobbi,
        stats: {
          ...blobbi.stats,
          energy: newEnergy,
        },
        lastInteraction: currentTime,
        // Auto-wake if energy reaches 100
        isSleeping: shouldAutoWake ? false : true,
        state: shouldAutoWake ? 'active' : 'sleeping',
        sleepStartedAt: shouldAutoWake ? undefined : blobbi.sleepStartedAt,
        lastSleepUpdate: shouldAutoWake ? undefined : currentTime,
      };
      
      // Update fake status
      if (onOptimisticUpdate) {
        onOptimisticUpdate(updatedBlobbi);
      }
      
      // ONLY publish 31124 (NO 14919)
      await publishStateUpdate(updatedBlobbi, 'system');
      
      if (shouldAutoWake) {
        hasAutoWokenRef.current.add(blobbi.id);
        console.log('[SLEEP] Auto-woke at 100 energy');
      }
    } catch (error) {
      console.error('[SLEEP] Failed to apply passive recovery:', error);
    }
  }, [blobbi, isOwner, publishStateUpdate, onOptimisticUpdate]);
  
  /**
   * Apply active sleep recovery (while app is open)
   * Called every minute by interval
   * 
   * CRITICAL: ONLY publishes 31124, NEVER publishes 14919
   */
  const applyActiveRecovery = useCallback(async () => {
    if (!blobbi || !blobbi.isSleeping || !isOwner) return;
    
    const referenceTime = blobbi.lastSleepUpdate || blobbi.sleepStartedAt;
    if (!referenceTime) return;
    
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = currentTime - referenceTime;
    
    const thirtyMinutes = 30 * 60;
    
    // Only recover if 30 minutes have passed
    if (timeDiff < thirtyMinutes) return;
    
    const newEnergy = Math.min(100, blobbi.stats.energy + 10);
    const energyGain = newEnergy - blobbi.stats.energy;
    
    if (energyGain <= 0) return;
    
    console.log('[SLEEP] Applying active recovery:', {
      energyGain,
      newEnergy,
    });
    
    try {
      // Check if auto-wake is needed
      const shouldAutoWake = newEnergy >= 100 && !hasAutoWokenRef.current.has(blobbi.id);
      
      const updatedBlobbi: Blobbi = {
        ...blobbi,
        stats: {
          ...blobbi.stats,
          energy: newEnergy,
        },
        lastInteraction: currentTime,
        // Auto-wake if energy reaches 100
        isSleeping: shouldAutoWake ? false : true,
        state: shouldAutoWake ? 'active' : 'sleeping',
        sleepStartedAt: shouldAutoWake ? undefined : blobbi.sleepStartedAt,
        lastSleepUpdate: shouldAutoWake ? undefined : currentTime,
      };
      
      // Update fake status
      if (onOptimisticUpdate) {
        onOptimisticUpdate(updatedBlobbi);
      }
      
      // ONLY publish 31124 (NO 14919)
      await publishStateUpdate(updatedBlobbi, 'system');
      
      if (shouldAutoWake) {
        hasAutoWokenRef.current.add(blobbi.id);
        console.log('[SLEEP] Auto-woke at 100 energy');
      }
      
      lastRecoveryTimeRef.current = Date.now();
    } catch (error) {
      console.error('[SLEEP] Failed to apply active recovery:', error);
    }
  }, [blobbi, isOwner, publishStateUpdate, onOptimisticUpdate]);
  
  // Apply passive recovery once when Blobbi loads
  useEffect(() => {
    if (blobbi && blobbi.isSleeping && isOwner) {
      applyPassiveRecovery();
    }
  }, [blobbi?.id, blobbi?.isSleeping]); // Only run when ID or sleep state changes
  
  // Set up active recovery interval
  useEffect(() => {
    if (blobbi?.isSleeping && isOwner) {
      // Check every minute
      recoveryIntervalRef.current = setInterval(applyActiveRecovery, 60 * 1000);
      
      return () => {
        if (recoveryIntervalRef.current) {
          clearInterval(recoveryIntervalRef.current);
          recoveryIntervalRef.current = null;
        }
      };
    } else {
      if (recoveryIntervalRef.current) {
        clearInterval(recoveryIntervalRef.current);
        recoveryIntervalRef.current = null;
      }
    }
  }, [blobbi?.isSleeping, isOwner, applyActiveRecovery]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recoveryIntervalRef.current) {
        clearInterval(recoveryIntervalRef.current);
      }
    };
  }, []);
  
  return {
    isSleeping: blobbi?.isSleeping || false,
    canSleep: blobbi && !blobbi.isSleeping && isOwner,
    canWakeUp: blobbi?.isSleeping && isOwner,
    putToSleep,
    wakeUp,
  };
}

// Helper function
function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
