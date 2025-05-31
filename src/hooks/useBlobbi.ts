import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbiLifecycle } from '@/hooks/useBlobbiLifecycle';
import { useBlobbiState, useBlobbiRecords, useCreateBlobbi } from '@/hooks/useBlobbiEvents';
import { useUserBlobbi } from '@/hooks/useUserBlobbi';
import { Blobbi, BlobbiAction, BlobbiItem, BlobbiStats, BlobbiInteractionType } from '@/types/blobbi';
import { calculateStatDegradation, clampStat } from '@/lib/blobbi-events';

// Map legacy actions to new interaction types
function mapActionToInteractionType(action: BlobbiAction): BlobbiInteractionType {
  const actionMap: Record<BlobbiAction, BlobbiInteractionType> = {
    feed: 'feed',
    play: 'play',
    clean: 'clean',
    rest: 'rest',
    medicine: 'medicine',
    warming: 'warming',
    checking: 'checking',
    singing: 'singing',
    talking: 'talking',
    cruzar: 'cruzar',
  };
  return actionMap[action] || 'feed';
}

// Calculate stat changes based on action and item effects
function calculateStatChange(
  action: BlobbiAction, 
  currentStats: BlobbiStats,
  itemEffect?: Partial<BlobbiStats>,
  lifeStage?: 'egg' | 'baby' | 'adult'
): [string, number] {
  const baseChanges: Record<BlobbiAction, [string, number]> = {
    feed: ['hunger', Math.min(30, 100 - currentStats.hunger)],
    play: ['happiness', Math.min(25, 100 - currentStats.happiness)],
    clean: lifeStage === 'egg' 
      ? ['health', Math.min(15, 100 - currentStats.health)] // For eggs, cleaning improves shell health
      : ['hygiene', Math.min(40, 100 - currentStats.hygiene)], // For baby/adult, normal hygiene
    rest: ['energy', Math.min(35, 100 - currentStats.energy)],
    medicine: lifeStage === 'egg'
      ? ['health', Math.min(25, 100 - currentStats.health)] // Stronger effect for eggs
      : ['health', Math.min(20, 100 - currentStats.health)], // Normal effect for baby/adult
    warming: ['health', 5], // Note: For eggs, this is handled specially in useBlobbiLifecycle
    checking: ['happiness', 3],
    singing: ['happiness', 8],
    talking: ['happiness', 6],
    cruzar: ['happiness', Math.min(20, 100 - currentStats.happiness)], // Special breeding action
  };

  const [stat, baseChange] = baseChanges[action] || ['happiness', 5];
  
  // Apply item effects if provided
  let finalChange = baseChange;
  if (itemEffect && itemEffect[stat as keyof BlobbiStats]) {
    finalChange += itemEffect[stat as keyof BlobbiStats] || 0;
  }
  
  return [stat, finalChange];
}

