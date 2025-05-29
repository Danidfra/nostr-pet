import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { Blobbi, BlobbiAction, BlobbiItem, BlobbiStats } from '@/types/blobbi';
import { 
  createBlobbi, 
  calculateStatDecay, 
  getLifeStage, 
  shouldHibernate,
  applyAction,
  serializeBlobbi,
  deserializeBlobbi,
  addItemToInventory,
  removeItemFromInventory
} from '@/lib/blobbi';
import { NostrEvent } from '@nostrify/nostrify';

const BLOBBI_KIND = 30078; // Custom replaceable event kind

export function useBlobbi(pubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  
  // Use provided pubkey or current user's pubkey
  const targetPubkey = pubkey || user?.pubkey;
  
  // Fetch Blobbi data from Nostr
  const { data: blobbiEvent, isLoading, error } = useQuery({
    queryKey: ['blobbi', targetPubkey],
    queryFn: async () => {
      if (!targetPubkey) return null;
      
      const signal = AbortSignal.timeout(3000);
      const events = await nostr.query([
        { 
          kinds: [BLOBBI_KIND], 
          authors: [targetPubkey],
          '#d': ['blobbi'],
          limit: 1 
        }
      ], { signal });
      
      return events[0] || null;
    },
    enabled: !!targetPubkey,
    refetchInterval: 30000, // Refetch every 30 seconds to update stats
  });
  
  // Parse Blobbi data from event
  const blobbi = blobbiEvent ? deserializeBlobbi(blobbiEvent.content) : null;
  
  // Calculate current stats with decay
  const currentBlobbi = blobbi ? {
    ...blobbi,
    stats: calculateStatDecay(blobbi),
    lifeStage: getLifeStage(blobbi.birthTime),
    state: shouldHibernate(blobbi) ? 'hibernating' : blobbi.state,
  } : null;
  
  // Create new Blobbi
  const createBlobbiMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('Must be logged in to create a Blobbi');
      
      const newBlobbi = createBlobbi(user.pubkey, name);
      
      await publishEvent({
        kind: BLOBBI_KIND,
        content: serializeBlobbi(newBlobbi),
        tags: [
          ['d', 'blobbi'],
          ['title', newBlobbi.name],
          ['summary', `${newBlobbi.name} was born!`],
        ],
      });
      
      return newBlobbi;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi', user?.pubkey] });
    },
  });
  
  // Perform action on Blobbi
  const performActionMutation = useMutation({
    mutationFn: async (action: BlobbiAction) => {
      if (!user || !currentBlobbi) throw new Error('No Blobbi found');
      if (currentBlobbi.ownerPubkey !== user.pubkey) {
        throw new Error('You can only interact with your own Blobbi');
      }
      
      const updatedBlobbi = applyAction(currentBlobbi, action);
      
      await publishEvent({
        kind: BLOBBI_KIND,
        content: serializeBlobbi(updatedBlobbi),
        tags: [
          ['d', 'blobbi'],
          ['title', updatedBlobbi.name],
          ['summary', `${updatedBlobbi.name} - ${action}`],
        ],
      });
      
      return updatedBlobbi;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi', user?.pubkey] });
    },
  });
  
  // Update Blobbi customization
  const updateCustomizationMutation = useMutation({
    mutationFn: async (customization: Partial<Blobbi['customization']>) => {
      if (!user || !currentBlobbi) throw new Error('No Blobbi found');
      if (currentBlobbi.ownerPubkey !== user.pubkey) {
        throw new Error('You can only customize your own Blobbi');
      }
      
      const updatedBlobbi = {
        ...currentBlobbi,
        customization: {
          ...currentBlobbi.customization,
          ...customization,
        },
      };
      
      await publishEvent({
        kind: BLOBBI_KIND,
        content: serializeBlobbi(updatedBlobbi),
        tags: [
          ['d', 'blobbi'],
          ['title', updatedBlobbi.name],
          ['summary', `${updatedBlobbi.name} got a makeover!`],
        ],
      });
      
      return updatedBlobbi;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi', user?.pubkey] });
    },
  });
  
  // Purchase item mutation
  const purchaseItemMutation = useMutation({
    mutationFn: async (item: BlobbiItem) => {
      if (!user || !currentBlobbi) throw new Error('No Blobbi found');
      if (currentBlobbi.ownerPubkey !== user.pubkey) {
        throw new Error('You can only purchase items for your own Blobbi');
      }
      
      if (currentBlobbi.coins < item.price) {
        throw new Error('Insufficient coins');
      }
      
      // Deduct coins and add item to inventory
      const updatedBlobbi = addItemToInventory(
        {
          ...currentBlobbi,
          coins: currentBlobbi.coins - item.price,
        },
        item.id
      );
      
      await publishEvent({
        kind: BLOBBI_KIND,
        content: serializeBlobbi(updatedBlobbi),
        tags: [
          ['d', 'blobbi'],
          ['title', updatedBlobbi.name],
          ['summary', `${updatedBlobbi.name} bought ${item.name}!`],
        ],
      });
      
      return updatedBlobbi;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi', user?.pubkey] });
    },
  });
  
  // Use item from inventory
  const useItemMutation = useMutation({
    mutationFn: async ({ itemId, action, itemEffect }: { itemId: string; action: BlobbiAction; itemEffect?: Partial<BlobbiStats> }) => {
      if (!user || !currentBlobbi) throw new Error('No Blobbi found');
      if (currentBlobbi.ownerPubkey !== user.pubkey) {
        throw new Error('You can only use items on your own Blobbi');
      }
      
      // Check if item exists in inventory
      const inventoryItem = currentBlobbi.inventory.find(item => item.itemId === itemId);
      if (!inventoryItem) {
        throw new Error('Item not found in inventory');
      }
      
      // Apply the action with the item (this will apply the item's effects)
      let updatedBlobbi = applyAction(currentBlobbi, action, Date.now(), itemEffect);
      
      // Remove one item from inventory
      updatedBlobbi = removeItemFromInventory(updatedBlobbi, itemId, 1);
      
      await publishEvent({
        kind: BLOBBI_KIND,
        content: serializeBlobbi(updatedBlobbi),
        tags: [
          ['d', 'blobbi'],
          ['title', updatedBlobbi.name],
          ['summary', `${updatedBlobbi.name} used an item!`],
        ],
      });
      
      return updatedBlobbi;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi', user?.pubkey] });
    },
  });
  
  return {
    blobbi: currentBlobbi,
    isLoading,
    error,
    isOwner: user?.pubkey === targetPubkey,
    createBlobbi: createBlobbiMutation.mutate,
    performAction: performActionMutation.mutate,
    updateCustomization: updateCustomizationMutation.mutate,
    purchaseItem: purchaseItemMutation.mutateAsync,
    applyItem: (itemId: string, action: BlobbiAction, itemEffect?: Partial<BlobbiStats>) => useItemMutation.mutateAsync({ itemId, action, itemEffect }),
    isCreating: createBlobbiMutation.isPending,
    isPerformingAction: performActionMutation.isPending,
    isUpdatingCustomization: updateCustomizationMutation.isPending,
    isPurchasing: purchaseItemMutation.isPending,
    isUsingItem: useItemMutation.isPending,
  };
}

// Hook to fetch multiple Blobbis (for social features)
export function useBlobbis(limit: number = 20) {
  const { nostr } = useNostr();
  
  return useQuery({
    queryKey: ['blobbis', limit],
    queryFn: async () => {
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([
        { 
          kinds: [BLOBBI_KIND], 
          limit,
        }
      ], { signal });
      
      return events
        .map(event => ({
          event,
          blobbi: deserializeBlobbi(event.content),
        }))
        .filter(({ blobbi }) => blobbi !== null)
        .map(({ event, blobbi }) => ({
          ...blobbi!,
          stats: calculateStatDecay(blobbi!),
          lifeStage: getLifeStage(blobbi!.birthTime),
          state: shouldHibernate(blobbi!) ? 'hibernating' : blobbi!.state,
        }));
    },
  });
}