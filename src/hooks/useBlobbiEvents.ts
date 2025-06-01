import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { NostrEvent } from '@nostrify/nostrify';
import {
  BLOBBI_EVENT_KINDS,
  createBlobbiStateEvent,
  createBlobbiInteractionEvent,
  createBlobbiRecordEvent,
  createBlobbiBreedingEvent,
  parseBlobbiFromStateEvent,
  parseInteractionFromEvent,
  parseRecordFromEvent,
  validateBlobbiEvent,
} from '@/lib/blobbi-events';
import {
  Blobbi,
  BlobbiInteractionData,
  BlobbiRecordData,
  BlobbiRecordType,
  BlobbiInteractionType,
  BlobbiLifeStage,
  BlobbiStats,
} from '@/types/blobbi';

// Hook for managing Blobbi state events (Kind 31124)
export function useBlobbiState(blobbiId?: string, pubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  
  const targetPubkey = pubkey || user?.pubkey;
  const targetBlobbiId = blobbiId;

  // Fetch current Blobbi state
  const { data: stateEvent, isLoading, error } = useQuery({
    queryKey: ['blobbi-state', targetBlobbiId, targetPubkey],
    queryFn: async () => {
      if (!targetPubkey || !targetBlobbiId) return null;
      
      const signal = AbortSignal.timeout(3000);
      const events = await nostr.query([
        {
          kinds: [BLOBBI_EVENT_KINDS.STATE],
          authors: [targetPubkey],
          '#d': [targetBlobbiId],
          limit: 1,
        }
      ], { signal });
      
      return events[0] || null;
    },
    enabled: !!targetPubkey && !!targetBlobbiId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Parse Blobbi from state event
  const blobbi = stateEvent ? parseBlobbiFromStateEvent(stateEvent) : null;

  // Update Blobbi state
  const updateStateMutation = useMutation({
    mutationFn: async (updatedBlobbi: Blobbi) => {
      if (!user) throw new Error('Must be logged in to update Blobbi state');
      
      const stateEventData = createBlobbiStateEvent(updatedBlobbi);
      
      await publishEvent({
        ...stateEventData,
      });
      
      return updatedBlobbi;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi-state', targetBlobbiId, targetPubkey] });
    },
  });

  return {
    blobbi,
    stateEvent,
    isLoading,
    error,
    isOwner: user?.pubkey === targetPubkey,
    updateState: updateStateMutation.mutateAsync,
    isUpdating: updateStateMutation.isPending,
  };
}

// Hook for managing Blobbi interactions (Kind 14919)
export function useBlobbiInteractions(blobbiId: string, limit: number = 50) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();

  // Fetch interaction history
  const { data: interactions, isLoading, error } = useQuery({
    queryKey: ['blobbi-interactions', blobbiId, limit],
    queryFn: async () => {
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([
        {
          kinds: [BLOBBI_EVENT_KINDS.INTERACTION],
          '#blobbi_id': [blobbiId],
          limit,
        }
      ], { signal });
      
      return events
        .filter(validateBlobbiEvent)
        .map(event => ({
          event,
          interaction: parseInteractionFromEvent(event),
        }))
        .filter(({ interaction }) => interaction !== null)
        .sort((a, b) => b.event.created_at - a.event.created_at);
    },
    enabled: !!blobbiId,
  });

  // Create new interaction
  const createInteractionMutation = useMutation({
    mutationFn: async (interactionData: BlobbiInteractionData) => {
      if (!user) throw new Error('Must be logged in to create interaction');
      
      const interactionEventData = createBlobbiInteractionEvent(blobbiId, interactionData);
      
      await publishEvent({
        ...interactionEventData,
      });
      
      return interactionData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', blobbiId] });
    },
  });

  return {
    interactions: interactions || [],
    isLoading,
    error,
    createInteraction: createInteractionMutation.mutateAsync,
    isCreating: createInteractionMutation.isPending,
  };
}

// Hook for managing Blobbi records (Kind 14921)
export function useBlobbiRecords(blobbiId: string, recordType?: BlobbiRecordType) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();

  // Build query filter
  const queryFilter: {
    kinds: number[];
    '#blobbi_id': string[];
    '#record_type'?: string[];
  } = {
    kinds: [BLOBBI_EVENT_KINDS.RECORD],
    '#blobbi_id': [blobbiId],
  };
  
  if (recordType) {
    queryFilter['#record_type'] = [recordType];
  }

  // Fetch records
  const { data: records, isLoading, error } = useQuery({
    queryKey: ['blobbi-records', blobbiId, recordType],
    queryFn: async () => {
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([queryFilter], { signal });
      
      return events
        .filter(validateBlobbiEvent)
        .map(event => ({
          event,
          record: parseRecordFromEvent(event),
        }))
        .filter(({ record }) => record !== null)
        .sort((a, b) => a.event.created_at - b.event.created_at); // Chronological order for timeline
    },
    enabled: !!blobbiId,
  });

  // Create new record
  const createRecordMutation = useMutation({
    mutationFn: async ({ recordData, content }: { recordData: BlobbiRecordData; content?: string }) => {
      if (!user) throw new Error('Must be logged in to create record');
      
      const recordEventData = createBlobbiRecordEvent(blobbiId, recordData, content);
      
      await publishEvent({
        ...recordEventData,
      });
      
      return recordData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi-records', blobbiId] });
    },
  });

  return {
    records: records || [],
    isLoading,
    error,
    createRecord: createRecordMutation.mutateAsync,
    isCreating: createRecordMutation.isPending,
  };
}

