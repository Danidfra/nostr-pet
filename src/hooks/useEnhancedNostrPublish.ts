import { useNostr } from "@nostrify/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { BLOBBI_EVENT_KINDS, createBlobbiStateEvent, parseBlobbiFromStateEvent } from "@/lib/blobbi-events";
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

      const tags = t.tags ?? [];

      // Add the client tag if it doesn't exist
      if (!tags.some((tag) => tag[0] === "client")) {
        tags.push(["client", "blobbi"]);
      }

      const event = await user.signer.signEvent({
        kind: t.kind,
        content: t.content ?? "",
        tags,
        created_at: t.created_at ?? Math.floor(Date.now() / 1000),
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });

      // If this is an interaction event (kind 14919), automatically generate/update state event
      if (t.kind === BLOBBI_EVENT_KINDS.INTERACTION) {
        await handleInteractionStateUpdate(event, nostr, user);
      }

      return event;
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {
      console.log("Event published successfully:", data);
      
      // Invalidate relevant queries
      if (data.kind === BLOBBI_EVENT_KINDS.INTERACTION) {
        const blobbiId = data.tags.find(tag => tag[0] === 'blobbi_id')?.[1];
        if (blobbiId) {
          queryClient.invalidateQueries({ queryKey: ['blobbi-state', blobbiId] });
          queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', blobbiId] });
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

    // Create and publish updated state event
    const stateEventData = createBlobbiStateEvent(updatedBlobbi);
    const stateEvent = await user.signer.signEvent({
      ...stateEventData,
      created_at: Math.floor(Date.now() / 1000),
    });

    await nostr.event(stateEvent, { signal: AbortSignal.timeout(5000) });
    
    console.log('Auto-generated state event for interaction:', {
      blobbiId,
      interaction: interactionEvent.id,
      state: stateEvent.id
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

// Export the original hook as well for backward compatibility
export { useNostrPublish } from './useNostrPublish';