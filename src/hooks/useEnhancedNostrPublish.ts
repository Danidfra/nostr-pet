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
  
  // Apply all stat changes from the interaction
  for (const statChangeTag of statChangeTags) {
    if (statChangeTag[1]) {
      const [statName, changeStr] = statChangeTag[1].split(':');
      const changeValue = parseInt(changeStr);
      
      if (statName && !isNaN(changeValue)) {
        // Handle egg_temperature separately since it's not part of BlobbiStats
        if (statName === 'egg_temperature') {
          const currentValue = updatedEggTemperature || 100; // Default to 100 if undefined (new eggs start at 100)
          updatedEggTemperature = clampStat(currentValue + changeValue);
        } else {
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

  // Create updated Blobbi
  const updatedBlobbi: Blobbi = {
    ...decayedBlobbi,
    lastInteraction: Date.now(),
    stats: updatedStats,
    experience: blobbi.experience + experienceGain,
    evolutionProgress: updatedEvolutionProgress,
    careStreak: Math.max(blobbi.careStreak, updatedEvolutionProgress.currentStreak),
    eggTemperature: updatedEggTemperature,
  };

  return updatedBlobbi;
}

// Export the original hook as well for backward compatibility
export { useNostrPublish } from './useNostrPublish';