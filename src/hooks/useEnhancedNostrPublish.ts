import { useNostr } from "@nostrify/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { BLOBBI_EVENT_KINDS, createBlobbiStateEvent, parseBlobbiFromStateEvent } from "@/lib/blobbi-events";
import { ensureBlobbiTagsWithDebug } from "@/lib/blobbi-tags";
import { Blobbi, BlobbiStats } from "@/types/blobbi";
import { clampStat } from "@/lib/blobbi-events";
import { NostrEvent } from "@nostrify/nostrify";

interface EventTemplate {
  kind: number;
  content?: string;
  tags?: string[][];
  created_at?: number;
}

interface InteractionEventTemplate extends EventTemplate {
  kind: 14919; // Interaction event
}

export function useEnhancedNostrPublish() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (t: EventTemplate) => {
      if (!user) {
        throw new Error("User is not logged in");
      }

      let tags = t.tags ?? [];

      // Add client tag if it doesn't exist
      if (!tags.some((tag) => tag[0] === "client")) {
        tags.push(["client", "blobbi"]);
      }

      // Add Blobbi tags for Blobbi events
      const BLOBBI_EVENT_KINDS_SET = new Set([
        BLOBBI_EVENT_KINDS?.STATE || 31124,
        BLOBBI_EVENT_KINDS?.INTERACTION || 14919,
        BLOBBI_EVENT_KINDS?.RECORD || 14921,
        BLOBBI_EVENT_KINDS?.BREEDING || 14920,
        BLOBBI_EVENT_KINDS?.BLOBBANAUT_PROFILE || 31125,
        // Also include kind:1 for Blobbi social posts
        1,
      ]);

      if (BLOBBI_EVENT_KINDS_SET.has(t.kind)) {
        const hasEcosystemTag = tags.some(
          (tag) => tag[0] === "b" && tag[1] === "blobbi:ecosystem:v1"
        );
        const hasTopicTag = tags.some(
          (tag) => tag[0] === "t" && tag[1]?.toLowerCase() === "blobbi"
        );

        if (!hasEcosystemTag || !hasTopicTag) {
          console.warn(`[Blobbi Enhanced] Adding Blobbi tags to kind:${t.kind} event`);
          tags = ensureBlobbiTagsWithDebug(tags, 'useEnhancedNostrPublish', t.kind);
        }
      }

      const event = await user.signer.signEvent({
        kind: t.kind,
        content: t.content ?? "",
        tags,
        created_at: t.created_at ?? Math.floor(Date.now() / 1000),
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });

      // If this is an interaction event (kind 14919), automatically generate/update state event
      // unless it has the no_auto_state tag (used by sleep system to prevent duplicate state events)
      if (t.kind === BLOBBI_EVENT_KINDS.INTERACTION && !tags.some(tag => tag[0] === 'no_auto_state')) {
        await handleInteractionStateUpdate(event, nostr, user);
      }

      return event;
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {
      console.log("Event published successfully:", data);

      // Targeted query invalidation based on event type
      if (data.kind === BLOBBI_EVENT_KINDS.INTERACTION) {
        const blobbiId = data.tags.find(tag => tag[0] === 'blobbi_id')?.[1];
        if (blobbiId) {
          // Invalidate all essential queries for interactions
          queryClient.invalidateQueries({ queryKey: ['blobbi-state', blobbiId] });
          queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', blobbiId] });
          queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status', blobbiId] });
        }
      } else if (data.kind === BLOBBI_EVENT_KINDS.STATE) {
        const blobbiId = data.tags.find(tag => tag[0] === 'd')?.[1];
        if (blobbiId && user) {
          // For state events, invalidate all related queries
          queryClient.invalidateQueries({ queryKey: ['user-blobbis', user.pubkey] });
          queryClient.invalidateQueries({ queryKey: ['blobbi-by-id', blobbiId] });
          // Critical: Invalidate the detail page's blobbi-state query with all variations
          queryClient.invalidateQueries({ queryKey: ['blobbi-state', blobbiId] });
          queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status', blobbiId] });
        }
      }
    },
  });
}