// Hook for managing Blobbi breeding events (Kind 14920)
export function useBlobbiBreeding() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();

  // Fetch breeding events for user's Blobbis
  const { data: breedingEvents, isLoading, error } = useQuery({
    queryKey: ['blobbi-breeding', user?.pubkey],
    queryFn: async () => {
      if (!user) return [];
      
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([
        {
          kinds: [BLOBBI_EVENT_KINDS.BREEDING],
          '#owner_a': [user.pubkey],
        },
        {
          kinds: [BLOBBI_EVENT_KINDS.BREEDING],
          '#owner_b': [user.pubkey],
        }
      ], { signal });
      
      return events
        .filter(validateBlobbiEvent)
        .sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!user,
  });

  // Create breeding event
  const createBreedingMutation = useMutation({
    mutationFn: async ({
      parentA,
      parentB,
      ownerA,
      ownerB,
      success,
      offspringId,
      additionalData,
    }: {
      parentA: string;
      parentB: string;
      ownerA: string;
      ownerB: string;
      success: boolean;
      offspringId?: string;
      additionalData?: Record<string, string>;
    }) => {
      if (!user) throw new Error('Must be logged in to create breeding event');
      
      const breedingEventData = createBlobbiBreedingEvent(
        parentA,
        parentB,
        ownerA,
        ownerB,
        success,
        offspringId,
        additionalData
      );
      
      await publishEvent({
        ...breedingEventData,
      });
      
      return breedingEventData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi-breeding', user?.pubkey] });
    },
  });

  return {
    breedingEvents: breedingEvents || [],
    isLoading,
    error,
    createBreeding: createBreedingMutation.mutateAsync,
    isCreating: createBreedingMutation.isPending,
  };
}

