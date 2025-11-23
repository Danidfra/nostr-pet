import { useState, useEffect, useRef } from 'react';
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

export function BlobbiCompanionIntegration() {
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [shopActiveTab, setShopActiveTab] = useState<string>('food');
  const [selectedFood, setSelectedFood] = useState<BlobbiItem | null>(null);
  const [isPlacingFood, setIsPlacingFood] = useState(false);

  // Hunger monitoring state
  const hungerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHungerLevelRef = useRef<number | null>(null);
  const originalTitleRef = useRef<string | null>(null);
  const titleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialCheckRef = useRef<boolean>(false);

  // Health monitoring state
  const healthIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHealthLevelRef = useRef<number | null>(null);
  const healthTitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialHealthCheckRef = useRef<boolean>(false);

  // Energy monitoring state
  const energyIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastEnergyLevelRef = useRef<number | null>(null);
  const energyTitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialEnergyCheckRef = useRef<boolean>(false);

  // Hygiene monitoring state
  const hygieneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHygieneLevelRef = useRef<number | null>(null);
  const hygieneTitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialHygieneCheckRef = useRef<boolean>(false);

  // Happiness monitoring state
  const happinessIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHappinessLevelRef = useRef<number | null>(null);
  const happinessTitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialHappinessCheckRef = useRef<boolean>(false);

  const { user } = useCurrentUser();
  const { data: companionData } = useCurrentCompanion();

  // ✅ FIXED: Use the current companion's Blobbi ID instead of falling back to user's first Blobbi
  const { blobbi, performAction } = useBlobbiWithFakeStatus(
    companionData?.blobbi?.ownerPubkey,
    companionData?.blobbiId
  );

  const { toast } = useToast();
  const { playSound } = useAudio();
  const { removeFromStorage } = useBlobbonautProfileWithFakeInventory();
  const { putToSleep, wakeUp, isSleeping } = useBlobbiSleepSystem({
    blobbi,
    isOwner: !!user && blobbi?.ownerPubkey === user.pubkey,
  });

  // Set up global event listeners for companion interactions
  useEffect(() => {
    // Function to handle feed button click from companion
    const handleFeedClick = () => {
      setIsFeedModalOpen(true);
    };

    // Function to handle food placement
    const handleFoodPlacement = async (event: CustomEvent) => {

      if (!selectedFood || !blobbi || !user || !companionData) {

        return;
      }

      // ✅ FIXED: Ensure we're interacting with the current companion
      if (companionData.blobbiId !== blobbi.id) {

        toast({
          title: "Error",
          description: "Cannot feed - companion mismatch. Please refresh the page.",
          variant: "destructive",
        });
        return;
      }

      const { x, y } = event.detail;

      try {
        // Create food element on screen
        createFoodElement(selectedFood, x, y);

        // Set placing food state
        setIsPlacingFood(true);

        // Store the food data for later use (don't clear selectedFood yet)
        // We'll clear it when Blobbi reaches the food

        toast({
          title: "Food Placed!",
          description: `${selectedFood.name} placed on screen. Your Blobbi will walk to it!`,
        });
      } catch (error) {
        console.error('Failed to place food:', error);
        toast({
          title: "Failed to place food",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    };

    // Function to handle when Blobbi reaches food
    const handleFoodReached = async (event: CustomEvent) => {

      if (!blobbi || !user || !isPlacingFood || !companionData) {

        return;
      }

      // ✅ FIXED: Ensure we're interacting with the current companion
      if (companionData.blobbiId !== blobbi.id) {

        toast({
          title: "Error",
          description: "Cannot feed - companion mismatch. Please refresh the page.",
          variant: "destructive",
        });
        return;
      }

      // Get food data from the event (passed by companion script)
      const { food } = event.detail;
      if (!food) {
        console.error('❌ React: No food data in companion-food-reached event');
        return;
      }

      try {
        // Play sound first
        playSound('eating');

        // First, remove the food item from storage (emit kind 31125)

        await removeFromStorage({
          itemId: food.id,
          quantity: 1,
        });

        // Then, perform the feed action with the food's effects (emit kind 31124)

        await performAction('feed', food.effect);

        toast({
          title: "Blobbi Fed!",
          description: `Your Blobbi enjoyed the ${food.name}!`,
        });

        // Clear placing food state and selected food
        setIsPlacingFood(false);
        setSelectedFood(null);
      } catch (error) {
        console.error('❌ React: Failed to feed Blobbi:', error);
        toast({
          title: "Failed to feed Blobbi",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
        setIsPlacingFood(false);
        setSelectedFood(null);
      }
    };

    // Function to handle wake-up request from floating menu
    const handleWakeUpRequest = async () => {

      if (!blobbi || !user || !companionData || !isSleeping) {

        return;
      }

      // ✅ FIXED: Ensure we're interacting with the current companion
      if (companionData.blobbiId !== blobbi.id) {

        toast({
          title: "Error",
          description: "Cannot wake up - companion mismatch. Please refresh the page.",
          variant: "destructive",
        });
        return;
      }

      try {
        // Wake up Blobbi (bed visibility will be handled automatically by BedContext)

        await wakeUp();

        toast({
          title: "Blobbi Woke Up",
          description: "Your Blobbi is refreshed and ready to play!",
        });
      } catch (error) {
        console.error('❌ React: Failed to wake up Blobbi:', error);
        toast({
          title: "Wake Up Failed",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      }
    };

    // Function to handle sleep state changes from companion
    const handleSleepChange = async (event: CustomEvent) => {

      if (!blobbi || !user || !companionData) {

        return;
      }

      // ✅ FIXED: Ensure we're interacting with the current companion
      if (companionData.blobbiId !== blobbi.id) {

        toast({
          title: "Error",
          description: "Cannot change sleep state - companion mismatch. Please refresh the page.",
          variant: "destructive",
        });
        return;
      }

      const { shouldSleep } = event.detail;

      try {
        if (shouldSleep && !isSleeping) {
          // Put Blobbi to sleep (bed will be shown automatically by BedContext)

          await putToSleep();

          toast({
            title: "Blobbi is Sleeping",
            description: "Your Blobbi has settled down on the bed for a nap!",
          });
        } else if (!shouldSleep && isSleeping) {
          // Wake up Blobbi (bed visibility will be handled automatically by BedContext)

          await wakeUp();

          toast({
            title: "Blobbi Woke Up",
            description: "Your Blobbi is refreshed and ready to play!",
          });
        }
      } catch (error) {
        console.error('❌ React: Failed to change sleep state:', error);
        toast({
          title: "Sleep Action Failed",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      }
    };

    // Add global event listeners
    window.addEventListener('companion-feed-click', handleFeedClick);
    window.addEventListener('companion-food-placement', handleFoodPlacement as EventListener);
    window.addEventListener('companion-food-reached', handleFoodReached as EventListener);
    window.addEventListener('companion-sleep-change', handleSleepChange as EventListener);
    window.addEventListener('companion-wake-up-request', handleWakeUpRequest);

    // Expose functions to global scope for companion script
    (window as unknown as { openFeedModal: () => void }).openFeedModal = handleFeedClick;

    return () => {
      window.removeEventListener('companion-feed-click', handleFeedClick);
      window.removeEventListener('companion-food-placement', handleFoodPlacement as EventListener);
      window.removeEventListener('companion-food-reached', handleFoodReached as EventListener);
      window.removeEventListener('companion-sleep-change', handleSleepChange as EventListener);
      window.removeEventListener('companion-wake-up-request', handleWakeUpRequest);
      delete (window as unknown as { openFeedModal?: () => void }).openFeedModal;
    };
  }, [selectedFood, blobbi, user, isPlacingFood, performAction, toast, removeFromStorage, putToSleep, wakeUp, isSleeping, companionData]);

  // Notify companion when sleep state changes from React side
  useEffect(() => {
    if (blobbi) {
      // ✅ FIXED: Add a small delay to ensure companion script is fully initialized
      // This is especially important for the initial load when Blobbi is already sleeping
      const notifyCompanion = () => {
        window.dispatchEvent(new CustomEvent('react-sleep-state-change', {
          detail: { isSleeping: blobbi.isSleeping }
        }));

        // ✅ FIXED: Log for debugging

      };

      // Check if companion is available, if not wait a bit
      if (window.blobbiCompanion) {
        notifyCompanion();
      } else {
        // ✅ ENHANCED: Wait longer and retry multiple times for initial load
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
            console.warn('🔄 React: Companion failed to initialize after maximum retries');
          }
        };

        setTimeout(retryNotify, retryInterval);
      }
    }
  }, [blobbi]);

  useEffect(() => {
    if (blobbi) {
      const mood = getBlobbiMood(blobbi.stats, blobbi.state);
      if (mood === 'sad') {
        playSound('angry');
      }
    }
  }, [blobbi, playSound]);

  // Hunger monitoring system for current companion
  useEffect(() => {
    // Clear any existing interval
    if (hungerIntervalRef.current) {
      clearInterval(hungerIntervalRef.current);
      hungerIntervalRef.current = null;
    }

    // Only monitor hunger if we have a current companion Blobbi
    if (!blobbi || !companionData || companionData.blobbiId !== blobbi.id) {

      lastHungerLevelRef.current = null;
      hasInitialCheckRef.current = false;
      // Restore title when companion is removed or changed
      restoreOriginalTitle();
      return;
    }

    const currentHunger = blobbi.stats.hunger;
    const previousHunger = lastHungerLevelRef.current;
    const isInitialLoad = !hasInitialCheckRef.current;

    // Update the last known hunger level
    lastHungerLevelRef.current = currentHunger;
    hasInitialCheckRef.current = true;

    // Check if hunger is below 30
    if (currentHunger < 30) {

      // Play the first sound immediately (especially important on initial load)
      playStomachRumbleSound();
      showHungerNotification();

      // Set up interval to play sound every 60 seconds
      hungerIntervalRef.current = setInterval(() => {
        // Double-check that hunger is still below 30 and we still have the same companion
        if (blobbi && companionData && companionData.blobbiId === blobbi.id && blobbi.stats.hunger < 30) {

          playStomachRumbleSound();
          showHungerNotification();
        } else {

          if (hungerIntervalRef.current) {
            clearInterval(hungerIntervalRef.current);
            hungerIntervalRef.current = null;
          }
        }
      }, 20000); // 60 seconds = 60,000 milliseconds
    } else {
      // Hunger is 30 or above, make sure no sounds are playing
      if (previousHunger !== null && previousHunger < 30) {

      }
      // Clear any existing title notification when hunger recovers
      restoreOriginalTitle();
    }

    // Cleanup function
    return () => {
      if (hungerIntervalRef.current) {
        clearInterval(hungerIntervalRef.current);
        hungerIntervalRef.current = null;
      }
    };
  }, [blobbi?.stats.hunger, blobbi?.id, companionData?.blobbiId]); // Dependencies: hunger level, blobbi ID, and companion ID

  // Health monitoring system for current companion
  useEffect(() => {
    // Clear any existing interval
    if (healthIntervalRef.current) {
      clearInterval(healthIntervalRef.current);
      healthIntervalRef.current = null;
    }

    // Only monitor health if we have a current companion Blobbi
    if (!blobbi || !companionData || companionData.blobbiId !== blobbi.id) {

      lastHealthLevelRef.current = null;
      hasInitialHealthCheckRef.current = false;
      // Restore title when companion is removed or changed
      restoreHealthTitle();
      return;
    }

    const currentHealth = blobbi.stats.health;
    const previousHealth = lastHealthLevelRef.current;
    const isInitialLoad = !hasInitialHealthCheckRef.current;

    // Update the last known health level
    lastHealthLevelRef.current = currentHealth;
    hasInitialHealthCheckRef.current = true;

    // Determine health alert behavior
    let shouldAlert = false;
    let alertInterval = 0;
    let alertMessage = '';

    if (currentHealth < 30) {
      // Critical health - every 20 seconds
      shouldAlert = true;
      alertInterval = 20000; // 20 seconds
      alertMessage = 'Blobbi needs urgent medical attention!';

    } else if (currentHealth < 60) {
      // Low health - every 60 seconds
      shouldAlert = true;
      alertInterval = 60000; // 60 seconds
      alertMessage = 'Blobbi is feeling unwell!';

    }

    if (shouldAlert) {
      // Play the first sound immediately (especially important on initial load)
      playSickSound();
      showHealthNotification(alertMessage);

      // Set up interval to play sound at appropriate frequency
      healthIntervalRef.current = setInterval(() => {
        // Double-check that health is still low and we still have the same companion
        if (blobbi && companionData && companionData.blobbiId === blobbi.id) {
          const currentHealthInInterval = blobbi.stats.health;

          // Determine if we should still alert and at what frequency
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
      // Health is 60 or above, make sure no sounds are playing
      if (previousHealth !== null && previousHealth < 60) {

      }
      // Clear any existing title notification when health recovers
      restoreHealthTitle();
    }

    // Cleanup function
    return () => {
      if (healthIntervalRef.current) {
        clearInterval(healthIntervalRef.current);
        healthIntervalRef.current = null;
      }
    };
  }, [blobbi?.stats.health, blobbi?.id, companionData?.blobbiId]); // Dependencies: health level, blobbi ID, and companion ID

  // Energy monitoring system for current companion
  useEffect(() => {
    // Clear any existing interval
    if (energyIntervalRef.current) {
      clearInterval(energyIntervalRef.current);
      energyIntervalRef.current = null;
    }

    // Only monitor energy if we have a current companion Blobbi
    if (!blobbi || !companionData || companionData.blobbiId !== blobbi.id) {

      lastEnergyLevelRef.current = null;
      hasInitialEnergyCheckRef.current = false;
      // Restore title when companion is removed or changed
      restoreEnergyTitle();
      return;
    }

    const currentEnergy = blobbi.stats.energy;
    const isAwake = !blobbi.isSleeping;
    const previousEnergy = lastEnergyLevelRef.current;
    const isInitialLoad = !hasInitialEnergyCheckRef.current;

    // Update the last known energy level
    lastEnergyLevelRef.current = currentEnergy;
    hasInitialEnergyCheckRef.current = true;

    // Determine energy alert behavior - only if awake and energy is low
    let shouldAlert = false;
    let alertInterval = 0;
    let alertMessage = '';

    if (isAwake && currentEnergy < 30) {
      // Very low energy - every 20 seconds (only if awake)
      shouldAlert = true;
      alertInterval = 20000; // 20 seconds
      alertMessage = 'Blobbi is exhausted!';

    } else if (isAwake && currentEnergy < 60) {
      // Low energy - every 60 seconds (only if awake)
      shouldAlert = true;
      alertInterval = 60000; // 60 seconds
      alertMessage = 'Blobbi is getting tired!';

    } else if (!isAwake && currentEnergy < 60) {
      // Energy is low but Blobbi is sleeping - don't play sounds but show message

    }

    if (shouldAlert) {
      // Play the first sound immediately (especially important on initial load or when waking up)
      playTiredSound();
      showEnergyNotification(alertMessage);

      // Set up interval to play sound at appropriate frequency
      energyIntervalRef.current = setInterval(() => {
        // Double-check that energy is still low, Blobbi is awake, and we still have the same companion
        if (blobbi && companionData && companionData.blobbiId === blobbi.id) {
          const currentEnergyInInterval = blobbi.stats.energy;
          const isAwakeInInterval = !blobbi.isSleeping;

          // Only play sounds if Blobbi is awake
          if (isAwakeInInterval) {
            // Determine if we should still alert and at what frequency
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
            // Blobbi fell asleep, stop the alert loop

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
      // Energy is 60 or above, or Blobbi is sleeping - make sure no sounds are playing
      if (previousEnergy !== null && previousEnergy < 60) {
        if (!isAwake) {

        } else {

        }
      }
      // Clear any existing title notification when energy recovers or Blobbi sleeps
      restoreEnergyTitle();
    }

    // Cleanup function
    return () => {
      if (energyIntervalRef.current) {
        clearInterval(energyIntervalRef.current);
        energyIntervalRef.current = null;
      }
    };
  }, [blobbi?.stats.energy, blobbi?.isSleeping, blobbi?.id, companionData?.blobbiId]); // Dependencies: energy level, sleep state, blobbi ID, and companion ID

  // Hygiene monitoring system for current companion
  useEffect(() => {
    // Clear any existing interval
    if (hygieneIntervalRef.current) {
      clearInterval(hygieneIntervalRef.current);
      hygieneIntervalRef.current = null;
    }

    // Only monitor hygiene if we have a current companion Blobbi
    if (!blobbi || !companionData || companionData.blobbiId !== blobbi.id) {

      lastHygieneLevelRef.current = null;
      hasInitialHygieneCheckRef.current = false;
      // Restore title when companion is removed or changed
      restoreHygieneTitle();
      return;
    }

    const currentHygiene = blobbi.stats.hygiene;
    const previousHygiene = lastHygieneLevelRef.current;
    const isInitialLoad = !hasInitialHygieneCheckRef.current;

    // Update the last known hygiene level
    lastHygieneLevelRef.current = currentHygiene;
    hasInitialHygieneCheckRef.current = true;

    // Determine hygiene alert behavior
    let shouldAlert = false;
    let alertInterval = 0;
    let alertMessage = '';

    if (currentHygiene < 30) {
      // Very low hygiene - every 20 seconds
      shouldAlert = true;
      alertInterval = 20000; // 20 seconds
      alertMessage = 'Blobbi is very dirty!';

    } else if (currentHygiene < 60) {
      // Low hygiene - every 60 seconds
      shouldAlert = true;
      alertInterval = 60000; // 60 seconds
      alertMessage = 'Blobbi needs cleaning!';

    }

    if (shouldAlert) {
      // Play the first sound immediately (especially important on initial load)
      playYuckSound();
      showHygieneNotification(alertMessage);

      // Set up interval to play sound at appropriate frequency
      hygieneIntervalRef.current = setInterval(() => {
        // Double-check that hygiene is still low and we still have the same companion
        if (blobbi && companionData && companionData.blobbiId === blobbi.id) {
          const currentHygieneInInterval = blobbi.stats.hygiene;

          // Determine if we should still alert and at what frequency
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
      // Hygiene is 60 or above, make sure no sounds are playing
      if (previousHygiene !== null && previousHygiene < 60) {

      }
      // Clear any existing title notification when hygiene recovers
      restoreHygieneTitle();
    }

    // Cleanup function
    return () => {
      if (hygieneIntervalRef.current) {
        clearInterval(hygieneIntervalRef.current);
        hygieneIntervalRef.current = null;
      }
    };
  }, [blobbi?.stats.hygiene, blobbi?.id, companionData?.blobbiId]); // Dependencies: hygiene level, blobbi ID, and companion ID

  // Happiness monitoring system for current companion
  useEffect(() => {
    // Clear any existing interval
    if (happinessIntervalRef.current) {
      clearInterval(happinessIntervalRef.current);
      happinessIntervalRef.current = null;
    }

    // Only monitor happiness if we have a current companion Blobbi
    if (!blobbi || !companionData || companionData.blobbiId !== blobbi.id) {

      lastHappinessLevelRef.current = null;
      hasInitialHappinessCheckRef.current = false;
      // Restore title when companion is removed or changed
      restoreHappinessTitle();
      return;
    }

    const currentHappiness = blobbi.stats.happiness;
    const previousHappiness = lastHappinessLevelRef.current;
    const isInitialLoad = !hasInitialHappinessCheckRef.current;

    // Update the last known happiness level
    lastHappinessLevelRef.current = currentHappiness;
    hasInitialHappinessCheckRef.current = true;

    // Determine happiness alert behavior
    let shouldAlert = false;
    let alertInterval = 0;
    let alertMessage = '';

    if (currentHappiness < 30) {
      // Very low happiness - every 20 seconds
      shouldAlert = true;
      alertInterval = 20000; // 20 seconds
      alertMessage = 'Blobbi is very sad!';

    } else if (currentHappiness < 60) {
      // Low happiness - every 60 seconds
      shouldAlert = true;
      alertInterval = 60000; // 60 seconds
      alertMessage = 'Blobbi is feeling down!';

    }

    if (shouldAlert) {
      // Play the first sound immediately (especially important on initial load)
      playSadSound();
      showHappinessNotification(alertMessage);

      // Set up interval to play sound at appropriate frequency
      happinessIntervalRef.current = setInterval(() => {
        // Double-check that happiness is still low and we still have the same companion
        if (blobbi && companionData && companionData.blobbiId === blobbi.id) {
          const currentHappinessInInterval = blobbi.stats.happiness;

          // Determine if we should still alert and at what frequency
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
      // Happiness is 60 or above, make sure no sounds are playing
      if (previousHappiness !== null && previousHappiness < 60) {

      }
      // Clear any existing title notification when happiness recovers
      restoreHappinessTitle();
    }

    // Cleanup function
    return () => {
      if (happinessIntervalRef.current) {
        clearInterval(happinessIntervalRef.current);
        happinessIntervalRef.current = null;
      }
    };
  }, [blobbi?.stats.happiness, blobbi?.id, companionData?.blobbiId]); // Dependencies: happiness level, blobbi ID, and companion ID

  // Function to play stomach rumble sound
  const playStomachRumbleSound = () => {
    try {
      // Create audio element and play stomach-rumble.mp3
      const audio = new Audio('/companion/sounds/stomach-rumble.mp3');

      // Get current audio settings from the audio context
      const volume = localStorage.getItem('blobbi_audio_volume');
      const isMuted = localStorage.getItem('blobbi_audio_muted') === 'true';

      // Set volume based on user settings
      if (isMuted) {
        audio.volume = 0;
      } else {
        audio.volume = volume ? Math.max(0, Math.min(1, parseFloat(volume))) : 0.5;
      }

      audio.play()
        .catch(error => console.error('❌ Error playing stomach rumble sound:', error));
    } catch (error) {
      console.error('❌ Error creating stomach rumble audio:', error);
    }
  };

  // Function to show hunger notification in browser tab
  const showHungerNotification = () => {
    try {
      // Store original title if not already stored
      if (originalTitleRef.current === null) {
        originalTitleRef.current = document.title;

      }

      // Clear any existing title timeout
      if (titleTimeoutRef.current) {
        clearTimeout(titleTimeoutRef.current);
        titleTimeoutRef.current = null;
      }

      // Set hungry notification title
      const hungryTitle = '🍽️ Blobbi is hungry!';
      document.title = hungryTitle;

      // Restore original title after 8 seconds
      titleTimeoutRef.current = setTimeout(() => {
        restoreOriginalTitle();
        titleTimeoutRef.current = null;
      }, 8000); // 8 seconds
    } catch (error) {
      console.error('❌ Error showing hunger notification:', error);
    }
  };

  // Function to restore original tab title
  const restoreOriginalTitle = () => {
    try {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }

      // Clear title timeout if it exists
      if (titleTimeoutRef.current) {
        clearTimeout(titleTimeoutRef.current);
        titleTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('❌ Error restoring original title:', error);
    }
  };

  // Function to play sick sound
  const playSickSound = () => {
    try {
      // Create audio element and play sick.mp3
      const audio = new Audio('/companion/sounds/sick.mp3');

      // Get current audio settings from the audio context
      const volume = localStorage.getItem('blobbi_audio_volume');
      const isMuted = localStorage.getItem('blobbi_audio_muted') === 'true';

      // Set volume based on user settings
      if (isMuted) {
        audio.volume = 0;
      } else {
        audio.volume = volume ? Math.max(0, Math.min(1, parseFloat(volume))) : 0.5;
      }

      audio.play()
        .catch(error => console.error('❌ Error playing sick sound:', error));
    } catch (error) {
      console.error('❌ Error creating sick audio:', error);
    }
  };

  // Function to show health notification in browser tab
  const showHealthNotification = (message: string) => {
    try {
      // Store original title if not already stored
      if (originalTitleRef.current === null) {
        originalTitleRef.current = document.title;

      }

      // Clear any existing health title timeout
      if (healthTitleTimeoutRef.current) {
        clearTimeout(healthTitleTimeoutRef.current);
        healthTitleTimeoutRef.current = null;
      }

      // Set health notification title
      const healthTitle = `🏥 ${message}`;
      document.title = healthTitle;

      // Restore original title after 8 seconds
      healthTitleTimeoutRef.current = setTimeout(() => {
        restoreHealthTitle();
        healthTitleTimeoutRef.current = null;
      }, 8000); // 8 seconds
    } catch (error) {
      console.error('❌ Error showing health notification:', error);
    }
  };

  // Function to restore original tab title from health notifications
  const restoreHealthTitle = () => {
    try {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }

      // Clear health title timeout if it exists
      if (healthTitleTimeoutRef.current) {
        clearTimeout(healthTitleTimeoutRef.current);
        healthTitleTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('❌ Error restoring original title from health notification:', error);
    }
  };

  // Function to play tired sound
  const playTiredSound = () => {
    try {
      // Create audio element and play tired.mp3
      const audio = new Audio('/companion/sounds/tired.mp3');

      // Get current audio settings from the audio context
      const volume = localStorage.getItem('blobbi_audio_volume');
      const isMuted = localStorage.getItem('blobbi_audio_muted') === 'true';

      // Set volume based on user settings
      if (isMuted) {
        audio.volume = 0;
      } else {
        audio.volume = volume ? Math.max(0, Math.min(1, parseFloat(volume))) : 0.5;
      }

      audio.play()
        .catch(error => console.error('❌ Error playing tired sound:', error));
    } catch (error) {
      console.error('❌ Error creating tired audio:', error);
    }
  };

  // Function to show energy notification in browser tab
  const showEnergyNotification = (message: string) => {
    try {
      // Store original title if not already stored
      if (originalTitleRef.current === null) {
        originalTitleRef.current = document.title;

      }

      // Clear any existing energy title timeout
      if (energyTitleTimeoutRef.current) {
        clearTimeout(energyTitleTimeoutRef.current);
        energyTitleTimeoutRef.current = null;
      }

      // Set energy notification title
      const energyTitle = `⚡ ${message}`;
      document.title = energyTitle;

      // Restore original title after 8 seconds
      energyTitleTimeoutRef.current = setTimeout(() => {
        restoreEnergyTitle();
        energyTitleTimeoutRef.current = null;
      }, 8000); // 8 seconds
    } catch (error) {
      console.error('❌ Error showing energy notification:', error);
    }
  };

  // Function to restore original tab title from energy notifications
  const restoreEnergyTitle = () => {
    try {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }

      // Clear energy title timeout if it exists
      if (energyTitleTimeoutRef.current) {
        clearTimeout(energyTitleTimeoutRef.current);
        energyTitleTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('❌ Error restoring original title from energy notification:', error);
    }
  };

  // Function to play yuck sound
  const playYuckSound = () => {
    try {
      // Create audio element and play yuck.mp3
      const audio = new Audio('/companion/sounds/yuck.mp3');

      // Get current audio settings from the audio context
      const volume = localStorage.getItem('blobbi_audio_volume');
      const isMuted = localStorage.getItem('blobbi_audio_muted') === 'true';

      // Set volume based on user settings
      if (isMuted) {
        audio.volume = 0;
      } else {
        audio.volume = volume ? Math.max(0, Math.min(1, parseFloat(volume))) : 0.5;
      }

      audio.play()
        .catch(error => console.error('❌ Error playing yuck sound:', error));
    } catch (error) {
      console.error('❌ Error creating yuck audio:', error);
    }
  };

  // Function to show hygiene notification in browser tab
  const showHygieneNotification = (message: string) => {
    try {
      // Store original title if not already stored
      if (originalTitleRef.current === null) {
        originalTitleRef.current = document.title;

      }

      // Clear any existing hygiene title timeout
      if (hygieneTitleTimeoutRef.current) {
        clearTimeout(hygieneTitleTimeoutRef.current);
        hygieneTitleTimeoutRef.current = null;
      }

      // Set hygiene notification title
      const hygieneTitle = `🧼 ${message}`;
      document.title = hygieneTitle;

      // Restore original title after 8 seconds
      hygieneTitleTimeoutRef.current = setTimeout(() => {
        restoreHygieneTitle();
        hygieneTitleTimeoutRef.current = null;
      }, 8000); // 8 seconds
    } catch (error) {
      console.error('❌ Error showing hygiene notification:', error);
    }
  };

  // Function to restore original tab title from hygiene notifications
  const restoreHygieneTitle = () => {
    try {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }

      // Clear hygiene title timeout if it exists
      if (hygieneTitleTimeoutRef.current) {
        clearTimeout(hygieneTitleTimeoutRef.current);
        hygieneTitleTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('❌ Error restoring original title from hygiene notification:', error);
    }
  };

  // Function to play sad sound
  const playSadSound = () => {
    try {
      // Create audio element and play sad.mp3
      const audio = new Audio('/companion/sounds/sad.mp3');

      // Get current audio settings from the audio context
      const volume = localStorage.getItem('blobbi_audio_volume');
      const isMuted = localStorage.getItem('blobbi_audio_muted') === 'true';

      // Set volume based on user settings
      if (isMuted) {
        audio.volume = 0;
      } else {
        audio.volume = volume ? Math.max(0, Math.min(1, parseFloat(volume))) : 0.5;
      }

      audio.play()
        .catch(error => console.error('❌ Error playing sad sound:', error));
    } catch (error) {
      console.error('❌ Error creating sad audio:', error);
    }
  };

  // Function to show happiness notification in browser tab
  const showHappinessNotification = (message: string) => {
    try {
      // Store original title if not already stored
      if (originalTitleRef.current === null) {
        originalTitleRef.current = document.title;

      }

      // Clear any existing happiness title timeout
      if (happinessTitleTimeoutRef.current) {
        clearTimeout(happinessTitleTimeoutRef.current);
        happinessTitleTimeoutRef.current = null;
      }

      // Set happiness notification title
      const happinessTitle = `😢 ${message}`;
      document.title = happinessTitle;

      // Restore original title after 8 seconds
      happinessTitleTimeoutRef.current = setTimeout(() => {
        restoreHappinessTitle();
        happinessTitleTimeoutRef.current = null;
      }, 8000); // 8 seconds
    } catch (error) {
      console.error('❌ Error showing happiness notification:', error);
    }
  };

  // Function to restore original tab title from happiness notifications
  const restoreHappinessTitle = () => {
    try {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }

      // Clear happiness title timeout if it exists
      if (happinessTitleTimeoutRef.current) {
        clearTimeout(happinessTitleTimeoutRef.current);
        happinessTitleTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('❌ Error restoring original title from happiness notification:', error);
    }
  };

  // Cleanup hunger, health, energy, hygiene, and happiness monitoring on component unmount
  useEffect(() => {
    return () => {
      if (hungerIntervalRef.current) {

        clearInterval(hungerIntervalRef.current);
        hungerIntervalRef.current = null;
      }

      if (healthIntervalRef.current) {

        clearInterval(healthIntervalRef.current);
        healthIntervalRef.current = null;
      }

      if (energyIntervalRef.current) {

        clearInterval(energyIntervalRef.current);
        energyIntervalRef.current = null;
      }

      if (hygieneIntervalRef.current) {

        clearInterval(hygieneIntervalRef.current);
        hygieneIntervalRef.current = null;
      }

      if (happinessIntervalRef.current) {

        clearInterval(happinessIntervalRef.current);
        happinessIntervalRef.current = null;
      }

      // Restore original title on unmount
      restoreOriginalTitle();
      restoreHealthTitle();
      restoreEnergyTitle();
      restoreHygieneTitle();
      restoreHappinessTitle();

    };
  }, []);

  // Function to create food element on screen
  const createFoodElement = (food: BlobbiItem, x: number, y: number) => {
    // Remove any existing food
    const existingFood = document.querySelector('.companion-food');
    if (existingFood) {
      existingFood.remove();
    }

    // Create food element
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

    // Add drop animation
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

    // Store food data for companion script
    (window as unknown as { currentFood: { element: HTMLElement; data: BlobbiItem } }).currentFood = {
      element: foodElement,
      data: food
    };

    // Notify companion script that food is placed
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

    // Enable food placement mode
    toast({
      title: "Food Ready!",
      description: "Click anywhere on the screen to place the food for your Blobbi.",
    });

    // Set up click listener for food placement
    const handleClick = (e: MouseEvent) => {
      // Don't place food on UI elements
      if ((e.target as Element).closest('.blobbi-container') ||
          (e.target as Element).closest('[role="dialog"]') ||
          (e.target as Element).closest('button')) {
        return;
      }

      // Place food at click location
      window.dispatchEvent(new CustomEvent('companion-food-placement', {
        detail: { x: e.clientX, y: e.clientY }
      }));

      // Remove click listener
      document.removeEventListener('click', handleClick);
    };

    document.addEventListener('click', handleClick);
  };

  const handleOpenShop = () => {
    setShopActiveTab('food'); // Set food tab as active
    setIsShopModalOpen(true);
  };

  return (
    <>
      {/* Feed Modal */}
      <BlobbiFeedModal
        isOpen={isFeedModalOpen}
        onClose={() => setIsFeedModalOpen(false)}
        onOpenShop={handleOpenShop}
        onFoodSelected={handleFoodSelected}
      />

      {/* Shop Modal */}
      <BlobbiShop
        isOpen={isShopModalOpen}
        onClose={() => setIsShopModalOpen(false)}
        defaultTab={shopActiveTab}
      />
    </>
  );
}