async function handleInteractionStateUpdate(
  interactionEvent: NostrEvent,
  nostr: { query: (filters: unknown[], options?: { signal?: AbortSignal }) => Promise<NostrEvent[]>; event: (event: NostrEvent, options?: { signal?: AbortSignal }) => Promise<void>; },
  user: { pubkey: string; signer: { signEvent: (event: Partial<NostrEvent>) => Promise<NostrEvent>; }; }
) {
  try {
    // Extract blobbi_id from interaction event
    const blobbiId = interactionEvent.tags.find((tag: string[]) => tag[0] === 'blobbi_id')?.[1];
    if (!blobbiId) {
      console.warn('Interaction event missing blobbi_id tag');
      return;
    }

    // Fetch current Blobbi state
    const signal = AbortSignal.timeout(3000);
    const stateEvents = await nostr.query([
      {
        kinds: [BLOBBI_EVENT_KINDS.STATE],
        authors: [user.pubkey],
        '#d': [blobbiId],
        limit: 1,
      }
    ], { signal });

    const currentStateEvent = stateEvents[0];
    if (!currentStateEvent) {
      console.warn('No current state found for Blobbi:', blobbiId);
      return;
    }

    // Parse current Blobbi state
    const currentBlobbi = parseBlobbiFromStateEvent(currentStateEvent);
    if (!currentBlobbi) {
      console.warn('Failed to parse current Blobbi state');
      return;
    }

    // Apply stat changes from interaction
    const updatedBlobbi = await applyInteractionChanges(currentBlobbi, interactionEvent);

    // Create base state event data
    const stateEventData = createBlobbiStateEvent(updatedBlobbi);

    // Check if we need to update interact_6 progress for this interaction
    const taskProgressUpdate = await calculateInteract6Progress(
      currentBlobbi,
      interactionEvent,
      currentStateEvent.tags
    );

    // CRITICAL FIX: Use mergeBlobbiStateTags to preserve incubation/quest tags AND add task updates
    const { mergeBlobbiStateTags } = await import('@/lib/blobbi-state-merge');
    const mergeOptions: any = {
      // Preserve existing incubation/quest tags
      additionalTags: stateEventData.tags,
    };

    // Add task progress updates if applicable
    if (taskProgressUpdate) {
      if (taskProgressUpdate.updateProgress) {
        mergeOptions.updateTaskProgress = {
          taskId: 'interact_6',
          progress: taskProgressUpdate.newProgress
        };
      }
      if (taskProgressUpdate.addConfirmation) {
        mergeOptions.addConfirmedTaskId = 'interact_6';
      }
      if (taskProgressUpdate.updateLastInteractionTime) {
        mergeOptions.additionalTags = [
          ...stateEventData.tags,
          ['last_interaction_time', interactionEvent.created_at.toString()]
        ];
      }
    }

    const mergedTags = mergeBlobbiStateTags(currentStateEvent.tags, mergeOptions);

    const stateEvent = await user.signer.signEvent({
      kind: stateEventData.kind,
      content: stateEventData.content,
      tags: mergedTags,
      created_at: Math.floor(Date.now() / 1000),
    });

    await nostr.event(stateEvent, { signal: AbortSignal.timeout(5000) });

    console.log('✅ Auto-generated state event for interaction:', {
      blobbiId,
      interaction: interactionEvent.id,
      state: stateEvent.id,
      taskProgressIncluded: !!taskProgressUpdate,
      ...(taskProgressUpdate && {
        taskProgress: {
          newProgress: taskProgressUpdate.newProgress,
          confirmed: taskProgressUpdate.addConfirmation,
          lastInteractionUpdated: taskProgressUpdate.updateLastInteractionTime
        }
      })
    });

  } catch (error) {
    console.error('Failed to auto-generate state event for interaction:', error);
    // Don't throw - interaction event was already published successfully
  }
}

