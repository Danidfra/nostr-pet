/**
 * Using an item on the Blobbi: the one write path for a consumable.
 *
 * The home owns no inventory, so every inventory it shows belongs to another
 * game, and the only thing it may write about one is a kind 1416 spend. The
 * spend and the kind 31124 effect are two events that cannot be atomic, so
 * the order is chosen to make the residual failures the safe ones, and every
 * step is idempotent through the local ledger (`spend-ledger.ts`):
 *
 *   resume?      an open record for this Blobbi is finished first, same bytes
 *   verify       fresh 31124, fresh balance (snapshot + folds + spends);
 *                refuse if the Blobbi cannot use it or none is left
 *   sign         one kind 1416, one nonce; never re-signed
 *   record       the ledger row is written BEFORE any relay sees the event
 *   establish    one relay accepts → established
 *                all silent → look for the id → found: established;
 *                                               not found: unconfirmed (stop)
 *                all refuse → not published; record dropped; safe to sign anew
 *   apply        fresh 31124; `blobbi_op == spendId` → already applied
 *                else plan through the kit, republish with the marker
 *                failure → effect-pending (stop; resumed next time)
 *   receipt      best-effort kind 1124 pointing at the spend
 *
 * What the player can be told, honestly, at each stop is in the errors.
 */
import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import {
  KIND_BLOBBI_STATE,
  buildBlobbiAddress,
  fetchFreshEvent,
  isModernBlobbiEvent,
  parseModernBlobbiEvent,
  type BlobbiCompanion,
  type BlobbiStats,
  type NostrEvent,
} from '@blobbi-kit/core';
import {
  buildGameInventoryFilter,
  buildGameInventoryFoldFilter,
  buildGameInventorySpendEvent,
  buildGameInventorySpendFilter,
  parseGameInventoryAddress,
} from '@nostr-games/inventory';

import { CLIENT_NAME, usePublishAdapter, type HomePublisher } from '@/features/care/usePublishAdapter';
import { countCareForMissions } from '@/features/progression/daily-xp';
import { tallyCareInteraction } from '@/features/lifecycle/mission-tally';
import { timeoutSignal } from '@/lib/abort';
import { deriveBalances, effectiveQuantity, uniqueEvents } from './inventory-state';
import { itemUsability, resolveHomeItem, type HomeItem, type ItemAction } from './item-model';
import { appliedSpendId, planItemUse } from './item-use-plan';
import { knownSpendEvents, mintSpendNonce, openRecordFor, removeRecord, updateStatus, upsertRecord, type SpendRecord } from './spend-ledger';
import { INVENTORY_QUERY_KEY, asNostrFilters, definitionFilters, indexDefinitions, type HomeInventoryItem } from './useHomeInventory';

export interface ItemUseResult {
  item: HomeItem;
  action: ItemAction;
  name: string;
  statsChanged: Partial<BlobbiStats>;
  xpGained: number;
  event: NostrEvent;
  spendId: string;
  /** This call finished an earlier, interrupted use rather than starting the requested one. */
  resumed: boolean;
  /** The effect had already landed (a retry after an ambiguous write). */
  alreadyApplied: boolean;
}

export interface UseItemRequest {
  entry: HomeInventoryItem;
  blobbiD: string;
}

interface UseUseItemOptions {
  pubkey: string | undefined;
  /** Every item currently shown, so a resumed record can find its definition without a fetch. */
  known: readonly HomeInventoryItem[];
  updateCompanionEvent: (event: NostrEvent) => void;
  invalidate: () => void;
}

/** Errors that mean "the relays may or may not have it": keep the bytes, look for the id, retry the same event. */
export function isAmbiguousPublishError(error: unknown): boolean {
  const abortLike = (e: unknown) => {
    const name = (e as { name?: string })?.name ?? '';
    const message = (e as { message?: string })?.message ?? '';
    return /abort|timeout|timed out/i.test(name) || /abort|timeout|timed out|closed|network/i.test(message);
  };
  if (error instanceof AggregateError) {
    // A definite refusal from every relay is the only "not published"; one silent relay makes it ambiguous.
    return error.errors.length === 0 || error.errors.some(abortLike);
  }
  return abortLike(error) || !(error instanceof Error);
}

const FRESH_TIMEOUT_MS = 6_000;

