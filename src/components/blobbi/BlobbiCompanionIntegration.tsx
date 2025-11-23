/**
 * BLOBBI COMPANION INTEGRATION - Refactored to prevent infinite loops
 *
 * CRITICAL FIXES:
 * - Action fuses prevent concurrent interactions
 * - Idempotency guards prevent duplicate events
 * - Stable event handlers prevent re-registration loops
 * - No dependency on performAction/putToSleep/wakeUp in effects
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { BlobbiFeedModal } from './BlobbiFeedModal';
import { BlobbiShop } from './BlobbiShop';
import { BlobbiItem } from '@/types/blobbi';
import { useBlobbiWithFakeStatus } from '@/hooks/useBlobbiWithFakeStatus';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCurrentCompanion } from '@/hooks/useCurrentCompanion';
import { useBlobbonautProfileWithFakeInventory } from '@/hooks/useBlobbonautProfileWithFakeInventory';
import { useToast } from '@/hooks/useToast';
import { getBlobbiMood } from '@/lib/blobbi';
import { useAudio } from '@/contexts/AudioContext';
import { useBlobbiSleepSystem } from '@/hooks/useBlobbiSleepSystem';
import { useBlobbiFakeStatus } from '@/contexts/BlobbiFakeStatusContext';

export function BlobbiCompanionIntegration() {
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [shopActiveTab, setShopActiveTab] = useState<string>('food');
  const [selectedFood, setSelectedFood] = useState<BlobbiItem | null>(null);
  const [isPlacingFood, setIsPlacingFood] = useState(false);

  // CRITICAL: Action fuse to prevent concurrent interactions
  const actionInProgressRef = useRef(false);
  const lastActionIdRef = useRef<string | null>(null);
  const lastSleepStateRef = useRef<boolean | null>(null);

  // Monitoring state refs
  const hungerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHungerLevelRef = useRef<number | null>(null);
  const originalTitleRef = useRef<string | null>(null);
  const titleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialCheckRef = useRef<boolean>(false);

  const healthIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHealthLevelRef = useRef<number | null>(null);
  const healthTitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialHealthCheckRef = useRef<boolean>(false);

  const energyIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastEnergyLevelRef = useRef<number | null>(null);
  const energyTitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialEnergyCheckRef = useRef<boolean>(false);

  const hygieneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHygieneLevelRef = useRef<number | null>(null);
  const hygieneTitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialHygieneCheckRef = useRef<boolean>(false);

  const happinessIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHappinessLevelRef = useRef<number | null>(null);
  const happinessTitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialHappinessCheckRef = useRef<boolean>(false);

  const { user } = useCurrentUser();
  const { data: companionData } = useCurrentCompanion();

  const { blobbi, performAction } = useBlobbiWithFakeStatus(
    companionData?.blobbi?.ownerPubkey,
    companionData?.blobbiId
  );

  const { toast } = useToast();
  const { playSound } = useAudio();
  const { removeFromStorage } = useBlobbonautProfileWithFakeInventory();
  const { getFakeStatus, updateFakeStatus } = useBlobbiFakeStatus();

  const { putToSleep, wakeUp, isSleeping } = useBlobbiSleepSystem({
    blobbi,
    isOwner: !!user && blobbi?.ownerPubkey === user.pubkey,
    onOptimisticUpdate: (updatedBlobbi) => {
      if (blobbi?.id) {
        updateFakeStatus(blobbi.id, updatedBlobbi);
      }
    },
  });

  // CRITICAL: Create stable refs for action functions
  const performActionRef = useRef(performAction);
  const putToSleepRef = useRef(putToSleep);
  const wakeUpRef = useRef(wakeUp);
  const removeFromStorageRef = useRef(removeFromStorage);

  // Update refs when functions change
  useEffect(() => {
    performActionRef.current = performAction;
    putToSleepRef.current = putToSleep;
    wakeUpRef.current = wakeUp;
    removeFromStorageRef.current = removeFromStorage;
  }, [performAction, putToSleep, wakeUp, removeFromStorage]);

  /**
   * CRITICAL: Action guard to prevent duplicate interactions
   */
  const withActionGuard = useCallback(async <T,>(
    actionId: string,
    actionFn: () => Promise<T>
  ): Promise<T | null> => {
    // Check if action is already in progress
    if (actionInProgressRef.current) {
      console.log('[ACTION GUARD] Action already in progress, blocking:', actionId);
      return null;
    }

    // Check if this is a duplicate action
    if (lastActionIdRef.current === actionId) {
      console.log('[ACTION GUARD] Duplicate action blocked:', actionId);
      return null;
    }

    console.log('[ACTION GUARD] Allowing action:', actionId);

    // Set fuse
    actionInProgressRef.current = true;
    lastActionIdRef.current = actionId;

    try {
      const result = await actionFn();
      return result;
    } finally {
      // Release fuse after a delay to prevent rapid re-triggering
      setTimeout(() => {
        actionInProgressRef.current = false;
      }, 1000);
    }
  }, []);

  /**
   * CRITICAL: Sleep state guard to prevent duplicate sleep/wake actions
   */
  const withSleepGuard = useCallback(async (
    targetState: boolean,
    actionFn: () => Promise<void>
  ): Promise<void> => {
    const currentSleepState = blobbi?.isSleeping ?? false;

    // Check if already in target state
    if (currentSleepState === targetState) {
      console.log('[SLEEP GUARD] Already in target state, blocking:', targetState ? 'sleep' : 'wake');
      return;
    }

    // Check if last known state matches target (prevents duplicate transitions)
    if (lastSleepStateRef.current === targetState) {
      console.log('[SLEEP GUARD] Duplicate sleep transition blocked:', targetState ? 'sleep' : 'wake');
      return;
    }

    console.log('[SLEEP GUARD] Allowing sleep transition:', targetState ? 'sleep' : 'wake');

    // Update last known state
    lastSleepStateRef.current = targetState;

    await actionFn();
  }, [blobbi?.isSleeping]);

  // Set up global event listeners for companion interactions
  // CRITICAL: Use refs in handlers to prevent re-registration
  useEffect(() => {
    // Function to handle feed button click from companion
    const handleFeedClick = () => {
      console.log('[COMPANION EVENT] Feed click');
      setIsFeedModalOpen(true);
    };

    // Function to handle food placement
    const handleFoodPlacement = async (event: CustomEvent) => {
      console.log('[COMPANION EVENT] Food placement');

      if (!selectedFood || !blobbi || !user || !companionData) {
        console.log('[COMPANION EVENT] Food placement blocked - missing data');
        return;
      }

      if (companionData.blobbiId !== blobbi.id) {
        console.log('[COMPANION EVENT] Food placement blocked - companion mismatch');
        toast({
          title: "Error",
          description: "Cannot feed - companion mismatch. Please refresh the page.",
          variant: "destructive",
        });
        return;
      }

      const { x, y } = event.detail;

      try {
        createFoodElement(selectedFood, x, y);
        setIsPlacingFood(true);

        toast({
          title: "Food Placed!",
          description: `${selectedFood.name} placed on screen. Your Blobbi will walk to it!`,
        });
      } catch (error) {
        console.error('[COMPANION EVENT] Failed to place food:', error);
        toast({
          title: "Failed to place food",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    };

    // Function to handle when Blobbi reaches food
    const handleFoodReached = async (event: CustomEvent) => {
      console.log('[COMPANION EVENT] Food reached');

      if (!blobbi || !user || !isPlacingFood || !companionData) {
        console.log('[COMPANION EVENT] Food reached blocked - missing data');
        return;
      }

      if (companionData.blobbiId !== blobbi.id) {
        console.log('[COMPANION EVENT] Food reached blocked - companion mismatch');
        toast({
          title: "Error",
          description: "Cannot feed - companion mismatch. Please refresh the page.",
          variant: "destructive",
        });
        return;
      }

      const { food } = event.detail;
      if (!food) {
        console.error('[COMPANION EVENT] No food data in event');
        return;
      }

      // CRITICAL: Use action guard to prevent duplicate feeding
      await withActionGuard(`feed-${food.id}-${Date.now()}`, async () => {
        try {
          playSound('eating');

          // Remove from storage
          await removeFromStorageRef.current({
            itemId: food.id,
            quantity: 1,
          });

          // Perform feed action
          await performActionRef.current('feed', food.effect);

          toast({
            title: "Blobbi Fed!",
            description: `Your Blobbi enjoyed the ${food.name}!`,
          });

          setIsPlacingFood(false);
          setSelectedFood(null);
        } catch (error) {
          console.error('[COMPANION EVENT] Failed to feed Blobbi:', error);
          toast({
            title: "Failed to feed Blobbi",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          });
          setIsPlacingFood(false);
          setSelectedFood(null);
        }
      });
    };

    // Function to handle wake-up request from floating menu
    const handleWakeUpRequest = async () => {
      console.log('[COMPANION EVENT] Wake up request');

      if (!blobbi || !user || !companionData || !isSleeping) {
        console.log('[COMPANION EVENT] Wake up blocked - missing data or not sleeping');
        return;
      }

      if (companionData.blobbiId !== blobbi.id) {
        console.log('[COMPANION EVENT] Wake up blocked - companion mismatch');
        toast({
          title: "Error",
          description: "Cannot wake up - companion mismatch. Please refresh the page.",
          variant: "destructive",
        });
        return;
      }

      // CRITICAL: Use sleep guard to prevent duplicate wake actions
      await withSleepGuard(false, async () => {
        try {
          await wakeUpRef.current();

          toast({
            title: "Blobbi Woke Up",
            description: "Your Blobbi is refreshed and ready to play!",
          });
        } catch (error) {
          console.error('[COMPANION EVENT] Failed to wake up Blobbi:', error);
          toast({
            title: "Wake Up Failed",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          });
        }
      });
    };

    // Function to handle sleep state changes from companion
    const handleSleepChange = async (event: CustomEvent) => {
      console.log('[COMPANION EVENT] Sleep change request');

      if (!blobbi || !user || !companionData) {
        console.log('[COMPANION EVENT] Sleep change blocked - missing data');
        return;
      }

      if (companionData.blobbiId !== blobbi.id) {
        console.log('[COMPANION EVENT] Sleep change blocked - companion mismatch');
        toast({
          title: "Error",
          description: "Cannot change sleep state - companion mismatch. Please refresh the page.",
          variant: "destructive",
        });
        return;
      }

      const { shouldSleep } = event.detail;

      // CRITICAL: Use sleep guard to prevent duplicate sleep/wake actions
      await withSleepGuard(shouldSleep, async () => {
        try {
          if (shouldSleep) {
            await putToSleepRef.current();
            toast({
              title: "Blobbi is Sleeping",
              description: "Your Blobbi has settled down on the bed for a nap!",
            });
          } else {
            await wakeUpRef.current();
            toast({
              title: "Blobbi Woke Up",
              description: "Your Blobbi is refreshed and ready to play!",
            });
          }
        } catch (error) {
          console.error('[COMPANION EVENT] Failed to change sleep state:', error);
          toast({
            title: "Sleep Action Failed",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          });
        }
      });
    };

    // Add global event listeners
    window.addEventListener('companion-feed-click', handleFeedClick);
    window.addEventListener('companion-food-placement', handleFoodPlacement as EventListener);
    window.addEventListener('companion-food-reached', handleFoodReached as EventListener);
    window.addEventListener('companion-sleep-change', handleSleepChange as EventListener);
    window.addEventListener('companion-wake-up-request', handleWakeUpRequest);

    // Expose functions to global scope for companion script
    (window as unknown as { openFeedModal: () => void }).openFeedModal = handleFeedClick;

    console.log('[COMPANION] Event listeners registered');

    return () => {
      window.removeEventListener('companion-feed-click', handleFeedClick);
      window.removeEventListener('companion-food-placement', handleFoodPlacement as EventListener);
      window.removeEventListener('companion-food-reached', handleFoodReached as EventListener);
      window.removeEventListener('companion-sleep-change', handleSleepChange as EventListener);
      window.removeEventListener('companion-wake-up-request', handleWakeUpRequest);
      delete (window as unknown as { openFeedModal?: () => void }).openFeedModal;

      console.log('[COMPANION] Event listeners removed');
    };
  }, [
    // CRITICAL: Only depend on stable values, NOT on action functions
    selectedFood,
    blobbi?.id,
    blobbi?.isSleeping,
    user?.pubkey,
    isPlacingFood,
    companionData?.blobbiId,
    toast,
    playSound,
    withActionGuard,
    withSleepGuard,
  ]);

  // Notify companion when sleep state changes from React side
  // CRITICAL: Add guard to prevent duplicate notifications
  useEffect(() => {
    if (!blobbi) return;

    const currentSleepState = blobbi.isSleeping;

    // Guard: Only notify if sleep state actually changed
    if (lastSleepStateRef.current === (currentSleepState ?? false)) {
      console.log('[COMPANION] Sleep state unchanged, skipping notification');
      return;
    }

    console.log('[COMPANION] Sleep state changed:', currentSleepState);
    lastSleepStateRef.current = currentSleepState ?? false;

    const notifyCompanion = () => {
      window.dispatchEvent(new CustomEvent('react-sleep-state-change', {
        detail: { isSleeping: currentSleepState }
      }));
      console.log('[COMPANION] Notified companion of sleep state:', currentSleepState);
    };

    // Check if companion is available
    if (window.blobbiCompanion) {
      notifyCompanion();
    } else {
      // Wait for companion to initialize
      let retryCount = 0;
      const maxRetries = 10;
      const retryInterval = 300;

      const retryNotify = () => {
        if (window.blobbiCompanion) {
          notifyCompanion();
        } else if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(retryNotify, retryInterval);
        } else {
          console.warn('[COMPANION] Failed to initialize after maximum retries');
        }
      };

      setTimeout(retryNotify, retryInterval);
    }
  }, [blobbi?.isSleeping, blobbi?.id]); // Only depend on sleep state and ID

  // Mood sound effect
  useEffect(() => {
    if (blobbi) {
      const mood = getBlobbiMood(blobbi.stats, blobbi.state);
      if (mood === 'sad') {
        playSound('angry');
      }
    }
  }, [blobbi?.stats.happiness, blobbi?.stats.health, blobbi?.state, playSound]);

  // Hunger monitoring system
  useEffect(() => {
    if (hungerIntervalRef.current) {
      clearInterval(hungerIntervalRef.current);
      hungerIntervalRef.current = null;
    }

    if (!blobbi || !companionData || companionData.blobbiId !== blobbi.id) {
      lastHungerLevelRef.current = null;
      hasInitialCheckRef.current = false;
      restoreOriginalTitle();
      return;
    }

    const currentHunger = blobbi.stats.hunger;
    lastHungerLevelRef.current = currentHunger;
    hasInitialCheckRef.current = true;

    if (currentHunger < 30) {
      playStomachRumbleSound();
      showHungerNotification();

      hungerIntervalRef.current = setInterval(() => {
        if (blobbi && companionData && companionData.blobbiId === blobbi.id && blobbi.stats.hunger < 30) {
          playStomachRumbleSound();
          showHungerNotification();
        } else {
          if (hungerIntervalRef.current) {
            clearInterval(hungerIntervalRef.current);
            hungerIntervalRef.current = null;
          }
        }
      }, 20000);
    } else {
      restoreOriginalTitle();
    }

    return () => {
      if (hungerIntervalRef.current) {
        clearInterval(hungerIntervalRef.current);
        hungerIntervalRef.current = null;
      }
    };
  }, [blobbi?.stats.hunger, blobbi?.id, companionData?.blobbiId]);

  // Health monitoring system
  useEffect(() => {
    if (healthIntervalRef.current) {
      clearInterval(healthIntervalRef.current);
      healthIntervalRef.current = null;
    }

    if (!blobbi || !companionData || companionData.blobbiId !== blobbi.id) {
      lastHealthLevelRef.current = null;
      hasInitialHealthCheckRef.current = false;
      restoreHealthTitle();
      return;
    }

    const currentHealth = blobbi.stats.health;
    lastHealthLevelRef.current = currentHealth;
    hasInitialHealthCheckRef.current = true;

    let shouldAlert = false;
    let alertInterval = 0;
    let alertMessage = '';

    if (currentHealth < 30) {
      shouldAlert = true;
      alertInterval = 20000;
      alertMessage = 'Blobbi needs urgent medical attention!';
    } else if (currentHealth < 60) {
      shouldAlert = true;
      alertInterval = 60000;
      alertMessage = 'Blobbi is feeling unwell!';
    }

    if (shouldAlert) {
      playSickSound();
      showHealthNotification(alertMessage);

      healthIntervalRef.current = setInterval(() => {
        if (blobbi && companionData && companionData.blobbiId === blobbi.id) {
          const currentHealthInInterval = blobbi.stats.health;

          if (currentHealthInInterval < 30) {
            playSickSound();
            showHealthNotification('Blobbi needs urgent medical attention!');
          } else if (currentHealthInInterval < 60) {
            playSickSound();
            showHealthNotification('Blobbi is feeling unwell!');
          } else {
            if (healthIntervalRef.current) {
              clearInterval(healthIntervalRef.current);
              healthIntervalRef.current = null;
            }
            restoreHealthTitle();
          }
        } else {
          if (healthIntervalRef.current) {
            clearInterval(healthIntervalRef.current);
            healthIntervalRef.current = null;
          }
        }
      }, alertInterval);
    } else {
      restoreHealthTitle();
    }

    return () => {
      if (healthIntervalRef.current) {
        clearInterval(healthIntervalRef.current);
        healthIntervalRef.current = null;
      }
    };
  }, [blobbi?.stats.health, blobbi?.id, companionData?.blobbiId, toast]);

  // Energy monitoring system
  useEffect(() => {
    if (energyIntervalRef.current) {
      clearInterval(energyIntervalRef.current);
      energyIntervalRef.current = null;
    }

    if (!blobbi || !companionData || companionData.blobbiId !== blobbi.id) {
      lastEnergyLevelRef.current = null;
      hasInitialEnergyCheckRef.current = false;
      restoreEnergyTitle();
      return;
    }

    const currentEnergy = blobbi.stats.energy;
    const isAwake = !blobbi.isSleeping;
    lastEnergyLevelRef.current = currentEnergy;
    hasInitialEnergyCheckRef.current = true;

    let shouldAlert = false;
    let alertInterval = 0;
    let alertMessage = '';

    if (isAwake && currentEnergy < 30) {
      shouldAlert = true;
      alertInterval = 20000;
      alertMessage = 'Blobbi is exhausted!';
    } else if (isAwake && currentEnergy < 60) {
      shouldAlert = true;
      alertInterval = 60000;
      alertMessage = 'Blobbi is getting tired!';
    }

    if (shouldAlert) {
      playTiredSound();
      showEnergyNotification(alertMessage);

      energyIntervalRef.current = setInterval(() => {
        if (blobbi && companionData && companionData.blobbiId === blobbi.id) {
          const currentEnergyInInterval = blobbi.stats.energy;
          const isAwakeInInterval = !blobbi.isSleeping;

          if (isAwakeInInterval) {
            if (currentEnergyInInterval < 30) {
              playTiredSound();
              showEnergyNotification('Blobbi is exhausted!');
            } else if (currentEnergyInInterval < 60) {
              playTiredSound();
              showEnergyNotification('Blobbi is getting tired!');
            } else {
              if (energyIntervalRef.current) {
                clearInterval(energyIntervalRef.current);
                energyIntervalRef.current = null;
              }
              restoreEnergyTitle();
            }
          } else {
            if (energyIntervalRef.current) {
              clearInterval(energyIntervalRef.current);
              energyIntervalRef.current = null;
            }
            restoreEnergyTitle();
          }
        } else {
          if (energyIntervalRef.current) {
            clearInterval(energyIntervalRef.current);
            energyIntervalRef.current = null;
          }
        }
      }, alertInterval);
    } else {
      restoreEnergyTitle();
    }

    return () => {
      if (energyIntervalRef.current) {
        clearInterval(energyIntervalRef.current);
        energyIntervalRef.current = null;
      }
    };
  }, [blobbi?.stats.energy, blobbi?.isSleeping, blobbi?.id, companionData?.blobbiId]);

  // Hygiene monitoring system
  useEffect(() => {
    if (hygieneIntervalRef.current) {
      clearInterval(hygieneIntervalRef.current);
      hygieneIntervalRef.current = null;
    }

    if (!blobbi || !companionData || companionData.blobbiId !== blobbi.id) {
      lastHygieneLevelRef.current = null;
      hasInitialHygieneCheckRef.current = false;
      restoreHygieneTitle();
      return;
    }

    const currentHygiene = blobbi.stats.hygiene;
    lastHygieneLevelRef.current = currentHygiene;
    hasInitialHygieneCheckRef.current = true;

    let shouldAlert = false;
    let alertInterval = 0;
    let alertMessage = '';

    if (currentHygiene < 30) {
      shouldAlert = true;
      alertInterval = 20000;
      alertMessage = 'Blobbi is very dirty!';
    } else if (currentHygiene < 60) {
      shouldAlert = true;
      alertInterval = 60000;
      alertMessage = 'Blobbi needs cleaning!';
    }

    if (shouldAlert) {
      playYuckSound();
      showHygieneNotification(alertMessage);

      hygieneIntervalRef.current = setInterval(() => {
        if (blobbi && companionData && companionData.blobbiId === blobbi.id) {
          const currentHygieneInInterval = blobbi.stats.hygiene;

          if (currentHygieneInInterval < 30) {
            playYuckSound();
            showHygieneNotification('Blobbi is very dirty!');
          } else if (currentHygieneInInterval < 60) {
            playYuckSound();
            showHygieneNotification('Blobbi needs cleaning!');
          } else {
            if (hygieneIntervalRef.current) {
              clearInterval(hygieneIntervalRef.current);
              hygieneIntervalRef.current = null;
            }
            restoreHygieneTitle();
          }
        } else {
          if (hygieneIntervalRef.current) {
            clearInterval(hygieneIntervalRef.current);
            hygieneIntervalRef.current = null;
          }
        }
      }, alertInterval);
    } else {
      restoreHygieneTitle();
    }

    return () => {
      if (hygieneIntervalRef.current) {
        clearInterval(hygieneIntervalRef.current);
        hygieneIntervalRef.current = null;
      }
    };
  }, [blobbi?.stats.hygiene, blobbi?.id, companionData?.blobbiId]);

  // Happiness monitoring system
  useEffect(() => {
    if (happinessIntervalRef.current) {
      clearInterval(happinessIntervalRef.current);
      happinessIntervalRef.current = null;
    }

    if (!blobbi || !companionData || companionData.blobbiId !== blobbi.id) {
      lastHappinessLevelRef.current = null;
      hasInitialHappinessCheckRef.current = false;
      restoreHappinessTitle();
      return;
    }

    const currentHappiness = blobbi.stats.happiness;
    lastHappinessLevelRef.current = currentHappiness;
    hasInitialHappinessCheckRef.current = true;

    let shouldAlert = false;
    let alertInterval = 0;
    let alertMessage = '';

    if (currentHappiness < 30) {
      shouldAlert = true;
      alertInterval = 20000;
      alertMessage = 'Blobbi is very sad!';
    } else if (currentHappiness < 60) {
      shouldAlert = true;
      alertInterval = 60000;
      alertMessage = 'Blobbi is feeling down!';
    }

    if (shouldAlert) {
      playSadSound();
      showHappinessNotification(alertMessage);

      happinessIntervalRef.current = setInterval(() => {
        if (blobbi && companionData && companionData.blobbiId === blobbi.id) {
          const currentHappinessInInterval = blobbi.stats.happiness;

          if (currentHappinessInInterval < 30) {
            playSadSound();
            showHappinessNotification('Blobbi is very sad!');
          } else if (currentHappinessInInterval < 60) {
            playSadSound();
            showHappinessNotification('Blobbi is feeling down!');
          } else {
            if (happinessIntervalRef.current) {
              clearInterval(happinessIntervalRef.current);
              happinessIntervalRef.current = null;
            }
            restoreHappinessTitle();
          }
        } else {
          if (happinessIntervalRef.current) {
            clearInterval(happinessIntervalRef.current);
            happinessIntervalRef.current = null;
          }
        }
      }, alertInterval);
    } else {
      restoreHappinessTitle();
    }

    return () => {
      if (happinessIntervalRef.current) {
        clearInterval(happinessIntervalRef.current);
        happinessIntervalRef.current = null;
      }
    };
  }, [blobbi?.stats.happiness, blobbi?.id, companionData?.blobbiId]);

  // Cleanup all monitoring on unmount
  useEffect(() => {
    return () => {
      if (hungerIntervalRef.current) clearInterval(hungerIntervalRef.current);
      if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);
      if (energyIntervalRef.current) clearInterval(energyIntervalRef.current);
      if (hygieneIntervalRef.current) clearInterval(hygieneIntervalRef.current);
      if (happinessIntervalRef.current) clearInterval(happinessIntervalRef.current);

      restoreOriginalTitle();
      restoreHealthTitle();
      restoreEnergyTitle();
      restoreHygieneTitle();
      restoreHappinessTitle();
    };
  }, []);

  // Helper functions for sound and notifications
  const playStomachRumbleSound = () => {
    try {
      const audio = new Audio('/companion/sounds/stomach-rumble.mp3');
      const volume = localStorage.getItem('blobbi_audio_volume');
      const isMuted = localStorage.getItem('blobbi_audio_muted') === 'true';
      audio.volume = isMuted ? 0 : (volume ? Math.max(0, Math.min(1, parseFloat(volume))) : 0.5);
      audio.play().catch(error => console.error('Error playing stomach rumble sound:', error));
    } catch (error) {
      console.error('Error creating stomach rumble audio:', error);
    }
  };

  const showHungerNotification = () => {
    try {
      if (originalTitleRef.current === null) {
        originalTitleRef.current = document.title;
      }
      if (titleTimeoutRef.current) {
        clearTimeout(titleTimeoutRef.current);
        titleTimeoutRef.current = null;
      }
      document.title = '🍽️ Blobbi is hungry!';
      titleTimeoutRef.current = setTimeout(() => {
        restoreOriginalTitle();
        titleTimeoutRef.current = null;
      }, 8000);
    } catch (error) {
      console.error('Error showing hunger notification:', error);
    }
  };

  const restoreOriginalTitle = () => {
    try {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }
      if (titleTimeoutRef.current) {
        clearTimeout(titleTimeoutRef.current);
        titleTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('Error restoring original title:', error);
    }
  };

  const playSickSound = () => {
    try {
      const audio = new Audio('/companion/sounds/sick.mp3');
      const volume = localStorage.getItem('blobbi_audio_volume');
      const isMuted = localStorage.getItem('blobbi_audio_muted') === 'true';
      audio.volume = isMuted ? 0 : (volume ? Math.max(0, Math.min(1, parseFloat(volume))) : 0.5);
      audio.play().catch(error => console.error('Error playing sick sound:', error));
    } catch (error) {
      console.error('Error creating sick audio:', error);
    }
  };

  const showHealthNotification = (message: string) => {
    try {
      if (originalTitleRef.current === null) {
        originalTitleRef.current = document.title;
      }
      if (healthTitleTimeoutRef.current) {
        clearTimeout(healthTitleTimeoutRef.current);
        healthTitleTimeoutRef.current = null;
      }
      document.title = `🏥 ${message}`;
      healthTitleTimeoutRef.current = setTimeout(() => {
        restoreHealthTitle();
        healthTitleTimeoutRef.current = null;
      }, 8000);
    } catch (error) {
      console.error('Error showing health notification:', error);
    }
  };

  const restoreHealthTitle = () => {
    try {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }
      if (healthTitleTimeoutRef.current) {
        clearTimeout(healthTitleTimeoutRef.current);
        healthTitleTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('Error restoring health title:', error);
    }
  };

  const playTiredSound = () => {
    try {
      const audio = new Audio('/companion/sounds/tired.mp3');
      const volume = localStorage.getItem('blobbi_audio_volume');
      const isMuted = localStorage.getItem('blobbi_audio_muted') === 'true';
      audio.volume = isMuted ? 0 : (volume ? Math.max(0, Math.min(1, parseFloat(volume))) : 0.5);
      audio.play().catch(error => console.error('Error playing tired sound:', error));
    } catch (error) {
      console.error('Error creating tired audio:', error);
    }
  };

  const showEnergyNotification = (message: string) => {
    try {
      if (originalTitleRef.current === null) {
        originalTitleRef.current = document.title;
      }
      if (energyTitleTimeoutRef.current) {
        clearTimeout(energyTitleTimeoutRef.current);
        energyTitleTimeoutRef.current = null;
      }
      document.title = `⚡ ${message}`;
      energyTitleTimeoutRef.current = setTimeout(() => {
        restoreEnergyTitle();
        energyTitleTimeoutRef.current = null;
      }, 8000);
    } catch (error) {
      console.error('Error showing energy notification:', error);
    }
  };

  const restoreEnergyTitle = () => {
    try {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }
      if (energyTitleTimeoutRef.current) {
        clearTimeout(energyTitleTimeoutRef.current);
        energyTitleTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('Error restoring energy title:', error);
    }
  };

  const playYuckSound = () => {
    try {
      const audio = new Audio('/companion/sounds/yuck.mp3');
      const volume = localStorage.getItem('blobbi_audio_volume');
      const isMuted = localStorage.getItem('blobbi_audio_muted') === 'true';
      audio.volume = isMuted ? 0 : (volume ? Math.max(0, Math.min(1, parseFloat(volume))) : 0.5);
      audio.play().catch(error => console.error('Error playing yuck sound:', error));
    } catch (error) {
      console.error('Error creating yuck audio:', error);
    }
  };

  const showHygieneNotification = (message: string) => {
    try {
      if (originalTitleRef.current === null) {
        originalTitleRef.current = document.title;
      }
      if (hygieneTitleTimeoutRef.current) {
        clearTimeout(hygieneTitleTimeoutRef.current);
        hygieneTitleTimeoutRef.current = null;
      }
      document.title = `🧼 ${message}`;
      hygieneTitleTimeoutRef.current = setTimeout(() => {
        restoreHygieneTitle();
        hygieneTitleTimeoutRef.current = null;
      }, 8000);
    } catch (error) {
      console.error('Error showing hygiene notification:', error);
    }
  };

  const restoreHygieneTitle = () => {
    try {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }
      if (hygieneTitleTimeoutRef.current) {
        clearTimeout(hygieneTitleTimeoutRef.current);
        hygieneTitleTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('Error restoring hygiene title:', error);
    }
  };

  const playSadSound = () => {
    try {
      const audio = new Audio('/companion/sounds/sad.mp3');
      const volume = localStorage.getItem('blobbi_audio_volume');
      const isMuted = localStorage.getItem('blobbi_audio_muted') === 'true';
      audio.volume = isMuted ? 0 : (volume ? Math.max(0, Math.min(1, parseFloat(volume))) : 0.5);
      audio.play().catch(error => console.error('Error playing sad sound:', error));
    } catch (error) {
      console.error('Error creating sad audio:', error);
    }
  };

  const showHappinessNotification = (message: string) => {
    try {
      if (originalTitleRef.current === null) {
        originalTitleRef.current = document.title;
      }
      if (happinessTitleTimeoutRef.current) {
        clearTimeout(happinessTitleTimeoutRef.current);
        happinessTitleTimeoutRef.current = null;
      }
      document.title = `😢 ${message}`;
      happinessTitleTimeoutRef.current = setTimeout(() => {
        restoreHappinessTitle();
        happinessTitleTimeoutRef.current = null;
      }, 8000);
    } catch (error) {
      console.error('Error showing happiness notification:', error);
    }
  };

  const restoreHappinessTitle = () => {
    try {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }
      if (happinessTitleTimeoutRef.current) {
        clearTimeout(happinessTitleTimeoutRef.current);
        happinessTitleTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('Error restoring happiness title:', error);
    }
  };

  const createFoodElement = (food: BlobbiItem, x: number, y: number) => {
    const existingFood = document.querySelector('.companion-food');
    if (existingFood) {
      existingFood.remove();
    }

    const foodElement = document.createElement('div');
    foodElement.className = 'companion-food';
    foodElement.style.cssText = `
      position: fixed;
      left: ${x - 15}px;
      top: ${y - 15}px;
      font-size: 30px;
      z-index: 9998;
      pointer-events: none;
      user-select: none;
      animation: foodDrop 0.3s ease-out;
    `;
    foodElement.textContent = food.icon || '🍎';

    const style = document.createElement('style');
    style.textContent = `
      @keyframes foodDrop {
        from {
          transform: translateY(-20px) scale(0.5);
          opacity: 0;
        }
        to {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(foodElement);

    (window as unknown as { currentFood: { element: HTMLElement; data: BlobbiItem } }).currentFood = {
      element: foodElement,
      data: food
    };

    window.dispatchEvent(new CustomEvent('food-placed', {
      detail: {
        element: foodElement,
        food: food,
        x: x,
        y: y
      }
    }));
  };

  const handleFoodSelected = (food: BlobbiItem) => {
    setSelectedFood(food);

    toast({
      title: "Food Ready!",
      description: "Click anywhere on the screen to place the food for your Blobbi.",
    });

    const handleClick = (e: MouseEvent) => {
      if ((e.target as Element).closest('.blobbi-container') ||
          (e.target as Element).closest('[role="dialog"]') ||
          (e.target as Element).closest('button')) {
        return;
      }

      window.dispatchEvent(new CustomEvent('companion-food-placement', {
        detail: { x: e.clientX, y: e.clientY }
      }));

      document.removeEventListener('click', handleClick);
    };

    document.addEventListener('click', handleClick);
  };

  const handleOpenShop = () => {
    setShopActiveTab('food');
    setIsShopModalOpen(true);
  };

  return (
    <>
      <BlobbiFeedModal
        isOpen={isFeedModalOpen}
        onClose={() => setIsFeedModalOpen(false)}
        onOpenShop={handleOpenShop}
        onFoodSelected={handleFoodSelected}
      />

      <BlobbiShop
        isOpen={isShopModalOpen}
        onClose={() => setIsShopModalOpen(false)}
        defaultTab={shopActiveTab}
      />
    </>
  );
}