async function applyInteractionChanges(blobbi: Blobbi, interactionEvent: NostrEvent): Promise<Blobbi> {
  // Extract interaction data from tags
  const tags = interactionEvent.tags;
  const action = tags.find((tag: string[]) => tag[0] === 'action')?.[1];
  const statChangeTags = tags.filter((tag: string[]) => tag[0] === 'stat_change');
  const experienceGainedTag = tags.find((tag: string[]) => tag[0] === 'experience_gained')?.[1];
  const gameType = tags.find((tag: string[]) => tag[0] === 'game_type')?.[1];
  const playDuration = tags.find((tag: string[]) => tag[0] === 'play_duration')?.[1];

  // Apply decay first
  const { applyDecay } = await import('@/lib/blobbi-decay');
  const decayedBlobbi = applyDecay(blobbi);

  // Parse multiple stat changes
  const updatedStats = { ...decayedBlobbi.stats };
  let updatedEggTemperature = decayedBlobbi.eggTemperature;
  let updatedShellIntegrity = decayedBlobbi.shellIntegrity;

  // Apply all stat changes from the interaction
  for (const statChangeTag of statChangeTags) {
    if (statChangeTag[1]) {
      const [statName, changeStr] = statChangeTag[1].split(':');
      // Handle both "+X" and "X" formats, and negative values like "-X"
      const changeValue = parseInt(changeStr.replace(/^\+/, ''));

      if (statName && !isNaN(changeValue)) {
        // Handle egg_temperature separately since it's not part of BlobbiStats
        if (statName === 'egg_temperature') {
          const currentValue = updatedEggTemperature || 100; // Default to 100 if undefined (new eggs start at 100)
          updatedEggTemperature = clampStat(currentValue + changeValue);
        }
        // Handle shell_integrity separately since it's not part of BlobbiStats
        else if (statName === 'shell_integrity') {
          const currentValue = updatedShellIntegrity || 100; // Default to 100 if undefined (new eggs start at 100)
          updatedShellIntegrity = clampStat(currentValue + changeValue);
        }
        // Special handling for medicine action on eggs
        else if (statName === 'health' && action === 'medicine' && decayedBlobbi.lifeStage === 'egg') {
          // For eggs, medicine should restore shell_integrity instead of health
          const currentValue = updatedShellIntegrity || 100;
          updatedShellIntegrity = clampStat(currentValue + changeValue);
        }
        else {
          // Handle regular stats
          const currentValue = updatedStats[statName as keyof BlobbiStats] || 0;
          updatedStats[statName as keyof BlobbiStats] = clampStat(currentValue + changeValue);
        }
      }
    }
  }

  // Calculate experience gain
  let experienceGain = 0;
  if (experienceGainedTag) {
    experienceGain = parseInt(experienceGainedTag) || 0;
  } else {
    // Default experience based on action
    switch (action) {
      case 'play':
        experienceGain = gameType ? 10 : 5; // More XP for games
        break;
      case 'feed':
      case 'clean':
      case 'rest':
        experienceGain = 3;
        break;
      default:
        experienceGain = 2;
    }
  }

  // Update evolution progress if this is a care action
  let updatedEvolutionProgress = { ...blobbi.evolutionProgress };
  if (['feed', 'play', 'clean', 'rest', 'warm', 'medicine'].includes(action || '')) {
    const { updateEvolutionProgress } = await import('@/lib/blobbi-evolution');
    updatedEvolutionProgress = updateEvolutionProgress(blobbi, action || '');
  }

  // Update last_* timestamp fields based on the action
  // Use Unix timestamp in seconds (same format as Nostr's created_at)
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const updatedBlobbi: Blobbi = {
    ...decayedBlobbi,
    lastInteraction: currentTimestamp,
    stats: updatedStats,
    experience: blobbi.experience + experienceGain,
    evolutionProgress: updatedEvolutionProgress,
    careStreak: Math.max(blobbi.careStreak, updatedEvolutionProgress.currentStreak),
    eggTemperature: updatedEggTemperature,
    shellIntegrity: updatedShellIntegrity,
  };

  if (action === 'wake') {
    updatedBlobbi.isSleeping = false;
    updatedBlobbi.state = 'active';
    updatedBlobbi.sleepStartedAt = undefined;
    updatedBlobbi.lastSleepUpdate = undefined;
  }

  // ⚠️ IMPORTANT: Handle last_sleep_update tag logic
  // If this is a manual wake action (kind 14919), remove the lastSleepUpdate field
  // This ensures the tag is not present in the next kind 31124 state event
  if (action === 'rest' && tags.find(tag => tag[0] === 'wake_action' && tag[1] === 'explicit_user_interaction')) {
    // Manual wake - remove lastSleepUpdate to remove the tag from future state events
    updatedBlobbi.lastSleepUpdate = undefined;
    updatedBlobbi.isSleeping = false;
    updatedBlobbi.state = 'active';
    updatedBlobbi.sleepStartedAt = undefined;
  }
  // If this is a passive rest recovery, update lastSleepUpdate timestamp
  else if (action === 'rest' && tags.find(tag => tag[0] === 'recovery_type' && (tag[1] === 'passive_sleep' || tag[1] === 'active_sleep'))) {
    // Passive recovery - update lastSleepUpdate to current timestamp
    updatedBlobbi.lastSleepUpdate = currentTimestamp;
  }

  // Update corresponding last_* timestamp based on action type
  switch (action) {
    case 'warm':
      updatedBlobbi.lastWarm = currentTimestamp;
      break;
    case 'talk':
      updatedBlobbi.lastTalk = currentTimestamp;
      break;
    case 'sing':
      updatedBlobbi.lastSing = currentTimestamp;
      break;
    case 'check':
      updatedBlobbi.lastCheck = currentTimestamp;
      break;
    case 'medicine':
      updatedBlobbi.lastMedicine = currentTimestamp;
      break;
    case 'clean':
      updatedBlobbi.lastClean = currentTimestamp;
      break;
    case 'feed':
      updatedBlobbi.lastMeal = currentTimestamp;
      break;
    // Note: 'rest', 'play', and 'cruzar' don't have corresponding last_* fields in the Blobbi type
    // but they still update lastInteraction which is handled above
  }

  return updatedBlobbi;
}

