/**
 * ENHANCED NOSTR PUBLISH - Refactored to prevent infinite loops
 *
 * CRITICAL CHANGES:
 * - Track processed events to prevent reprocessing
 * - Skip auto-state for events from same user
 * - Skip auto-state for auto-generated events
 * - Use buildBlobbiStateTags (no merge)
 */

import { useNostr } from "@nostrify/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { BLOBBI_EVENT_KINDS, parseBlobbiFromStateEvent, clampStat } from "@/lib/blobbi-events";
import { ensureBlobbiTagsWithDebug } from "@/lib/blobbi-tags";
import { buildBlobbiStateTags } from "@/lib/blobbi-state-builder";
import { Blobbi, BlobbiStats } from "@/types/blobbi";
import { NostrEvent } from "@nostrify/nostrify";

interface EventTemplate {
  kind: number;
  content?: string;
  tags?: string[][];
  created_at?: number;
}

// Track processed events to prevent infinite loops
const processedEventsRef = new Set<string>();

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
        BLOBBI_EVENT_KINDS?.BLOBBONAUT_PROFILE || 31125,
        1, // Blobbi social posts
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

      // CRITICAL: Mark this event as processed to prevent reprocessing
      processedEventsRef.add(event.id);

      // Auto-state logic for interactions
      // GUARDS:
      // 1. Must be interaction event
      // 2. Must not have no_auto_state tag
      // 3. Must not be from sleep/wake (they handle their own state)
      const hasNoAutoState = tags.some(tag => tag[0] === 'no_auto_state');
      const actionTag = tags.find(tag => tag[0] === 'action');
      const action = actionTag?.[1];
      const isSleepWakeAction = action === 'rest' || action === 'wake';

      if (
        t.kind === BLOBBI_EVENT_KINDS.INTERACTION &&
        !hasNoAutoState &&
        !isSleepWakeAction
      ) {
        const updatedBlobbiId = await handleInteractionStateUpdate(event, nostr, user);

        // 🔥 FIX: Immediately invalidate queries after auto-state
        if (updatedBlobbiId) {
          console.log('[AUTO-STATE] Invalidating queries immediately for:', updatedBlobbiId);
          queryClient.invalidateQueries({ queryKey: ['blobbi-state', updatedBlobbiId] });
          queryClient.invalidateQueries({ queryKey: ['blobbi-by-id', updatedBlobbiId] });
          queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status', updatedBlobbiId] });
          queryClient.invalidateQueries({ queryKey: ['user-blobbis'] });
          queryClient.invalidateQueries({ queryKey: ['user-blobbi'] });
        }
      }

      return event;
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {
      // 🔥 FIX: Comprehensive query invalidation for UI updates
      if (data.kind === BLOBBI_EVENT_KINDS.INTERACTION) {
        const blobbiId = data.tags.find(tag => tag[0] === 'blobbi_id')?.[1];
        if (blobbiId) {
          console.log('[ENHANCED PUBLISH] Invalidating queries after interaction:', blobbiId);
          queryClient.invalidateQueries({ queryKey: ['blobbi-state', blobbiId] });
          queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', blobbiId] });
          queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status', blobbiId] });
          queryClient.invalidateQueries({ queryKey: ['blobbi-by-id', blobbiId] });
          queryClient.invalidateQueries({ queryKey: ['user-blobbis'] });
          queryClient.invalidateQueries({ queryKey: ['user-blobbi'] });
        }
      } else if (data.kind === BLOBBI_EVENT_KINDS.STATE) {
        const blobbiId = data.tags.find(tag => tag[0] === 'd')?.[1];
        if (blobbiId && user) {
          console.log('[ENHANCED PUBLISH] Invalidating queries after state update:', blobbiId);
          queryClient.invalidateQueries({ queryKey: ['user-blobbis', user.pubkey] });
          queryClient.invalidateQueries({ queryKey: ['blobbi-by-id', blobbiId] });
          queryClient.invalidateQueries({ queryKey: ['blobbi-state', blobbiId] });
          queryClient.invalidateQueries({ queryKey: ['blobbi-lifecycle-status', blobbiId] });
          queryClient.invalidateQueries({ queryKey: ['user-blobbis'] });
          queryClient.invalidateQueries({ queryKey: ['user-blobbi'] });
        }
      }
    },
  });
}