// Main hook for Blobbi management using new event system
export function useBlobbi(pubkey?: string, blobbiId?: string) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  
  // Use provided pubkey or current user's pubkey
  const targetPubkey = pubkey || user?.pubkey;
  const targetBlobbiId = blobbiId;
  
  // If no specific Blobbi ID is provided and we're looking at the current user,
  // try to find their Blobbi automatically
  const { data: userBlobbi, isLoading: isLoadingUserBlobbi } = useUserBlobbi();
  const shouldUseUserBlobbi = !targetBlobbiId && !pubkey && user;
  const effectiveBlobbiId = targetBlobbiId || (shouldUseUserBlobbi ? userBlobbi?.id : '');
  
  // Use new lifecycle management system
  const {
    blobbi,
    lifecycleStatus,
    isLoading: isLoadingLifecycle,
    performCare,
    evolve,
    createMemory,
    isPerformingCare,
    isEvolving,
  } = useBlobbiLifecycle(effectiveBlobbiId || '');
  
  // Combine loading states
  const isLoading = isLoadingLifecycle || (shouldUseUserBlobbi && isLoadingUserBlobbi);

  // Get ownership status
  const isOwner = user?.pubkey === targetPubkey;

  // Calculate current stats with degradation
  const currentBlobbi = blobbi ? {
    ...blobbi,
    stats: (() => {
      const degradation = calculateStatDegradation(blobbi.lastInteraction);
      return {
        hunger: clampStat(blobbi.stats.hunger + (degradation.hunger || 0)),
        happiness: clampStat(blobbi.stats.happiness + (degradation.happiness || 0)),
        health: blobbi.stats.health, // Health doesn't auto-degrade
        hygiene: clampStat(blobbi.stats.hygiene + (degradation.hygiene || 0)),
        energy: clampStat(blobbi.stats.energy + (degradation.energy || 0)),
      };
    })(),
  } : null;

  // Get the createBlobbi function from the hook
  const { createBlobbi: createBlobbiFromEvents } = useCreateBlobbi();

  // Create new Blobbi using new event system
  const createBlobbiMutation = useMutation({
    mutationFn: async ({ name, stage = 'egg' }: { name: string; stage?: 'egg' | 'baby' | 'adult' }) => {
      if (!user) throw new Error('Must be logged in to create a Blobbi');
      
      return await createBlobbiFromEvents({
        name,
        stage,
        birthData: {
          origin: 'wild',
          rarity: 'common',
          birthLocation: 'enchanted_grove',
          weatherAtBirth: 'clear_sky',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi-state'] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-records'] });
      queryClient.invalidateQueries({ queryKey: ['user-blobbi'] });
    },
  });
  
  // Perform action using new care system
  const performActionMutation = useMutation({
    mutationFn: async ({ 
      action, 
      itemEffect 
    }: { 
      action: BlobbiAction; 
      itemEffect?: Partial<BlobbiStats> 
    }) => {
      if (!user || !currentBlobbi) throw new Error('No Blobbi found');
      if (!isOwner) throw new Error('You can only interact with your own Blobbi');
      
      // Import cooldown utilities and logger
      const { cooldownStorage, isActionAvailableForStage } = await import('@/lib/cooldown-storage');
      const { 
        logInteractionTriggered, 
        logInteractionBlockedByCooldown, 
        logInteractionBlockedUnavailable, 
        logInteractionError 
      } = await import('@/lib/interaction-logger');
      
      // Store previous stats for logging
      const previousStats = { ...currentBlobbi.stats };
      
      try {
        // Check if action is available for this stage
        if (!isActionAvailableForStage(action, currentBlobbi.lifeStage)) {
          logInteractionBlockedUnavailable(action, currentBlobbi.id, currentBlobbi.lifeStage);
          throw new Error(`Action "${action}" is not available for ${currentBlobbi.lifeStage} stage`);
        }
        
        // Check cooldown
        const isOnCooldown = await cooldownStorage.isOnCooldown(currentBlobbi.id, action, currentBlobbi.lifeStage);
        if (isOnCooldown) {
          const remaining = await cooldownStorage.getRemainingCooldown(currentBlobbi.id, action, currentBlobbi.lifeStage);
          logInteractionBlockedByCooldown(action, currentBlobbi.id, currentBlobbi.lifeStage, remaining);
          const { formatCooldownTime } = await import('@/lib/cooldown-storage');
          throw new Error(`Action is on cooldown. Time remaining: ${formatCooldownTime(remaining)}`);
        }
        
        const interactionType = mapActionToInteractionType(action);
        const [statName, statChange] = calculateStatChange(action, currentBlobbi.stats, itemEffect, currentBlobbi.lifeStage);
        
        const result = await performCare({
          action: interactionType,
          customStatChange: [statName, statChange],
          experienceGained: 5,
          carePoints: action === 'feed' || action === 'play' ? 2 : 1,
        });
        
        // Record cooldown after successful action
        await cooldownStorage.setCooldown(currentBlobbi.id, action, Date.now(), currentBlobbi.lifeStage);
        
        // Calculate new stats for logging
        const newStats = {
          ...previousStats,
          [statName]: Math.min(100, Math.max(0, previousStats[statName as keyof BlobbiStats] + statChange))
        };
        
        // Log successful interaction
        logInteractionTriggered(action, currentBlobbi.id, currentBlobbi.lifeStage, {
          statChanges: { [statName]: statChange },
          experienceGained: 5,
          itemUsed: itemEffect ? 'custom_item' : undefined,
          previousStats,
          newStats
        });
        
        return result;
      } catch (error) {
        // Log error if it's not already logged
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (!errorMessage.includes('not available for') && !errorMessage.includes('on cooldown')) {
          logInteractionError(action, currentBlobbi.id, currentBlobbi.lifeStage, errorMessage);
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status'] });
    },
  });
  
  // Manual evolution trigger
  const triggerEvolutionMutation = useMutation({
    mutationFn: async () => {
      if (!user || !currentBlobbi) throw new Error('No Blobbi found');
      if (!isOwner) throw new Error('You can only evolve your own Blobbi');
      
      let newStage: 'baby' | 'adult';
      let reason: string;
      
      if (currentBlobbi.lifeStage === 'egg') {
        newStage = 'baby';
        reason = 'Manual hatching triggered';
      } else if (currentBlobbi.lifeStage === 'baby') {
        newStage = 'adult';
        reason = 'Manual evolution triggered';
      } else {
        throw new Error('Blobbi is already fully evolved');
      }
      
      return await evolve({ newStage, evolutionReason: reason });
    },
  });

  // Create special memory
  const createMemoryMutation = useMutation({
    mutationFn: async ({
      title,
      description,
      achievement,
    }: {
      title?: string;
      description?: string;
      achievement?: string;
    }) => {
      if (!user || !currentBlobbi) throw new Error('No Blobbi found');
      if (!isOwner) throw new Error('You can only create memories for your own Blobbi');
      
      return await createMemory({
        memoryTitle: title,
        memoryDescription: description,
        achievement,
        milestone: achievement ? `achievement_${achievement}` : undefined,
      });
    },
  });

  // Get the updateState function from the hook
  const { updateState } = useBlobbiState(effectiveBlobbiId, targetPubkey);

  // Legacy compatibility methods
  const updateCustomizationMutation = useMutation({
    mutationFn: async (customization: Partial<Blobbi['customization']>) => {
      if (!user || !currentBlobbi) throw new Error('No Blobbi found');
      if (!isOwner) throw new Error('You can only customize your own Blobbi');
      
      const updatedBlobbi = {
        ...currentBlobbi,
        baseColor: customization.color || currentBlobbi.baseColor,
        pattern: customization.pattern || currentBlobbi.pattern,
        customization: {
          ...currentBlobbi.customization,
          ...customization,
        },
      };
      
      await updateState(updatedBlobbi);
      return updatedBlobbi;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi-state'] });
    },
  });

  // Purchase item (simplified - would need shop integration)
  const purchaseItemMutation = useMutation({
    mutationFn: async (item: BlobbiItem) => {
      if (!user || !currentBlobbi) throw new Error('No Blobbi found');
      if (!isOwner) throw new Error('You can only purchase items for your own Blobbi');
      
      // This would integrate with a shop system
      throw new Error('Shop system not yet implemented with new event structure');
    },
  });

  // Add coins (for game rewards)
  const addCoinsMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!user || !currentBlobbi) throw new Error('No Blobbi found');
      if (!isOwner) throw new Error('You can only add coins to your own Blobbi');
      
      // Create a memory for earning coins
      await createMemory({
        memoryTitle: 'Coins Earned',
        achievement: `earned_${amount}_coins`,
        memoryDescription: `Earned ${amount} coins through gameplay`,
      });
      
      return amount;
    },
  });

  return {
    // Core data
    blobbi: currentBlobbi,
    isLoading,
    error: null,
    isOwner,
    
    // Lifecycle status
    lifecycleStatus,
    
    // Actions
    createBlobbi: createBlobbiMutation.mutateAsync,
    performAction: (action: BlobbiAction, itemEffect?: Partial<BlobbiStats>) => 
      performActionMutation.mutateAsync({ action, itemEffect }),
    triggerEvolution: triggerEvolutionMutation.mutateAsync,
    createMemory: createMemoryMutation.mutateAsync,
    updateCustomization: updateCustomizationMutation.mutateAsync,
    purchaseItem: purchaseItemMutation.mutateAsync,
    addCoins: addCoinsMutation.mutateAsync,
    
    // Loading states
    isCreating: createBlobbiMutation.isPending,
    isPerformingAction: isPerformingCare || performActionMutation.isPending,
    isEvolving: isEvolving || triggerEvolutionMutation.isPending,
    isUpdatingCustomization: updateCustomizationMutation.isPending,
    isPurchasing: purchaseItemMutation.isPending,
    isAddingCoins: addCoinsMutation.isPending,
    isCreatingMemory: createMemoryMutation.isPending,
  };
}