/**
 * Calculate interact_6 progress updates for egg stage Blobbis
 */
async function calculateInteract6Progress(
  currentBlobbi: Blobbi,
  interactionEvent: NostrEvent,
  currentTags: string[][]
): Promise<{
  updateProgress: boolean;
  newProgress: number;
  addConfirmation: boolean;
  updateLastInteractionTime: boolean;
} | null> {
  // Only process valid egg interaction actions
  const actionTag = interactionEvent.tags.find(tag => tag[0] === 'action');
  const action = actionTag?.[1];
  const validEggActions = ['warm', 'check', 'sing', 'talk', 'medicine', 'clean'];

  if (!action || !validEggActions.includes(action)) {
    console.log(`⏭️ Action ${action} not valid for interact_6 task`);
    return null;
  }

  // Check if this is an egg
  if (currentBlobbi.lifeStage !== 'egg') {
    console.log(`⏭️ Blobbi ${currentBlobbi.id} is not an egg (stage: ${currentBlobbi.lifeStage}), skipping interact_6 progress`);
    return null;
  }

  // Check if start_incubation tag exists
  const { extractTagValues } = await import('@/lib/blobbi-state-merge');
  const startIncubationTags = extractTagValues({ tags: currentTags } as any, 'start_incubation');
  if (startIncubationTags.length === 0) {
    console.log(`⏭️ No start_incubation tag for ${currentBlobbi.id}, skipping interact_6 progress`);
    return null;
  }

  // Check if already confirmed
  const interact6ConfirmedTag = currentTags.find(tag => tag[0] === 'interact_6_confirmed');
  if (interact6ConfirmedTag) {
    console.log(`⏭️ interact_6 already confirmed for ${currentBlobbi.id}, skipping progress`);
    return null;
  }

  // Get current progress
  const interact6ProgressTag = currentTags.find(tag => tag[0] === 'interact_6_progress');
  const currentProgress = interact6ProgressTag ? parseInt(interact6ProgressTag[1]) : 0;

  // Get last interaction time for cooldown check
  const lastInteractionTag = currentTags.find(tag => tag[0] === 'last_interaction_time');
  const lastInteractionTime = lastInteractionTag ? parseInt(lastInteractionTag[1]) : 0;

  // Check 3-second cooldown (both timestamps are in seconds)
  const interactionTimestamp = interactionEvent.created_at;
  const cooldownPassed = interactionTimestamp - lastInteractionTime >= 3;

  console.log(`⏱️ Cooldown check: current=${interactionTimestamp}, last=${lastInteractionTime}, diff=${interactionTimestamp - lastInteractionTime}, passed=${cooldownPassed}`);

  if (!cooldownPassed) {
    console.log(`⏭️ Cooldown not passed for ${currentBlobbi.id}, skipping interact_6 progress`);
    return null;
  }

  // Increment progress
  const newProgress = currentProgress + 1;
  console.log(`📈 Updating interact_6 progress: ${currentProgress} → ${newProgress}${newProgress >= 6 ? ' (COMPLETED)' : ''}`);

  return {
    updateProgress: true,
    newProgress,
    addConfirmation: newProgress >= 6,
    updateLastInteractionTime: true,
  };
}

// Export the original hook as well for backward compatibility
export { useNostrPublish } from './useNostrPublish';