import { useState, useEffect } from 'react';
import { BlobbiFeedModal } from './BlobbiFeedModal';
import { BlobbiShop } from './BlobbiShop';
import { BlobbiItem } from '@/types/blobbi';
import { useBlobbi } from '@/hooks/useBlobbi';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCurrentCompanion } from '@/hooks/useCurrentCompanion';
import { useToast } from '@/hooks/useToast';
import { useRemoveFromStorage } from '@/hooks/useBlobbonautProfile';
import { useBlobbiSleepSystem } from '@/hooks/useBlobbiSleepSystem';

export function BlobbiCompanionIntegration() {
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [shopActiveTab, setShopActiveTab] = useState<string>('food');
  const [selectedFood, setSelectedFood] = useState<BlobbiItem | null>(null);
  const [isPlacingFood, setIsPlacingFood] = useState(false);
  
  const { user } = useCurrentUser();
  const { data: companionData } = useCurrentCompanion();
  
  // ✅ FIXED: Use the current companion's Blobbi ID instead of falling back to user's first Blobbi
  const { blobbi, performAction } = useBlobbi(
    companionData?.blobbi?.ownerPubkey, 
    companionData?.blobbiId
  );
  
  const { toast } = useToast();
  const { mutateAsync: removeFromStorage } = useRemoveFromStorage();
  const { putToSleep, wakeUp, isSleeping } = useBlobbiSleepSystem({ 
    blobbi, 
    isOwner: !!user && blobbi?.ownerPubkey === user.pubkey 
  });

  // Set up global event listeners for companion interactions
  useEffect(() => {
    // Function to handle feed button click from companion
    const handleFeedClick = () => {
      setIsFeedModalOpen(true);
    };

    // Function to handle food placement
    const handleFoodPlacement = async (event: CustomEvent) => {
      console.log('🍽️ React: Food placement triggered', { 
        selectedFood, 
        blobbi: !!blobbi, 
        user: !!user,
        companionData: !!companionData,
        isCurrentCompanion: companionData?.blobbiId === blobbi?.id
      });
      
      if (!selectedFood || !blobbi || !user || !companionData) {
        console.log('🚫 React: Food placement blocked - missing requirements');
        return;
      }

      // ✅ FIXED: Ensure we're interacting with the current companion
      if (companionData.blobbiId !== blobbi.id) {
        console.log('🚫 React: Food placement blocked - Blobbi ID mismatch', {
          companionId: companionData.blobbiId,
          blobbiId: blobbi.id
        });
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
        console.log('✅ React: Food placement state set to true');
        
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
      console.log('🍽️ React: Food reached event triggered', { 
        blobbi: !!blobbi, 
        user: !!user, 
        isPlacingFood,
        companionData: !!companionData,
        isCurrentCompanion: companionData?.blobbiId === blobbi?.id,
        eventDetail: event.detail 
      });
      
      if (!blobbi || !user || !isPlacingFood || !companionData) {
        console.log('🚫 React: Food reached blocked - missing requirements', {
          blobbi: !!blobbi,
          user: !!user,
          isPlacingFood,
          companionData: !!companionData
        });
        return;
      }

      // ✅ FIXED: Ensure we're interacting with the current companion
      if (companionData.blobbiId !== blobbi.id) {
        console.log('🚫 React: Food reached blocked - Blobbi ID mismatch', {
          companionId: companionData.blobbiId,
          blobbiId: blobbi.id
        });
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

      console.log('🍽️ React: Blobbi reached food, emitting Nostr events...', food);

      try {
        // First, remove the food item from storage (emit kind 31125)
        console.log('📤 React: Removing food from storage...', { itemId: food.id, quantity: 1 });
        await removeFromStorage({
          itemId: food.id,
          quantity: 1,
        });
        
        console.log('✅ Kind 31125 emitted: Removed food from inventory');
        
        // Then, perform the feed action with the food's effects (emit kind 31124)
        console.log('📤 React: Performing feed action...', { action: 'feed', effects: food.effect });
        await performAction('feed', food.effect);
        
        console.log('✅ Kind 31124 emitted: Updated Blobbi stats');
        
        toast({
          title: "Blobbi Fed!",
          description: `Your Blobbi enjoyed the ${food.name}!`,
        });
        
        // Clear placing food state and selected food
        setIsPlacingFood(false);
        setSelectedFood(null);
        console.log('🧹 React: Cleared food placement state');
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

    // Function to handle sleep state changes from companion
    const handleSleepChange = async (event: CustomEvent) => {
      console.log('😴 React: Sleep change event triggered', { 
        blobbi: !!blobbi, 
        user: !!user, 
        companionData: !!companionData,
        isCurrentCompanion: companionData?.blobbiId === blobbi?.id,
        shouldSleep: event.detail.shouldSleep,
        currentSleepState: isSleeping
      });
      
      if (!blobbi || !user || !companionData) {
        console.log('🚫 React: Sleep change blocked - missing requirements', {
          blobbi: !!blobbi,
          user: !!user,
          companionData: !!companionData
        });
        return;
      }

      // ✅ FIXED: Ensure we're interacting with the current companion
      if (companionData.blobbiId !== blobbi.id) {
        console.log('🚫 React: Sleep change blocked - Blobbi ID mismatch', {
          companionId: companionData.blobbiId,
          blobbiId: blobbi.id
        });
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
          console.log('😴 React: Putting Blobbi to sleep...');
          await putToSleep();
          console.log('✅ React: Blobbi is now sleeping');
          
          toast({
            title: "Blobbi is Sleeping",
            description: "Your Blobbi has settled down on the bed for a nap!",
          });
        } else if (!shouldSleep && isSleeping) {
          // Wake up Blobbi (bed visibility will be handled automatically by BedContext)
          console.log('😊 React: Waking up Blobbi...');
          await wakeUp();
          console.log('✅ React: Blobbi is now awake');
          
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

    // Expose functions to global scope for companion script
    (window as unknown as { openFeedModal: () => void }).openFeedModal = handleFeedClick;

    return () => {
      window.removeEventListener('companion-feed-click', handleFeedClick);
      window.removeEventListener('companion-food-placement', handleFoodPlacement as EventListener);
      window.removeEventListener('companion-food-reached', handleFoodReached as EventListener);
      window.removeEventListener('companion-sleep-change', handleSleepChange as EventListener);
      delete (window as unknown as { openFeedModal?: () => void }).openFeedModal;
    };
  }, [selectedFood, blobbi, user, isPlacingFood, performAction, toast, removeFromStorage, putToSleep, wakeUp, isSleeping, companionData]);

  // Notify companion when sleep state changes from React side
  useEffect(() => {
    if (blobbi) {
      // Notify companion about current sleep state
      window.dispatchEvent(new CustomEvent('react-sleep-state-change', {
        detail: { isSleeping: blobbi.isSleeping }
      }));
    }
  }, [blobbi?.isSleeping]);

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
        isCompanionMode={true}
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