// Hook for Blobbi timeline (combines all event types)
export function useBlobbiTimeline(blobbiId: string) {
  const { records } = useBlobbiRecords(blobbiId);
  const { interactions } = useBlobbiInteractions(blobbiId, 100);

  // Combine and sort all events chronologically
  const timeline = [
    ...records.map(({ event, record }) => ({
      type: 'record' as const,
      timestamp: event.created_at * 1000,
      event,
      data: record,
    })),
    ...interactions.map(({ event, interaction }) => ({
      type: 'interaction' as const,
      timestamp: event.created_at * 1000,
      event,
      data: interaction,
    })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  return {
    timeline,
    isLoading: false, // Both queries handle their own loading states
  };
}

// Hook for creating a new Blobbi with proper lifecycle events
export function useCreateBlobbi() {
  const { user } = useCurrentUser();
  const { updateState } = useBlobbiState();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();

  const createBlobbiMutation = useMutation({
    mutationFn: async ({ 
      name, 
      stage = 'egg',
      birthData 
    }: { 
      name: string; 
      stage?: 'egg' | 'child' | 'adult';
      birthData?: Partial<BlobbiRecordData>;
    }) => {
      if (!user) throw new Error('Must be logged in to create a Blobbi');
      
      // Use the specification-compliant egg generation system
      const { createBlobbiWithAdoption } = await import('@/lib/blobbi-adoption');
      const { blobbi: newBlobbi, adoptionRecord } = createBlobbiWithAdoption({
        petName: name,
        userPubkey: user.pubkey,
      });

      // Merge any additional birth data
      const finalBirthData: BlobbiRecordData = {
        ...adoptionRecord,
        ...birthData,
      };

      // First create the birth record with the correct blobbi_id
      const recordEventData = createBlobbiRecordEvent(newBlobbi.id, finalBirthData, `${name} was born!`);
      await publishEvent({
        ...recordEventData,
      });

      // Then create the initial state
      await updateState(newBlobbi);

      return newBlobbi;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi-state'] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-records'] });
    },
  });

  return {
    createBlobbi: createBlobbiMutation.mutateAsync,
    isCreating: createBlobbiMutation.isPending,
  };
}

// Hook for handling Blobbi evolution with automatic record creation
export function useBlobbiEvolution(blobbiId: string) {
  const { user } = useCurrentUser();
  const { blobbi, updateState } = useBlobbiState(blobbiId);
  const { createRecord } = useBlobbiRecords(blobbiId);
  const queryClient = useQueryClient();

  const evolveBlobbiMutation = useMutation({
    mutationFn: async ({ 
      newStage, 
      evolutionReason 
    }: { 
      newStage: BlobbiLifeStage; 
      evolutionReason?: string;
    }) => {
      if (!user) throw new Error('Must be logged in to evolve Blobbi');
      if (!blobbi) throw new Error('Blobbi not found');
      
      // Import evolution functions dynamically to avoid circular dependencies
      const { processEvolution } = await import('@/lib/blobbi-evolution');
      
      // Process evolution and get updated data
      const { updatedBlobbi, evolutionRecord } = processEvolution(
        blobbi,
        newStage,
        evolutionReason
      );

      // Create evolution record first
      await createRecord({
        recordData: evolutionRecord,
        content: newStage === 'child' 
          ? `${blobbi.name} has hatched! 🐣` 
          : `${blobbi.name} has evolved to ${evolutionRecord.evolutionStage}! ✨`,
      });

      // Update state
      await updateState(updatedBlobbi);

      return updatedBlobbi;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi-state', blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-records', blobbiId] });
    },
  });

  return {
    evolveBlobbi: evolveBlobbiMutation.mutateAsync,
    isEvolving: evolveBlobbiMutation.isPending,
  };
}

// Hook for creating memory records
export function useBlobbiMemory(blobbiId: string) {
  const { user } = useCurrentUser();
  const { createRecord } = useBlobbiRecords(blobbiId);
  const queryClient = useQueryClient();

  const createMemoryMutation = useMutation({
    mutationFn: async ({
      memoryTitle,
      memoryDescription,
      achievement,
      milestone,
      discoveredTrait,
    }: {
      memoryTitle?: string;
      memoryDescription?: string;
      achievement?: string;
      milestone?: string;
      discoveredTrait?: string;
    }) => {
      if (!user) throw new Error('Must be logged in to create memory');
      
      const memoryRecord: BlobbiRecordData = {
        recordType: 'memory',
        memoryTitle,
        memoryDescription,
        memoryDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        achievement,
        milestone,
        discoveredTrait,
      };

      await createRecord({
        recordData: memoryRecord,
        content: memoryTitle || achievement || milestone || 'A special memory was created',
      });

      return memoryRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi-records', blobbiId] });
    },
  });

  return {
    createMemory: createMemoryMutation.mutateAsync,
    isCreating: createMemoryMutation.isPending,
  };
}