// Hook to fetch multiple Blobbis using new event system
export function useBlobbis(limit: number = 20) {
  const { nostr } = useNostr();
  
  return useQuery({
    queryKey: ['blobbis-new', limit],
    queryFn: async () => {
      const signal = AbortSignal.timeout(5000);
      
      // Query recent state events from different users
      const stateEvents = await nostr.query([
        { 
          kinds: [31124], // Blobbi state events
          limit: limit * 2, // Get more to filter unique users
        }
      ], { signal });
      
      // Parse and filter unique Blobbis
      const { parseBlobbiFromStateEvent } = await import('@/lib/blobbi-events');
      const blobbis = stateEvents
        .map(event => {
          return parseBlobbiFromStateEvent(event);
        })
        .filter(blobbi => blobbi !== null)
        .reduce((unique, blobbi) => {
          // Keep only one Blobbi per user
          if (!unique.find(b => b.ownerPubkey === blobbi.ownerPubkey)) {
            unique.push(blobbi);
          }
          return unique;
        }, [] as Blobbi[])
        .slice(0, limit);

      // Apply stat degradation
      return blobbis.map(blobbi => ({
        ...blobbi,
        stats: (() => {
          const degradation = calculateStatDegradation(blobbi.lastInteraction);
          return {
            hunger: clampStat(blobbi.stats.hunger + (degradation.hunger || 0)),
            happiness: clampStat(blobbi.stats.happiness + (degradation.happiness || 0)),
            health: blobbi.stats.health,
            hygiene: clampStat(blobbi.stats.hygiene + (degradation.hygiene || 0)),
            energy: clampStat(blobbi.stats.energy + (degradation.energy || 0)),
          };
        })(),
      }));
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

// Import useNostr for the useBlobbis hook
import { useNostr } from '@/hooks/useNostr';