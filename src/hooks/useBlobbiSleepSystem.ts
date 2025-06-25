import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Blobbi } from '@/types/blobbi';
import { useBlobbiState } from '@/hooks/useBlobbiEvents';
import { useEnhancedNostrPublish } from '@/hooks/useEnhancedNostrPublish';
import { createBlobbiInteractionEvent } from '@/lib/blobbi-events';

interface SleepSystemOptions {
  blobbi: Blobbi | null;
  isOwner: boolean;
  setOptimisticSleepState?: (isSleeping: boolean) => void;
}

export function useBlobbiSleepSystem({ blobbi, isOwner, setOptimisticSleepState }: SleepSystemOptions) {
  const queryClient = useQueryClient();
  const { updateState } = useBlobbiState(blobbi?.id || '', blobbi?.ownerPubkey || '');
  const { mutateAsync: publishEvent } = useEnhancedNostrPublish();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastRecoveryRef = useRef<number>(Date.now());
  const lastPassiveRecoveryRef = useRef<number>(0);
  const processedBlobbiRef = useRef<string | null>(null);

  // ✅ Removed localStorage-based tracking since we now use lastSleepUpdate as the reference point

  // Helper function to get sleep start time from tags
  const getSleepStartTime = useCallback((blobbi: Blobbi): number | null => {
    if (blobbi.isSleeping) {
      if (blobbi.sleepStartedAt) {
        return blobbi.sleepStartedAt * 1000; // Convert to milliseconds
      } else {
        // Fallback for existing sleeping Blobbis without sleepStartedAt
        // Use lastInteraction as a reasonable estimate
        return blobbi.lastInteraction * 1000;
      }
    }
    return null;
  }, []);

  // Calculate passive recovery (when app was closed)
  const calculatePassiveRecovery = useCallback((blobbi: Blobbi): { totalRecovery: number; newBlocks: number } => {
    if (!blobbi.isSleeping) return { totalRecovery: 0, newBlocks: 0 };

    // ✅ Use lastSleepUpdate as the reference point if available, otherwise fall back to sleepStartedAt
    const referenceTime = blobbi.lastSleepUpdate 
      ? blobbi.lastSleepUpdate * 1000  // Convert to milliseconds
      : getSleepStartTime(blobbi);
    
    if (!referenceTime) return { totalRecovery: 0, newBlocks: 0 };

    const currentTime = Date.now();
    const timeDiff = currentTime - referenceTime;
    
    // Handle negative time differences (future reference time)
    if (timeDiff < 0) return { totalRecovery: 0, newBlocks: 0 };
    
    const thirtyMinutesMs = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    // Calculate how many 30-minute blocks have passed since the reference time
    const newBlocks = Math.floor(timeDiff / thirtyMinutesMs);
    
    // For new calculation approach, we don't need to track "total" vs "new" blocks
    // since we're always calculating from the last update point
    return { 
      totalRecovery: Math.max(0, newBlocks * 10), 
      newBlocks: newBlocks 
    };
  }, [getSleepStartTime]);

  // Apply passive recovery when blobbi is loaded
  const applyPassiveRecovery = useCallback(async (blobbi: Blobbi) => {
    if (!blobbi.isSleeping || !isOwner) return;

    // ✅ Use a simpler recovery key based on the current state
    const recoveryKey = `${blobbi.id}-${blobbi.lastSleepUpdate || blobbi.sleepStartedAt || blobbi.lastInteraction}`;
    
    // Prevent duplicate recovery for the same sleep session
    if (processedBlobbiRef.current === recoveryKey) {
      console.log('Passive recovery already processed for this sleep session');
      return;
    }

    const { totalRecovery, newBlocks } = calculatePassiveRecovery(blobbi);
    if (newBlocks <= 0) {
      console.log('No new recovery blocks to apply');
      // Mark as processed even if no recovery to prevent repeated checks
      processedBlobbiRef.current = recoveryKey;
      return;
    }

    const energyToAdd = newBlocks * 10;
    const newEnergy = Math.min(100, blobbi.stats.energy + energyToAdd);
    const energyGained = newEnergy - blobbi.stats.energy;

    if (energyGained > 0) {
      console.log(`Passive sleep recovery: +${energyGained} energy (${newBlocks} new blocks, ${totalRecovery} total calculated)`);
      
      try {
        // ⚠️ IMPORTANT: For passive recovery, emit only kind 31124 (state update) with last_sleep_update tag
        // Do NOT emit kind 14919 (interaction event) for passive recovery
        const currentTimestamp = Math.floor(Date.now() / 1000);
        
        // ✅ FIXED: Create a single state update that handles both energy update and wake-up if needed
        const updatedBlobbi: Blobbi = {
          ...blobbi,
          stats: {
            ...blobbi.stats,
            energy: newEnergy,
          },
          lastInteraction: currentTimestamp,
          // ✅ If energy reaches 100, wake up in the same event
          isSleeping: newEnergy >= 100 ? false : blobbi.isSleeping,
          state: newEnergy >= 100 ? 'active' : blobbi.state,
          sleepStartedAt: newEnergy >= 100 ? undefined : blobbi.sleepStartedAt,
          lastSleepUpdate: newEnergy >= 100 ? undefined : currentTimestamp, // Remove last_sleep_update when waking up, otherwise update it
        };

        // Update state directly with a single kind 31124 event
        await updateState(updatedBlobbi);

        // Mark this recovery as processed
        processedBlobbiRef.current = `${blobbi.id}-${currentTimestamp}`;

        // Log the result
        if (newEnergy >= 100) {
          console.log('Blobbi automatically woke up - energy reached 100% (single event)');
          // Clear recovery tracking when waking up
          processedBlobbiRef.current = null;
        }
      } catch (error) {
        console.error('Failed to apply passive sleep recovery:', error);
        // Reset tracking on error so it can be retried
        processedBlobbiRef.current = null;
      }
    } else {
      // Mark as processed even if no energy gained to prevent repeated attempts
      processedBlobbiRef.current = recoveryKey;
    }
  }, [calculatePassiveRecovery, isOwner, updateState]);

  // Active recovery (while app is open)
  const performActiveRecovery = useCallback(async () => {
    if (!blobbi || !blobbi.isSleeping || !isOwner) return;

    // ✅ Use lastSleepUpdate as reference point for active recovery timing
    const referenceTime = blobbi.lastSleepUpdate 
      ? blobbi.lastSleepUpdate * 1000  // Convert to milliseconds
      : (blobbi.sleepStartedAt ? blobbi.sleepStartedAt * 1000 : lastRecoveryRef.current);
    
    const currentTime = Date.now();
    const timeSinceLastUpdate = currentTime - referenceTime;
    const thirtyMinutesMs = 30 * 60 * 1000; // 30 minutes in milliseconds

    // Only recover if 30 minutes have passed since last update
    if (timeSinceLastUpdate >= thirtyMinutesMs) {
      const newEnergy = Math.min(100, blobbi.stats.energy + 10);
      const energyGained = newEnergy - blobbi.stats.energy;

      if (energyGained > 0) {
        console.log(`Active sleep recovery: +${energyGained} energy`);
        
        try {
          // ⚠️ IMPORTANT: For active recovery, emit only kind 31124 (state update) with last_sleep_update tag
          // Do NOT emit kind 14919 (interaction event) for active recovery
          const currentTimestamp = Math.floor(Date.now() / 1000);
          
          // ✅ FIXED: Create a single state update that handles both energy update and wake-up if needed
          const updatedBlobbi: Blobbi = {
            ...blobbi,
            stats: {
              ...blobbi.stats,
              energy: newEnergy,
            },
            lastInteraction: currentTimestamp,
            // ✅ If energy reaches 100, wake up in the same event
            isSleeping: newEnergy >= 100 ? false : blobbi.isSleeping,
            state: newEnergy >= 100 ? 'active' : blobbi.state,
            sleepStartedAt: newEnergy >= 100 ? undefined : blobbi.sleepStartedAt,
            lastSleepUpdate: newEnergy >= 100 ? undefined : currentTimestamp, // Remove last_sleep_update when waking up, otherwise update it
          };

          // Update state directly with a single kind 31124 event
          await updateState(updatedBlobbi);

          lastRecoveryRef.current = currentTime;

          // Log the result
          if (newEnergy >= 100) {
            console.log('Blobbi automatically woke up - energy reached 100% (single event)');
            
            // Reset recovery tracking when auto-waking
            processedBlobbiRef.current = null;
            lastPassiveRecoveryRef.current = 0;
          }
        } catch (error) {
          console.error('Failed to apply active sleep recovery:', error);
        }
      }
    }
  }, [blobbi, isOwner, updateState]);

  // Put Blobbi to sleep
  const putToSleep = useCallback(async () => {
    if (!blobbi || !isOwner || blobbi.isSleeping) return;

    console.log('Putting Blobbi to sleep...');
    setOptimisticSleepState?.(true);

    // Reset recovery tracking when starting new sleep session
    processedBlobbiRef.current = null;
    lastPassiveRecoveryRef.current = 0;
    
    const currentTime = Math.floor(Date.now() / 1000);

    try {
      // ✅ FIXED: Emit only the necessary events to prevent bombardment
      
      // 1. First, emit the "rest" interaction event (kind 14919) with special tag to prevent auto-state-generation
      const interactionEventData = createBlobbiInteractionEvent(blobbi.id, {
        action: 'rest',
        actionCategory: 'recovery',
        statChange: ['energy', '0'], // No stat change, just marks the action
        experienceGained: 0,
        carePoints: 0,
        timeOfDay: getTimeOfDay(),
      });

      // Add special tag to prevent automatic state generation by enhanced publish hook
      interactionEventData.tags.push(['no_auto_state', 'true']);

      await publishEvent(interactionEventData);

      // 2. Then, update the state to sleeping (kind 31124)
      const updatedBlobbi: Blobbi = {
        ...blobbi,
        isSleeping: true,
        state: 'sleeping',
        lastInteraction: currentTime,
        sleepStartedAt: currentTime, // Set sleep start time
        lastSleepUpdate: currentTime, // ✅ Initialize last_sleep_update when starting sleep
      };

      await updateState(updatedBlobbi);
      queryClient.invalidateQueries({ queryKey: ['blobbi-state'] });
      lastRecoveryRef.current = Date.now(); // Reset recovery timer
    } catch (error) {
      console.error('Failed to put Blobbi to sleep:', error);
      setOptimisticSleepState?.(false);
      throw error;
    }
  }, [blobbi, isOwner, updateState, queryClient, publishEvent, setOptimisticSleepState]);

  // Wake up Blobbi
  const wakeUp = useCallback(async () => {
    if (!blobbi || !isOwner || !blobbi.isSleeping) return;

    console.log('Waking up Blobbi...');
    setOptimisticSleepState?.(false);
    
    // Reset recovery tracking when manually waking up
    processedBlobbiRef.current = null;
    lastPassiveRecoveryRef.current = 0;
    
    try {
      const statChange: [string, string] = blobbi.stats.energy >= 50 ? ['happiness', '+5'] : ['happiness', '-5'];

      // ✅ FIXED: Emit only the necessary events to prevent bombardment
      
      // 1. First, emit the "wake" interaction event (kind 14919) with special tag to prevent auto-state-generation
      const interactionEventData = createBlobbiInteractionEvent(blobbi.id, {
        action: 'wake',
        actionCategory: 'recovery',
        statChange,
        experienceGained: 2,
        carePoints: 1,
        timeOfDay: getTimeOfDay(),
      });

      // Add special tag to prevent automatic state generation by enhanced publish hook
      interactionEventData.tags.push(['no_auto_state', 'true']);

      await publishEvent(interactionEventData);

      // 2. Then, update the state to awake (kind 31124)
      const currentTime = Math.floor(Date.now() / 1000);
      const updatedBlobbi: Blobbi = {
        ...blobbi,
        isSleeping: false,
        state: 'active',
        lastInteraction: currentTime,
        sleepStartedAt: undefined, // Clear sleep start time
        lastSleepUpdate: undefined, // Clear last sleep update
        stats: {
          ...blobbi.stats,
          happiness: Math.max(0, Math.min(100, blobbi.stats.happiness + (blobbi.stats.energy >= 50 ? 5 : -5))),
        },
        experience: blobbi.experience + 2,
        careStreak: blobbi.careStreak + 1,
      };

      await updateState(updatedBlobbi);
      queryClient.invalidateQueries({ queryKey: ['blobbi-state'] });
    } catch (error) {
      console.error('Failed to wake up Blobbi:', error);
      setOptimisticSleepState?.(true);
      throw error;
    }
  }, [blobbi, isOwner, publishEvent, queryClient, updateState, setOptimisticSleepState]);

  // Set up active recovery interval when Blobbi is sleeping
  useEffect(() => {
    if (blobbi?.isSleeping && isOwner) {
      // Check every minute for active recovery
      intervalRef.current = setInterval(performActiveRecovery, 60 * 1000);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      // Clear interval if not sleeping
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [blobbi?.isSleeping, isOwner, performActiveRecovery]);

  // Migrate existing sleeping Blobbis to have sleepStartedAt
  const migrateSleepingBlobbi = useCallback(async (blobbi: Blobbi) => {
    if (blobbi.isSleeping && !blobbi.sleepStartedAt && isOwner) {
      console.log('Migrating sleeping Blobbi to include sleepStartedAt...');
      
      const updatedBlobbi: Blobbi = {
        ...blobbi,
        sleepStartedAt: blobbi.lastInteraction, // Use lastInteraction as sleep start time
      };

      try {
        await updateState(updatedBlobbi);
        queryClient.invalidateQueries({ queryKey: ['blobbi-state'] });
      } catch (error) {
        console.error('Failed to migrate sleeping Blobbi:', error);
      }
    }
  }, [isOwner, updateState, queryClient]);

  // Apply passive recovery when blobbi changes (app reopened, etc.)
  useEffect(() => {
    if (blobbi && blobbi.isSleeping && isOwner) {
      // Create a unique identifier for this Blobbi sleep session
      const currentRecoveryKey = `${blobbi.id}-${blobbi.sleepStartedAt || blobbi.lastInteraction}`;
      
      // Only process if this is a new sleep session or we haven't processed this one yet
      if (processedBlobbiRef.current !== currentRecoveryKey) {
        // First migrate if needed
        if (!blobbi.sleepStartedAt) {
          migrateSleepingBlobbi(blobbi);
        } else {
          applyPassiveRecovery(blobbi);
        }
      }
    }
    
    // Reset tracking when Blobbi is no longer sleeping
    if (blobbi && !blobbi.isSleeping) {
      processedBlobbiRef.current = null;
      lastPassiveRecoveryRef.current = 0;
    }
  }, [blobbi?.id, blobbi?.isSleeping, blobbi?.sleepStartedAt, isOwner]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: Functions are intentionally excluded from deps to prevent infinite re-triggering of passive recovery

  // Cleanup on unmount or when Blobbi changes
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Reset tracking when component unmounts or Blobbi changes
      processedBlobbiRef.current = null;
      lastPassiveRecoveryRef.current = 0;
    };
  }, [blobbi?.id]); // Reset when Blobbi ID changes

  return {
    isSleeping: blobbi?.isSleeping || false,
    canSleep: blobbi && !blobbi.isSleeping && isOwner,
    canWakeUp: blobbi?.isSleeping && isOwner,
    putToSleep,
    wakeUp,
    sleepStartTime: blobbi ? getSleepStartTime(blobbi) : null,
    calculatePassiveRecovery: blobbi ? () => calculatePassiveRecovery(blobbi).totalRecovery : () => 0,
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