// Hook for managing Blobbi care with automatic evolution checking
export function useBlobbiCare(blobbiId: string) {
  const { blobbi, updateState } = useBlobbiState(blobbiId);
  const { createInteraction } = useBlobbiInteractions(blobbiId);
  const { evolveBlobbi } = useBlobbiEvolution(blobbiId);
  const { createMemory } = useBlobbiMemory(blobbiId);

  const performCareMutation = useMutation({
    mutationFn: async ({
      action,
      interactionData,
    }: {
      action: BlobbiInteractionType;
      interactionData: Partial<BlobbiInteractionData>;
    }) => {
      if (!blobbi) throw new Error('Blobbi not found');

      // Import evolution functions
      const { 
        updateEvolutionProgress, 
        checkEggHatchingReadiness, 
        checkChildEvolutionReadiness 
      } = await import('@/lib/blobbi-evolution');

      // Create interaction record
      const fullInteractionData: BlobbiInteractionData = {
        action,
        actionCategory: interactionData.actionCategory || 'care',
        statChange: interactionData.statChange || ['happiness', '+10'],
        ...interactionData,
      };

      await createInteraction(fullInteractionData);

      // Update evolution progress
      const updatedProgress = updateEvolutionProgress(blobbi, action);
      
      // Apply stat changes and update Blobbi
      const statChange = fullInteractionData.statChange;
      const [statName, changeValue] = statChange;
      const changeAmount = parseInt(changeValue);
      
      const updatedBlobbi: Blobbi = {
        ...blobbi,
        lastInteraction: Date.now(),
        evolutionProgress: updatedProgress,
        experience: blobbi.experience + (fullInteractionData.experienceGained || 5),
        careStreak: fullInteractionData.careStreak || blobbi.careStreak,
        stats: {
          ...blobbi.stats,
          [statName]: Math.max(0, Math.min(100, blobbi.stats[statName as keyof BlobbiStats] + changeAmount)),
        },
      };

      await updateState(updatedBlobbi);

      // Check for evolution opportunities
      let evolutionTriggered = false;
      
      if (blobbi.lifeStage === 'egg') {
        const { isReady } = checkEggHatchingReadiness(updatedBlobbi);
        if (isReady) {
          await evolveBlobbi({ newStage: 'child', evolutionReason: 'Hatching requirements met' });
          evolutionTriggered = true;
        }
      } else if (blobbi.lifeStage === 'child') {
        const { isReady } = checkChildEvolutionReadiness(updatedBlobbi);
        if (isReady) {
          await evolveBlobbi({ newStage: 'adult', evolutionReason: 'Evolution requirements met' });
          evolutionTriggered = true;
        }
      }

      // Create special memories for milestones
      if (fullInteractionData.achievementUnlocked) {
        await createMemory({
          memoryTitle: 'Achievement Unlocked',
          achievement: fullInteractionData.achievementUnlocked,
          memoryDescription: `Earned the "${fullInteractionData.achievementUnlocked}" achievement through ${action}`,
        });
      }

      if (fullInteractionData.specialEvent) {
        await createMemory({
          memoryTitle: 'Special Event',
          milestone: fullInteractionData.specialEvent,
          memoryDescription: `Experienced a special event: ${fullInteractionData.specialEvent}`,
        });
      }

      return {
        updatedBlobbi,
        evolutionTriggered,
        interaction: fullInteractionData,
      };
    },
  });

  return {
    performCare: performCareMutation.mutateAsync,
    isPerforming: performCareMutation.isPending,
  };
}