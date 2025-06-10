import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbiState, useBlobbiRecords, useBlobbiInteractions } from '@/hooks/useBlobbiEvents';
import { useNostr } from '@/hooks/useNostr';
import { useNostrPublish } from '@/hooks/useNostrPublish';
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
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
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

      if (newStage === 'baby' && blobbi.lifeStage === 'egg') {
        // Handle hatching with dual-event emission
        const { processHatching } = await import('@/lib/blobbi-evolution');
        
        console.log('🐣 Starting hatching process for:', blobbi.name);
        console.log('🥚 Current egg state:', blobbi.lifeStage);
        
        const { hatchingRecord, updatedBlobbi } = processHatching(blobbi);

        console.log('📝 Creating kind 14921 hatching record...');
        // First, create the kind 14921 hatching record
        await createRecord({
          recordData: hatchingRecord,
          content: `${blobbi.name} has hatched! 🐣✨`,
        });

        console.log('📝 Creating kind 31124 baby state...');
        // Then, update the state with kind 31124 event (baby stage)
        // The createBlobbiStateEvent function should filter out egg-specific tags
        await updateState(updatedBlobbi);

        // Check and update Blobbanaut Profile with welcome_mission tag if needed
        try {
          console.log('🎯 Checking for welcome_mission tag...');
          
          // Import the profile parsing function
          const { parseBlobbonautProfileFromEvent, createBlobbonautProfileEvent } = await import('@/lib/blobbi-events');
          
          // Fetch current Blobbanaut Profile
          const signal = AbortSignal.timeout(5000);
          const profileId = `Blobbanaut-${user.pubkey.slice(0, 8)}`;
          const profileEvents = await nostr.query([{
            kinds: [31125], // Blobbanaut Profile
            '#d': [profileId],
            limit: 1,
          }], { signal });

          if (profileEvents.length > 0) {
            const currentProfileEvent = profileEvents[0];
            const currentProfile = parseBlobbonautProfileFromEvent(currentProfileEvent);
            
            if (currentProfile && !currentProfile.welcomeMissionStatus) {
              console.log('🎯 Adding welcome_mission tag to profile...');
              
              // Update the profile with welcome_mission status
              const updatedProfile = {
                ...currentProfile,
                welcomeMissionStatus: 'unclaimed' as const,
              };

              // Create the updated profile event
              const profileEventTemplate = createBlobbonautProfileEvent(updatedProfile);

              // Publish updated profile
              await publishEvent(profileEventTemplate);

              console.log('✅ Successfully added welcome_mission tag to profile');
            } else {
              console.log('ℹ️ User already has welcome_mission tag');
            }
          } else {
            console.log('⚠️ No Blobbanaut Profile found, skipping welcome_mission tag');
          }
        } catch (profileError) {
          console.error('⚠️ Failed to update profile with welcome_mission tag:', profileError);
          // Don't fail the entire hatch process if profile update fails
        }

        console.log('✅ Hatching process completed for:', blobbi.name);
        return { updatedBlobbi, evolutionRecord: hatchingRecord };
      } else {
        // Handle regular evolution (baby to adult)
        const { processEvolution } = await import('@/lib/blobbi-evolution');
        
        const { updatedBlobbi, evolutionRecord } = processEvolution(
          blobbi,
          newStage,
          evolutionReason
        );

        // Create evolution record
        await createRecord({
          recordData: evolutionRecord,
          content: `${blobbi.name} has evolved to ${evolutionRecord.evolutionStage}! 🌟`,
        });

        // Update state
        await updateState(updatedBlobbi);

        return { updatedBlobbi, evolutionRecord };
      }
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
      const { clampStat } = await import('@/lib/blobbi-events');
      const { applyDecay } = await import('@/lib/blobbi-decay');

      // Apply comprehensive decay system
      const decayedBlobbi = applyDecay(blobbi);
      const degradedStats = decayedBlobbi.stats;

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
          case 'rest':
            statChange = ['energy', Math.min(35, 100 - degradedStats.energy)];
            break;
          case 'warm':
            if (blobbi.lifeStage === 'egg') {
              // For eggs, warming affects eggTemperature instead of health
              statChange = ['happiness', 2]; // Small happiness boost
            } else {
              statChange = ['health', 5];
            }
            break;
          case 'check':
            statChange = ['happiness', 3];
            break;
          case 'sing':
            statChange = ['happiness', 8];
            break;
          case 'talk':
            statChange = ['happiness', 6];
            break;
          case 'medicine':
            if (blobbi.lifeStage === 'egg') {
              // For eggs, medicine strengthens shell health
              statChange = ['health', Math.min(25, 100 - degradedStats.health)];
            } else {
              // For baby/adult, normal health boost
              statChange = ['health', Math.min(20, 100 - degradedStats.health)];
            }
            break;
          case 'clean':
            if (blobbi.lifeStage === 'egg') {
              // For eggs, cleaning improves shell health
              statChange = ['health', Math.min(15, 100 - degradedStats.health)];
            } else {
              // For baby/adult, normal hygiene boost
              statChange = ['hygiene', Math.min(40, 100 - degradedStats.hygiene)];
            }
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

      // Handle egg-specific warming action
      let eggTemperatureUpdate = {};
      if (action === 'warm' && blobbi.lifeStage === 'egg') {
        const currentTemp = decayedBlobbi.eggTemperature || 50;
        const tempIncrease = Math.min(10, 100 - currentTemp);
        eggTemperatureUpdate = {
          eggTemperature: clampStat(currentTemp + tempIncrease)
        };
      }

      // Create updated Blobbi with decay applied
      const updatedBlobbi: Blobbi = {
        ...decayedBlobbi,
        lastInteraction: Math.floor(Date.now() / 1000),
        stats: newStats,
        experience: blobbi.experience + experienceGained,
        evolutionProgress: updatedProgress,
        careStreak: Math.max(blobbi.careStreak, updatedProgress.currentStreak),
        ...eggTemperatureUpdate,
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
    case 'rest':
      return 'recovery';
    case 'warm':
    case 'check':
    case 'medicine':
    case 'clean':
      return 'care';
    case 'sing':
    case 'talk':
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