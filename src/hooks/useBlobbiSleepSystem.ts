import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Blobbi } from '@/types/blobbi';
import { useBlobbiState } from '@/hooks/useBlobbiEvents';

interface SleepSystemOptions {
  blobbi: Blobbi | null;
  isOwner: boolean;
}

export function useBlobbiSleepSystem({ blobbi, isOwner }: SleepSystemOptions) {
  const queryClient = useQueryClient();
  const { updateState } = useBlobbiState(blobbi?.id || '', blobbi?.ownerPubkey || '');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastRecoveryRef = useRef<number>(Date.now());
  const lastPassiveRecoveryRef = useRef<number>(0);
  const processedBlobbiRef = useRef<string | null>(null);

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
  const calculatePassiveRecovery = useCallback((blobbi: Blobbi): number => {
    const sleepStartTime = getSleepStartTime(blobbi);
    if (!sleepStartTime || !blobbi.isSleeping) return 0;

    const currentTime = Date.now();
    const timeDiff = currentTime - sleepStartTime;
    
    // Handle negative time differences (future sleep start time)
    if (timeDiff < 0) return 0;
    
    const thirtyMinutesMs = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    // Calculate how many 30-minute blocks have passed
    const blocksCompleted = Math.floor(timeDiff / thirtyMinutesMs);
    
    // Each block gives +10 energy, ensure non-negative
    return Math.max(0, blocksCompleted * 10);
  }, [getSleepStartTime]);

  // Apply passive recovery when blobbi is loaded
  const applyPassiveRecovery = useCallback(async (blobbi: Blobbi) => {
    if (!blobbi.isSleeping || !isOwner) return;

    // Create a unique key for this recovery session
    const recoveryKey = `${blobbi.id}-${blobbi.sleepStartedAt || blobbi.lastInteraction}`;
    
    // Prevent duplicate recovery for the same sleep session
    if (processedBlobbiRef.current === recoveryKey) {
      console.log('Passive recovery already processed for this sleep session');
      return;
    }

    const recoveryAmount = calculatePassiveRecovery(blobbi);
    if (recoveryAmount <= 0) return;

    // Check if we've already applied this amount of recovery
    if (recoveryAmount <= lastPassiveRecoveryRef.current) {
      console.log('Recovery amount not greater than last applied, skipping');
      return;
    }

    const newEnergy = Math.min(100, blobbi.stats.energy + recoveryAmount);
    const energyGained = newEnergy - blobbi.stats.energy;

    if (energyGained > 0) {
      console.log(`Passive sleep recovery: +${energyGained} energy (${recoveryAmount} total calculated)`);
      
      // Mark this recovery as processed
      processedBlobbiRef.current = recoveryKey;
      lastPassiveRecoveryRef.current = recoveryAmount;
      
      const updatedBlobbi: Blobbi = {
        ...blobbi,
        stats: {
          ...blobbi.stats,
          energy: newEnergy,
        },
        lastInteraction: Math.floor(Date.now() / 1000), // Update last interaction time
      };

      // Check if energy reached 100 and auto-wake if desired
      if (newEnergy >= 100) {
        updatedBlobbi.isSleeping = false;
        updatedBlobbi.state = 'active';
        console.log('Blobbi automatically woke up - energy reached 100%');
        // Reset recovery tracking when waking up
        processedBlobbiRef.current = null;
        lastPassiveRecoveryRef.current = 0;
      }

      try {
        await updateState(updatedBlobbi);
        queryClient.invalidateQueries({ queryKey: ['blobbi-state'] });
      } catch (error) {
        console.error('Failed to apply passive sleep recovery:', error);
        // Reset tracking on error so it can be retried
        processedBlobbiRef.current = null;
        lastPassiveRecoveryRef.current = 0;
      }
    }
  }, [calculatePassiveRecovery, isOwner, updateState, queryClient]);

  // Active recovery (while app is open)
  const performActiveRecovery = useCallback(async () => {
    if (!blobbi || !blobbi.isSleeping || !isOwner) return;

    const currentTime = Date.now();
    const timeSinceLastRecovery = currentTime - lastRecoveryRef.current;
    const thirtyMinutesMs = 30 * 60 * 1000; // 30 minutes in milliseconds

    // Only recover if 30 minutes have passed
    if (timeSinceLastRecovery >= thirtyMinutesMs) {
      const newEnergy = Math.min(100, blobbi.stats.energy + 10);
      const energyGained = newEnergy - blobbi.stats.energy;

      if (energyGained > 0) {
        console.log(`Active sleep recovery: +${energyGained} energy`);
        
        const updatedBlobbi: Blobbi = {
          ...blobbi,
          stats: {
            ...blobbi.stats,
            energy: newEnergy,
          },
          lastInteraction: Math.floor(Date.now() / 1000),
        };

        // Check if energy reached 100 and auto-wake if desired
        if (newEnergy >= 100) {
          updatedBlobbi.isSleeping = false;
          updatedBlobbi.state = 'active';
          console.log('Blobbi automatically woke up - energy reached 100%');
          // Reset recovery tracking when auto-waking
          processedBlobbiRef.current = null;
          lastPassiveRecoveryRef.current = 0;
        }

        try {
          await updateState(updatedBlobbi);
          queryClient.invalidateQueries({ queryKey: ['blobbi-state'] });
          lastRecoveryRef.current = currentTime;
        } catch (error) {
          console.error('Failed to apply active sleep recovery:', error);
        }
      }
    }
  }, [blobbi, isOwner, updateState, queryClient]);

  // Put Blobbi to sleep
  const putToSleep = useCallback(async () => {
    if (!blobbi || !isOwner || blobbi.isSleeping) return;

    console.log('Putting Blobbi to sleep...');
    
    // Reset recovery tracking when starting new sleep session
    processedBlobbiRef.current = null;
    lastPassiveRecoveryRef.current = 0;
    
    const currentTime = Math.floor(Date.now() / 1000);
    const updatedBlobbi: Blobbi = {
      ...blobbi,
      isSleeping: true,
      state: 'sleeping',
      lastInteraction: currentTime,
      sleepStartedAt: currentTime, // Set sleep start time
    };

    try {
      await updateState(updatedBlobbi);
      queryClient.invalidateQueries({ queryKey: ['blobbi-state'] });
      lastRecoveryRef.current = Date.now(); // Reset recovery timer
    } catch (error) {
      console.error('Failed to put Blobbi to sleep:', error);
      throw error;
    }
  }, [blobbi, isOwner, updateState, queryClient]);

  // Wake up Blobbi
  const wakeUp = useCallback(async () => {
    if (!blobbi || !isOwner || !blobbi.isSleeping) return;

    console.log('Waking up Blobbi...');
    
    // Reset recovery tracking when manually waking up
    processedBlobbiRef.current = null;
    lastPassiveRecoveryRef.current = 0;
    
    const updatedBlobbi: Blobbi = {
      ...blobbi,
      isSleeping: false,
      state: 'active',
      lastInteraction: Math.floor(Date.now() / 1000),
      sleepStartedAt: undefined, // Clear sleep start time
    };

    try {
      await updateState(updatedBlobbi);
      queryClient.invalidateQueries({ queryKey: ['blobbi-state'] });
    } catch (error) {
      console.error('Failed to wake up Blobbi:', error);
      throw error;
    }
  }, [blobbi, isOwner, updateState, queryClient]);

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
    calculatePassiveRecovery: blobbi ? () => calculatePassiveRecovery(blobbi) : () => 0,
  };
}