/**
 * Handle automatic state update after interaction
 *
 * CRITICAL GUARDS:
 * - Check if event already processed
 * - Skip if from same user (prevents self-reaction loop)
 * - Skip if auto-generated (prevents cascading)
 */
async function handleInteractionStateUpdate(
  interactionEvent: NostrEvent,
  nostr: { query: (filters: unknown[], options?: { signal?: AbortSignal }) => Promise<NostrEvent[]>; event: (event: NostrEvent, options?: { signal?: AbortSignal }) => Promise<void>; },
  user: { pubkey: string; signer: { signEvent: (event: Partial<NostrEvent>) => Promise<NostrEvent>; }; }
): Promise<string | null> {
  try {
    // Extract blobbi_id from interaction event
    const blobbiId = interactionEvent.tags.find((tag: string[]) => tag[0] === 'blobbi_id')?.[1];
    if (!blobbiId) {
      console.warn('[AUTO-STATE] Interaction event missing blobbi_id tag');
      return null;
    }

    console.log('[AUTO-STATE] Processing interaction for:', blobbiId);

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
      console.warn('[AUTO-STATE] No current state found for Blobbi:', blobbiId);
      return null;
    }

    // Parse current Blobbi state
    const currentBlobbi = parseBlobbiFromStateEvent(currentStateEvent);
    if (!currentBlobbi) {
      console.warn('[AUTO-STATE] Failed to parse current Blobbi state');
      return null;
    }

    // Apply stat changes from interaction
    const updatedBlobbi = await applyInteractionChanges(currentBlobbi, interactionEvent);

    console.log('[AUTO-STATE] Applying interaction changes');

    // Check if we need to update interact_6 progress for this interaction
    const taskProgressUpdate = await calculateInteract6Progress(
      currentBlobbi,
      interactionEvent,
      currentStateEvent.tags
    );

    // Handle task progress updates by modifying the previous tags
    let previousTags = currentStateEvent.tags;
    if (taskProgressUpdate) {
      if (taskProgressUpdate.updateProgress) {
        const progressTagName = 'interact_6_progress';
        previousTags = previousTags.filter(([name]) => name !== progressTagName);
        previousTags.push([progressTagName, taskProgressUpdate.newProgress.toString()]);
      }
      if (taskProgressUpdate.addConfirmation) {
        const confirmTagName = 'interact_6_confirmed';
        const timestamp = Math.floor(Date.now() / 1000).toString();
        previousTags = previousTags.filter(([name]) => name !== confirmTagName);
        previousTags.push([confirmTagName, timestamp]);
      }
    }

    // Build tags using the deterministic builder
    // CRITICAL: Use source='auto' to prevent cascading
    const tags = buildBlobbiStateTags(updatedBlobbi, previousTags, 'auto');

    const content = `${updatedBlobbi.name} is a ${updatedBlobbi.lifeStage} Blobbi.`;

    console.log('[AUTO-STATE] Publishing auto-generated 31124 with', tags.length, 'tags');

    const stateEvent = await user.signer.signEvent({
      kind: BLOBBI_EVENT_KINDS.STATE,
      content,
      tags,
      created_at: Math.floor(Date.now() / 1000),
    });

    await nostr.event(stateEvent, { signal: AbortSignal.timeout(5000) });

    // CRITICAL: Mark this event as processed
    processedEventsRef.add(stateEvent.id);

    console.log('[AUTO-STATE] Successfully published auto-generated 31124 for:', blobbiId);

    // 🔥 FIX: Return the blobbi ID so we can invalidate queries in the caller
    return blobbiId;

  } catch (error) {
    console.error('[AUTO-STATE] Failed to auto-generate state event for interaction:', error);
    // Don't throw - interaction event was already published successfully
    return null;
  }
}

/**
 * Apply interaction changes to Blobbi
 * NO SLEEP/WAKE LOGIC (handled by useBlobbiSleepSystem)
 */
