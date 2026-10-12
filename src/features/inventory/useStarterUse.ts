/**
 * Using a STARTER item on the Blobbi: the care effect and nothing else.
 *
 * The owned path (`useUseItem`) is spend → establish → apply → receipt,
 * with a ledger for idempotency because two events cannot be atomic. A
 * starter consumes nothing, so there is no spend, no ledger and no
 * marker: read the fresh 31124, check the Blobbi can use the item, plan
 * the effect through the same kit path an owned copy takes
 * (`planItemUse` with no spend id), publish the 31124, then the 1124
 * naming the item. What is written is exactly the semantic care write; a
 * retry after a failed publish simply plans again from the fresh state.
 */
import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { KIND_BLOBBI_STATE, buildBlobbiAddress, fetchFreshEvent, isModernBlobbiEvent, parseModernBlobbiEvent, type BlobbiStats, type NostrEvent } from '@blobbi-kit/core';
import { usePublishAdapter } from '@/features/care/usePublishAdapter';
import { countCareForMissions } from '@/features/progression/daily-xp';
import { tallyCareInteraction } from '@/features/lifecycle/mission-tally';
import { itemUsability, type HomeItem, type ItemAction } from './item-model';
import { planItemUse } from './item-use-plan';
import type { StarterEntry } from './starter-catalog';

export interface StarterUseResult {
  item: HomeItem;
  action: ItemAction;
  name: string;
  statsChanged: Partial<BlobbiStats>;
  xpGained: number;
  event: NostrEvent;
  /** Always null: a starter use has no spend. Here so both use results share a shape. */
  spendId: null;
  resumed: false;
  alreadyApplied: false;
}

export interface StarterUseRequest {
  entry: StarterEntry;
  blobbiD: string;
}

interface UseStarterUseOptions {
  pubkey: string | undefined;
  updateCompanionEvent: (event: NostrEvent) => void;
  invalidate: () => void;
}

export function useStarterUse({ pubkey, updateCompanionEvent, invalidate }: UseStarterUseOptions) {
  const { nostr } = useNostr();
  const publisher = usePublishAdapter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<StarterUseRequest | null>(null);
  const inFlightRef = useRef(false);

  const mutation = useMutation<StarterUseResult, Error, StarterUseRequest>({
    mutationFn: async ({ entry, blobbiD }) => {
      if (!pubkey) throw new Error('Sign in to care for your Blobbi.');
      const item = entry.item;
      if (!item.care) throw new Error(`${item.name} cannot be used on a Blobbi.`);
      const fresh = await fetchFreshEvent(nostr, { kinds: [KIND_BLOBBI_STATE], authors: [pubkey], '#d': [blobbiD] });
      if (!fresh || !isModernBlobbiEvent(fresh)) throw new Error('Could not read the latest state of your Blobbi.');
      const companion = parseModernBlobbiEvent(fresh);
      if (!companion) throw new Error('Could not read the latest state of your Blobbi.');
      const usable = itemUsability(item, companion);
      if (!usable.ok) throw new Error(usable.reason ?? 'Not right now.');

      const now = Math.floor(Date.now() / 1000);
      const plan = planItemUse(companion, item, null, now, { evolution: tallyCareInteraction(companion, pubkey) });
      const event = await publisher.publish(plan.event);
      updateCompanionEvent(event);
      // Landed: today's missions count it
      countCareForMissions(pubkey, item.care.action);
      void publisher.publish(plan.interaction).catch(() => {
        /* the receipt is informational */
      });
      queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', buildBlobbiAddress(pubkey, blobbiD)] });
      return { item, action: item.care.action, name: companion.name, statsChanged: plan.statsChanged, xpGained: plan.xpGained, event, spendId: null, resumed: false, alreadyApplied: false };
    },
    onSettled: () => {
      inFlightRef.current = false;
      setPending(null);
      invalidate();
    },
  });

  const { mutate, isPending } = mutation;
  const use = useCallback(
    (request: StarterUseRequest): boolean => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      setPending(request);
      mutate(request);
      return true;
    },
    [mutate],
  );

  return { use, pending: isPending ? pending : null, isPending, lastResult: mutation.data, error: mutation.error, reset: mutation.reset };
}