export function useUseItem({ pubkey, known, updateCompanionEvent, invalidate }: UseUseItemOptions) {
  const { nostr } = useNostr();
  const publisher = usePublishAdapter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<UseItemRequest | null>(null);
  const inFlightRef = useRef(false);
  const knownRef = useRef(known);
  knownRef.current = known;

  const mutation = useMutation<ItemUseResult, Error, UseItemRequest>({
    mutationFn: async ({ entry, blobbiD }) => {
      if (!pubkey) throw new Error('Sign in to use an item.');
      const open = openRecordFor(pubkey, blobbiD);
      const resumed = !!open;

      const readCompanion = async (): Promise<BlobbiCompanion> => {
        const fresh = await fetchFreshEvent(nostr, { kinds: [KIND_BLOBBI_STATE], authors: [pubkey], '#d': [blobbiD] });
        if (!fresh || !isModernBlobbiEvent(fresh)) throw new Error('Could not read the latest state of your Blobbi.');
        const companion = parseModernBlobbiEvent(fresh);
        if (!companion) throw new Error('Could not read the latest state of your Blobbi.');
        return companion;
      };

      let record: SpendRecord;
      let item: HomeItem;

      if (open) {
        record = open;
        item = await resolveItemFor(nostr, open.itemAddress, knownRef.current);
      } else {
        item = entry.item;
        if (!item.care) throw new Error(`${item.name} cannot be used on a Blobbi.`);
        const companion = await readCompanion();
        const usable = itemUsability(item, companion);
        if (!usable.ok) throw new Error(usable.reason ?? 'Not right now.');

        const balance = await freshBalance(nostr, pubkey, entry.inventoryAddress, item.address);
        if (balance === 'unresolved') throw new Error("This inventory's balance can't be verified right now, so nothing was used.");
        if (balance < 1) throw new Error(`No ${item.name} left there.`);

        const template = buildGameInventorySpendEvent({
          inventoryAddress: entry.inventoryAddress,
          inventoryRelay: '',
          itemAddress: item.address,
          itemRelay: '',
          quantity: 1,
          purpose: `${item.care.action}:blobbi`,
          client: CLIENT_NAME,
          nonce: mintSpendNonce(),
          alt: `Used ${item.name} on a Blobbi`,
        });
        const signed = await publisher.sign(template);
        const now = Date.now();
        record = { spendId: signed.id, inventoryAddress: entry.inventoryAddress, itemAddress: item.address, blobbiD, status: 'signed', event: signed, createdAt: now, updatedAt: now };
        if (!upsertRecord(pubkey, record)) throw new Error('Could not record the use on this device, so nothing was sent.');
      }

      // Establish the spend.
      if (record.status === 'signed' || record.status === 'unconfirmed') {
        const outcome = await establish(publisher, nostr, record.event);
        if (outcome === 'established') {
          updateStatus(pubkey, record.spendId, 'established');
          record = { ...record, status: 'established' };
        } else if (outcome === 'unconfirmed') {
          updateStatus(pubkey, record.spendId, 'unconfirmed');
          throw new Error(`The relays did not confirm using ${item.name}. Nothing was consumed yet; tap it again to retry.`);
        } else {
          removeRecord(pubkey, record.spendId);
          throw new Error(`The relays refused the spend: ${outcome.reason}`);
        }
      }

      // Apply the effect, exactly once.
      const companion = await readCompanion();
      if (appliedSpendId(companion.allTags) === record.spendId) {
        updateStatus(pubkey, record.spendId, 'applied');
        return { item, action: item.care!.action, name: companion.name, statsChanged: {}, xpGained: 0, event: companion.event, spendId: record.spendId, resumed, alreadyApplied: true };
      }
      if (!item.care) throw new Error(`${item.name} cannot be used on a Blobbi.`);
      const now = Math.floor(Date.now() / 1000);
      const plan = planItemUse(companion, item, record.spendId, now, { evolution: tallyCareInteraction(companion, pubkey) });
      let event: NostrEvent;
      try {
        event = await publisher.publish(plan.event);
      } catch (error) {
        updateStatus(pubkey, record.spendId, 'effect-pending');
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${item.name} was taken from the inventory, but the care write failed (${message}). Tap it again to finish.`);
      }
      updateStatus(pubkey, record.spendId, 'applied');
      updateCompanionEvent(event);
      // Landed (and not one already applied): today's missions count it
      countCareForMissions(pubkey, item.care.action);

      void publisher.publish(plan.interaction).catch(() => {
        /* the receipt is informational */
      });
      queryClient.invalidateQueries({ queryKey: ['blobbi-interactions', buildBlobbiAddress(pubkey, blobbiD)] });

      return { item, action: item.care.action, name: companion.name, statsChanged: plan.statsChanged, xpGained: plan.xpGained, event, spendId: record.spendId, resumed, alreadyApplied: false };
    },
    onSettled: () => {
      inFlightRef.current = false;
      setPending(null);
      queryClient.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEY, pubkey] });
      invalidate();
    },
  });

  const { mutate, isPending } = mutation;
  /** Start using an item unless a use is in flight. Stable; returns whether it started. */
  const use = useCallback(
    (request: UseItemRequest): boolean => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      setPending(request);
      mutate(request);
      return true;
    },
    [mutate],
  );

  return {
    use,
    pending: isPending ? pending : null,
    isPending,
    lastResult: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
    /** Whether an earlier use of this Blobbi is waiting to be finished. */
    hasOpenUse: (blobbiD: string) => (pubkey ? openRecordFor(pubkey, blobbiD) !== undefined : false),
  };
}

type Nostr = ReturnType<typeof useNostr>['nostr'];

/** The effective quantity of one item in one inventory, read fresh from the relays. */
async function freshBalance(nostr: Nostr, pubkey: string, inventoryAddress: string, itemAddress: string): Promise<number | 'unresolved'> {
  const parsed = parseGameInventoryAddress(inventoryAddress);
  if (!parsed || parsed.pubkey !== pubkey) throw new Error('That inventory is not yours.');
  const filters = asNostrFilters([
    buildGameInventoryFilter({ authors: [pubkey], inventoryIds: [parsed.inventoryId] }),
    buildGameInventorySpendFilter({ authors: [pubkey], inventoryAddresses: [inventoryAddress] }),
    buildGameInventoryFoldFilter({ authors: [pubkey], inventoryAddresses: [inventoryAddress] }),
  ]);
  const events = await nostr.query(filters, { signal: timeoutSignal(FRESH_TIMEOUT_MS) });
  const balances = deriveBalances({
    inventories: events.filter((e) => e.kind === 31633),
    spends: uniqueEvents(
      events.filter((e) => e.kind === 1416),
      knownSpendEvents(pubkey),
    ),
    folds: events.filter((e) => e.kind === 1417),
  });
  const balance = balances.find((b) => b.inventory.address === inventoryAddress);
  if (!balance) return 0;
  if (balance.resolution !== 'resolved') return 'unresolved';
  return effectiveQuantity(balance, itemAddress);
}

/** Offer the SAME signed bytes; classify what the relays said. */
async function establish(publisher: HomePublisher, nostr: Nostr, event: NostrEvent): Promise<'established' | 'unconfirmed' | { reason: string }> {
  try {
    await publisher.broadcast(event);
    return 'established';
  } catch (error) {
    if (!isAmbiguousPublishError(error)) {
      const reason = error instanceof AggregateError ? (error.errors[0] as Error | undefined)?.message ?? 'refused' : error instanceof Error ? error.message : String(error);
      return { reason };
    }
  }
  try {
    const found = await nostr.query([{ ids: [event.id], limit: 1 }], { signal: timeoutSignal(FRESH_TIMEOUT_MS) });
    if (found.some((e) => e.id === event.id)) return 'established';
  } catch {
    /* silent relays again */
  }
  return 'unconfirmed';
}

/** The item behind an open record: from what is on screen, or one definition fetch. */
async function resolveItemFor(nostr: Nostr, address: string, known: readonly HomeInventoryItem[]): Promise<HomeItem> {
  const shown = known.find((k) => k.item.address === address);
  if (shown) return shown.item;
  const filters = definitionFilters([address]);
  if (filters.length === 0) return resolveHomeItem(address, null);
  const events = await nostr.query(filters, { signal: timeoutSignal(FRESH_TIMEOUT_MS) });
  return resolveHomeItem(address, indexDefinitions(events).get(address));
}
