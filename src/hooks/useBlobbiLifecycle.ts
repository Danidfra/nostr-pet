import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbiState, useBlobbiRecords, useBlobbiInteractions } from '@/hooks/useBlobbiEvents';
import { 
  Blobbi, 
  BlobbiRecordData, 
  BlobbiInteractionData,
  BlobbiLifeStage,
  BlobbiStats,
  BlobbiInteractionType,
} from '@/types/blobbi';

// Hook for comprehensive Blobbi lifecycle management
export function useBlobbiLifecycle(blobbiId: string) {
  const { user } = useCurrentUser();
  const { blobbi, updateState, isLoading: stateLoading } = useBlobbiState(blobbiId);
  const { records, createRecord, isLoading: recordsLoading } = useBlobbiRecords(blobbiId);
  const { interactions, createInteraction, isLoading: interactionsLoading } = useBlobbiInteractions(blobbiId);
  const queryClient = useQueryClient();

  // Get lifecycle status and requirements
  const lifecycleStatus = useQuery({
    queryKey: ['blobbi-lifecycle-status', blobbiId, blobbi?.lifeStage, blobbi?.experience, blobbi?.stats],
    queryFn: async () => {
      if (!blobbi) return null;

      const { 
        checkEggHatchingReadiness, 
        checkBabyEvolutionReadiness,
        getCareStreakStatus,
      } = await import('@/lib/blobbi-evolution');

      const careStreak = getCareStreakStatus(blobbi.evolutionProgress);
      
      let evolutionStatus: { isReady: boolean; message: string; requirements?: Record<string, unknown> } | null = null;
      if (blobbi.lifeStage === 'egg') {
        evolutionStatus = checkEggHatchingReadiness(blobbi);
      } else if (blobbi.lifeStage === 'baby') {
        evolutionStatus = checkBabyEvolutionReadiness(blobbi);
      }

      return {
        careStreak,
        evolutionStatus,
        currentStage: blobbi.lifeStage,
        isEligibleForEvolution: evolutionStatus?.isReady || false,
      };
    },
    enabled: !!blobbi,
    refetchInterval: 60000, // Check every minute
  });

  // Perform evolution with proper record creation
  const evolveMutation = useMutation({
    mutationFn: async ({ 
      newStage, 
      evolutionReason 
    }: { 
      newStage: BlobbiLifeStage; 
      evolutionReason?: string;
    }) => {
      if (!user || !blobbi) throw new Error('Invalid state for evolution');

      const { processEvolution } = await import('@/lib/blobbi-evolution');
      
      // Process evolution
      const { updatedBlobbi, evolutionRecord } = processEvolution(
        blobbi,
        newStage,
        evolutionReason
      );

      // Create evolution record
      await createRecord({
        recordData: evolutionRecord,
        content: newStage === 'baby' 
          ? `${blobbi.name} has hatched from their egg! 🐣✨` 
          : `${blobbi.name} has evolved to ${evolutionRecord.evolutionStage}! 🌟`,
      });

      // Update state
      await updateState(updatedBlobbi);

      return { updatedBlobbi, evolutionRecord };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status', blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-state', blobbiId] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-records', blobbiId] });
    },
  });

  // Perform care action with stat updates and evolution checking
  const performCareMutation = useMutation({
    mutationFn: async ({
      action,
      itemUsed,
      customStatChange,
      experienceGained = 5,
      carePoints = 2,
    }: {
      action: string;
      itemUsed?: string;
      customStatChange?: [string, number];
      experienceGained?: number;
      carePoints?: number;
    }) => {
      if (!user || !blobbi) throw new Error('Invalid state for care action');

      const { updateEvolutionProgress } = await import('@/lib/blobbi-evolution');
      const { clampStat, calculateStatDegradation } = await import('@/lib/blobbi-events');

      // Calculate stat degradation since last interaction
      const degradation = calculateStatDegradation(blobbi.lastInteraction);
      
      // Apply degradation to current stats
      const degradedStats: BlobbiStats = {
        hunger: clampStat(blobbi.stats.hunger + (degradation.hunger || 0)),
        happiness: clampStat(blobbi.stats.happiness + (degradation.happiness || 0)),
        health: blobbi.stats.health, // Health doesn't degrade automatically
        hygiene: clampStat(blobbi.stats.hygiene + (degradation.hygiene || 0)),
        energy: clampStat(blobbi.stats.energy + (degradation.energy || 0)),
      };

      // Determine stat change based on action
      let statChange: [string, number];
      if (customStatChange) {
        statChange = customStatChange;
      } else {
        switch (action) {
          case 'feed':
            statChange = ['hunger', Math.min(30, 100 - degradedStats.hunger)];
            break;
          case 'play':
            statChange = ['happiness', Math.min(25, 100 - degradedStats.happiness)];
            break;
          case 'clean':
            statChange = ['hygiene', Math.min(40, 100 - degradedStats.hygiene)];
            break;
          case 'rest':
            statChange = ['energy', Math.min(35, 100 - degradedStats.energy)];
            break;
          case 'medicine':
            statChange = ['health', Math.min(20, 100 - degradedStats.health)];
            break;
          case 'warming':
            statChange = ['health', 5];
            break;
          case 'checking':
            statChange = ['happiness', 3];
            break;
          case 'singing':
            statChange = ['happiness', 8];
            break;
          case 'talking':
            statChange = ['happiness', 6];
            break;
          default:
            statChange = ['happiness', 5];
        }
      }

      // Create interaction data
      const interactionData: BlobbiInteractionData = {
        action: action as BlobbiInteractionType,
        actionCategory: getActionCategory(action),
        statChange: [statChange[0], `+${statChange[1]}`],
        itemUsed,
        experienceGained,
        carePoints,
        timeOfDay: getTimeOfDay(),
        blobbiMoodBefore: getBlobbiMood(degradedStats),
      };

      // Apply stat change
      const newStats: BlobbiStats = {
        ...degradedStats,
        [statChange[0]]: clampStat(degradedStats[statChange[0] as keyof BlobbiStats] + statChange[1]),
      };

      // Update mood after interaction
      interactionData.blobbiMoodAfter = getBlobbiMood(newStats);

      // Update evolution progress
      const updatedProgress = updateEvolutionProgress(blobbi, action);

      // Create updated Blobbi
      const updatedBlobbi: Blobbi = {
        ...blobbi,
        lastInteraction: Date.now(),
        stats: newStats,
        experience: blobbi.experience + experienceGained,
        evolutionProgress: updatedProgress,
        careStreak: Math.max(blobbi.careStreak, updatedProgress.currentStreak),
      };

      // Create interaction record
      await createInteraction(interactionData);

      // Update state
      await updateState(updatedBlobbi);

      // Check for automatic evolution
      let autoEvolution: { updatedBlobbi: Blobbi } | null = null;
      if (lifecycleStatus.data?.isEligibleForEvolution) {
        if (blobbi.lifeStage === 'egg') {
          autoEvolution = await evolveMutation.mutateAsync({ 
            newStage: 'baby', 
            evolutionReason: 'Hatching requirements met through care' 
          });
        } else if (blobbi.lifeStage === 'baby' && updatedProgress.isEligibleForEvolution) {
          autoEvolution = await evolveMutation.mutateAsync({ 
            newStage: 'adult', 
            evolutionReason: 'Evolution requirements met through consistent care' 
          });
        }
      }

      return {
        updatedBlobbi: autoEvolution?.updatedBlobbi || updatedBlobbi,
        interaction: interactionData,
        autoEvolution,
        statChange,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status', blobbiId] });
    },
  });

  // Create special memory
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
        memoryDate: new Date().toISOString().split('T')[0],
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
  });

  return {
    // State
    blobbi,
    records,
    interactions,
    lifecycleStatus: lifecycleStatus.data,
    
    // Loading states
    isLoading: stateLoading || recordsLoading || interactionsLoading || lifecycleStatus.isLoading,
    
    // Actions
    performCare: performCareMutation.mutateAsync,
    evolve: evolveMutation.mutateAsync,
    createMemory: createMemoryMutation.mutateAsync,
    
    // Action states
    isPerformingCare: performCareMutation.isPending,
    isEvolving: evolveMutation.isPending,
    isCreatingMemory: createMemoryMutation.isPending,
  };
}

// Helper functions
function getActionCategory(action: string): string {
  switch (action) {
    case 'feed':
      return 'nutrition';
    case 'play':
      return 'enrichment';
    case 'clean':
      return 'hygiene';
    case 'rest':
      return 'recovery';
    case 'medicine':
      return 'healthcare';
    case 'warming':
    case 'checking':
      return 'care';
    case 'singing':
    case 'talking':
      return 'social';
    default:
      return 'general';
  }
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function getBlobbiMood(stats: BlobbiStats): string {
  const avgStat = (stats.hunger + stats.happiness + stats.energy + stats.hygiene) / 4;
  
  if (stats.health < 30) return 'sick';
  if (stats.hunger < 20) return 'hungry';
  if (stats.hygiene < 20) return 'dirty';
  if (stats.energy < 20) return 'sleepy';
  if (avgStat > 80) return 'happy';
  if (avgStat > 60) return 'playful';
  if (avgStat > 40) return 'neutral';
  return 'sad';
}