import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import {
  KIND_BLOBBI_STATE,
  buildBlobbiAddress,
  emitInteractionEvent,
  fetchFreshEvent,
  isModernBlobbiEvent,
  parseModernBlobbiEvent,
  type BlobbiState,
  type BlobbiStats,
  type NostrEvent,
} from '@blobbi-kit/core';

import { countCareForMissions, countSleepForMissions } from '@/features/progression/daily-xp';
import { usePublishAdapter } from './usePublishAdapter';
import { availableCareActions, planCareAction, type CareAction } from './care-plan';
import { tallyCareInteraction } from '@/features/lifecycle/mission-tally';

export interface CareResult {
  action: CareAction;
  name: string;
  statsChanged: Partial<BlobbiStats>;
  xpGained: number;
  nextState: BlobbiState;
  event: NostrEvent;
}

interface UseCareActionsOptions {
  pubkey: string | undefined;
  /** The collection's cache updater: the published event becomes the shown state at once. */
  updateCompanionEvent: (event: NostrEvent) => void;
  /** The collection's relay refetch, so the home settles on relay-backed state. */
  invalidate: () => void;
}

/**
 * The care write, exactly in this order:
 *
 *   choose → fresh read of the kind 31124 → modern check → kit planning
 *   → sign → publish → cache update → interaction log → refetch
 *
 * The plan is computed from the FRESH event, never from what the screen
 * happened to show. One action runs at a time; a second click while one is in
 * flight is ignored. Nothing here runs on its own: every publish starts from
 * a button.
 */
export function useCareActions({ pubkey, updateCompanionEvent, invalidate }: UseCareActionsOptions) {
  const { nostr } = useNostr();
  const publisher = usePublishAdapter();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<CareAction | null>(null);
  /**
   * Live "a write is in flight" flag for `perform`. A ref, not the mutation's
   * `isPending`, so a `perform` captured earlier (by a walk that arrives
   * later, say) still sees the truth at the moment it is called.
   */
  const inFlightRef = useRef(false);

  const mutation = useMutation<CareResult, Error, { d: string; action: CareAction }>({
    mutationFn: async ({ d, action }) => {
      if (!pubkey) throw new Error('Sign in to care for your Blobbi.');

      const fresh = await fetchFreshEvent(nostr, { kinds: [KIND_BLOBBI_STATE], authors: [pubkey], '#d': [d] });
      if (!fresh || !isModernBlobbiEvent(fresh)) throw new Error('Could not read the latest state of your Blobbi.');
      const companion = parseModernBlobbiEvent(fresh);
      if (!companion) throw new Error('Could not read the latest state of your Blobbi.');

      const availability = availableCareActions(companion).find((a) => a.action === action);
      if (!availability?.available) throw new Error(availability?.reason ?? 'Not right now.');

      const now = Math.floor(Date.now() / 1000);
      // An interaction counts towards the active hatch or evolve missions;
      // the updated missions ride in the content of this same republish.
      const evolution = action === 'rest' ? undefined : tallyCareInteraction(companion, pubkey);
      const plan = planCareAction(companion, action, now, { evolution });

      const event = await publisher.publish(plan.event);
      updateCompanionEvent(event);
      // Landed: today's missions count it (a rest only when it put the Blobbi to bed)
      if (action === 'rest') {
        if (plan.nextState === 'sleeping') countSleepForMissions(pubkey);
      } else countCareForMissions(pubkey, action);

      if (plan.interaction) {
        // Best-effort log of the interaction (kind 1124), as every other host does.
        emitInteractionEvent((template) => publisher.publish(template), plan.interaction);
        queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', buildBlobbiAddress(pubkey, d)] });
      }

      return { action, name: companion.name, statsChanged: plan.statsChanged, xpGained: plan.xpGained, nextState: plan.nextState, event };
    },
    onSettled: () => {
      inFlightRef.current = false;
      setPendingAction(null);
      invalidate();
    },
  });

  const { mutate, isPending } = mutation;
  /** Start a care write unless one is in flight. Stable: safe to call from a delayed flow. Returns whether it started. */
  const perform = useCallback(
    (d: string, action: CareAction): boolean => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      setPendingAction(action);
      mutate({ d, action });
      return true;
    },
    [mutate],
  );

  return {
    perform,
    pendingAction: isPending ? pendingAction : null,
    isPending,
    lastResult: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}