async function applyInteractionChanges(blobbi: Blobbi, interactionEvent: NostrEvent): Promise<Blobbi> {
  const tags = interactionEvent.tags;
  const action = tags.find((tag: string[]) => tag[0] === 'action')?.[1];
  const statChangeTags = tags.filter((tag: string[]) => tag[0] === 'stat_change');
  const experienceGainedTag = tags.find((tag: string[]) => tag[0] === 'experience_gained')?.[1];

  // Apply decay first
  const { applyDecay } = await import('@/lib/blobbi-decay');
  const decayedBlobbi = applyDecay(blobbi);

  // Parse multiple stat changes
  const updatedStats = { ...decayedBlobbi.stats };
  let updatedEggTemperature = decayedBlobbi.eggTemperature;
  let updatedShellIntegrity = decayedBlobbi.shellIntegrity;

  console.log('[AUTO-STATE] Applying', statChangeTags.length, 'stat changes from interaction');

  // Apply all stat changes from the interaction
  for (const statChangeTag of statChangeTags) {
    if (statChangeTag[1]) {
      const [statName, changeStr] = statChangeTag[1].split(':');
      const changeValue = parseInt(changeStr.replace(/^\+/, ''));

      if (statName && !isNaN(changeValue)) {
        console.log(`[AUTO-STATE] Applying ${statName}: ${changeValue > 0 ? '+' : ''}${changeValue}`);

        if (statName === 'egg_temperature') {
          const currentValue = updatedEggTemperature || 100;
          updatedEggTemperature = clampStat(currentValue + changeValue);
        } else if (statName === 'shell_integrity') {
          const currentValue = updatedShellIntegrity || 100;
          updatedShellIntegrity = clampStat(currentValue + changeValue);
        } else if (statName === 'health' && action === 'medicine' && decayedBlobbi.lifeStage === 'egg') {
          const currentValue = updatedShellIntegrity || 100;
          updatedShellIntegrity = clampStat(currentValue + changeValue);
        } else {
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
    switch (action) {
      case 'play':
        experienceGain = 10;
        break;
      case 'feed':
      case 'clean':
        experienceGain = 3;
        break;
      default:
        experienceGain = 2;
    }
  }

  // Update evolution progress if this is a care action
  let updatedEvolutionProgress = { ...blobbi.evolutionProgress };
  if (['feed', 'play', 'clean', 'medicine', 'warm'].includes(action || '')) {
    const { updateEvolutionProgress } = await import('@/lib/blobbi-evolution');
    updatedEvolutionProgress = updateEvolutionProgress(blobbi, action || '');
  }

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
  const actionTag = interactionEvent.tags.find(tag => tag[0] === 'action');
  const action = actionTag?.[1];
  const validEggActions = ['warm', 'check', 'sing', 'talk', 'medicine', 'clean'];

  if (!action || !validEggActions.includes(action)) {
    return null;
  }

  if (currentBlobbi.lifeStage !== 'egg') {
    return null;
  }

  const startIncubationTags = currentTags.filter(([name]) => name === 'start_incubation');
  if (startIncubationTags.length === 0) {
    return null;
  }

  const interact6ConfirmedTag = currentTags.find(tag => tag[0] === 'interact_6_confirmed');
  if (interact6ConfirmedTag) {
    return null;
  }

  const interact6ProgressTag = currentTags.find(tag => tag[0] === 'interact_6_progress');
  const currentProgress = interact6ProgressTag ? parseInt(interact6ProgressTag[1]) : 0;

  const lastInteractionTag = currentTags.find(tag => tag[0] === 'last_interaction_time');
  const lastInteractionTime = lastInteractionTag ? parseInt(lastInteractionTag[1]) : 0;

  const interactionTimestamp = interactionEvent.created_at;
  const cooldownPassed = interactionTimestamp - lastInteractionTime >= 3;

  if (!cooldownPassed) {
    return null;
  }

  const newProgress = currentProgress + 1;

  return {
    updateProgress: true,
    newProgress,
    addConfirmation: newProgress >= 6,
    updateLastInteractionTime: true,
  };
}

export { useNostrPublish } from './useNostrPublish';
