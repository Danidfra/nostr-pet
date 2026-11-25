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
import { newestRevision } from '@/features/care/rename';
import type { NPool } from '@nostrify/nostrify';
import { ABSENCE_REQUIRED_RELAYS, BASE_RELAYS } from '@/config/relays';
import { canAskRelays } from '@/features/companion/pool-relays';
import { readCensus } from '@/lib/relay-census';
import { serializeBlobbiWrite } from '@/features/care/blobbi-writes';
import { PublishUnconfirmedError } from '@/lib/relay-transport';
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
import { t } from '@/i18n';
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
  // Taken only by a relay that does not count: it may be there; the same bytes are offered again, never new ones
  if (error instanceof PublishUnconfirmedError) return true;
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
      if (!pubkey) throw new Error(t('world.items.error.signIn'));
      const open = openRecordFor(pubkey, blobbiD);
      const resumed = !!open;

      // The Blobbi as the relays that count hold it: whether an effect landed, and what the next one builds on, never
      // rest on a revision only another relay took (an effect not confirmed). Complete on the real relays
      const readCompanion = async (): Promise<BlobbiCompanion> => {
        const pool: NPool = nostr;
        const networked: boolean = canAskRelays(pool);
        if (networked) {
          const census = await readCensus(pool, [{ kinds: [KIND_BLOBBI_STATE], authors: [pubkey], '#d': [blobbiD] }], { required: ABSENCE_REQUIRED_RELAYS, timeoutMs: FRESH_TIMEOUT_MS });
          if (!census.complete) throw new Error(t('world.items.error.incompleteRead'));
          const companion = newestRevision(census.events, pubkey, blobbiD);
          if (!companion) throw new Error(t('world.items.error.readLatest'));
          return companion;
        }
        const fresh = await fetchFreshEvent(nostr, { kinds: [KIND_BLOBBI_STATE], authors: [pubkey], '#d': [blobbiD] });
        if (!fresh || !isModernBlobbiEvent(fresh)) throw new Error(t('world.items.error.readLatest'));
        const companion = parseModernBlobbiEvent(fresh);
        if (!companion) throw new Error(t('world.items.error.readLatest'));
        return companion;
      };

      let record: SpendRecord;
      let item: HomeItem;

      if (open) {
        record = open;
        item = await resolveItemFor(nostr, open.itemAddress, knownRef.current);
      } else {
        item = entry.item;
        if (!item.care) throw new Error(t('world.items.error.cannotUse', { item: item.name }));
        const companion = await readCompanion();
        const usable = itemUsability(item, companion);
        if (!usable.ok) throw new Error(usable.reason ?? t('world.items.reason.notNow'));

        const balance = await freshBalance(nostr, pubkey, entry.inventoryAddress, item.address);
        if (balance === 'unresolved') throw new Error(t('world.items.error.unverified'));
        if (balance < 1) throw new Error(t('world.items.error.noneLeft', { item: item.name }));

        const template = buildGameInventorySpendEvent({
          inventoryAddress: entry.inventoryAddress,
          inventoryRelay: '',
          itemAddress: item.address,
          itemRelay: '',
          quantity: 1,
          purpose: `${item.care.action}:blobbi`,
          client: CLIENT_NAME,
          nonce: mintSpendNonce(),
          // Published (NIP-31): the event's own name, never the page's language
          alt: `Used ${item.definition?.name ?? item.name} on a Blobbi`,
        });
        const signed = await publisher.sign(template);
        const now = Date.now();
        record = { spendId: signed.id, inventoryAddress: entry.inventoryAddress, itemAddress: item.address, blobbiD, status: 'signed', event: signed, createdAt: now, updatedAt: now };
        if (!upsertRecord(pubkey, record)) throw new Error(t('world.items.error.notRecorded'));
      }

      // Establish the spend.
      if (record.status === 'signed' || record.status === 'unconfirmed') {
        const outcome = await establish(publisher, nostr, record.event);
        if (outcome === 'established') {
          updateStatus(pubkey, record.spendId, 'established');
          record = { ...record, status: 'established' };
        } else if (outcome === 'unconfirmed') {
          updateStatus(pubkey, record.spendId, 'unconfirmed');
          throw new Error(t('world.items.error.notConfirmed', { item: item.name }));
        } else {
          removeRecord(pubkey, record.spendId);
          throw new Error(t('world.items.error.refused', { reason: outcome.reason }));
        }
      }

      // Verify the spend before its effect: a complete read must show it applied, not rejected by a competing spend
      // (another device's use of the last one). Unknown stays established and is checked again on the next try
      if (record.status === 'established') {
        const verdict = await spendVerdict(nostr, pubkey, record);
        if (verdict === 'rejected') {
          removeRecord(pubkey, record.spendId);
          throw new Error(t('world.items.error.spendRejected', { item: item.name }));
        }
        if (verdict === 'unknown') throw new Error(t('world.items.error.verifyLater', { item: item.name }));
        updateStatus(pubkey, record.spendId, 'effect-pending');
        record = { ...record, status: 'effect-pending' };
      }

      // Apply the effect, exactly once, in turn with every other write of this Blobbi on this page (care, a rename)
      return serializeBlobbiWrite(pubkey, blobbiD, async () => {
        const companion = await readCompanion();
        const landed = appliedSpendId(companion.allTags) === record.spendId || (record.effect ? await effectLanded(nostr, record.effect) : false);
        if (landed) {
          updateStatus(pubkey, record.spendId, 'applied');
          return { item, action: item.care!.action, name: companion.name, statsChanged: {}, xpGained: 0, event: companion.event, spendId: record.spendId, resumed, alreadyApplied: true };
        }
        if (!item.care) throw new Error(t('world.items.error.cannotUse', { item: item.name }));
        const now = Math.floor(Date.now() / 1000);
        const plan = planItemUse(companion, item, record.spendId, now, { evolution: tallyCareInteraction(companion, pubkey) });
        // Signed and recorded before it is offered: a resume finds this very effect by id instead of applying another
        const signedEffect = await publisher.sign(plan.event);
        record = { ...record, status: 'effect-pending', effect: signedEffect, updatedAt: Date.now() };
        if (!upsertRecord(pubkey, record)) throw new Error(t('world.items.error.notRecorded'));
        let event: NostrEvent;
        try {
          await publisher.broadcast(signedEffect);
          event = signedEffect;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(t('world.items.error.careFailed', { item: item.name, message }));
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
      });
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
    /** The item an earlier, unfinished use of this Blobbi was for (its name), or null: shown as "still finishing". */
    openUseItem: (blobbiD: string): string | null => {
      const open = pubkey ? openRecordFor(pubkey, blobbiD) : undefined;
      if (!open) return null;
      return knownRef.current.find((k) => k.item.address === open.itemAddress)?.item.name ?? t('world.items.unknown');
    },
  };
}

type Nostr = ReturnType<typeof useNostr>['nostr'];

/** The player's inventory, its spends and folds: from every relay that counts, to EOSE, on the real relays. */
async function readInventory(nostr: Nostr, pubkey: string, inventoryAddress: string): Promise<NostrEvent[]> {
  const parsed = parseGameInventoryAddress(inventoryAddress);
  if (!parsed || parsed.pubkey !== pubkey) throw new Error(t('world.items.error.notYours'));
  const filters = asNostrFilters([
    buildGameInventoryFilter({ authors: [pubkey], inventoryIds: [parsed.inventoryId] }),
    buildGameInventorySpendFilter({ authors: [pubkey], inventoryAddresses: [inventoryAddress] }),
    buildGameInventoryFoldFilter({ authors: [pubkey], inventoryAddresses: [inventoryAddress] }),
  ]);
  const pool: NPool = nostr;
  const networked: boolean = canAskRelays(pool);
  if (!networked) return pool.query(filters, { signal: timeoutSignal(FRESH_TIMEOUT_MS) });
  // A relay that counts and did not answer may hold a spend: the balance is unknown, nothing is spent on a guess
  const census = await readCensus(pool, filters, { required: ABSENCE_REQUIRED_RELAYS, others: BASE_RELAYS, timeoutMs: FRESH_TIMEOUT_MS });
  if (!census.complete) throw new Error(t('world.items.error.incompleteRead'));
  return census.events;
}

function balanceOf(events: readonly NostrEvent[], pubkey: string, inventoryAddress: string, extraSpends: readonly NostrEvent[] = []) {
  const balances = deriveBalances({
    inventories: events.filter((e) => e.kind === 31633),
    spends: uniqueEvents(
      events.filter((e) => e.kind === 1416),
      knownSpendEvents(pubkey),
      extraSpends,
    ),
    folds: events.filter((e) => e.kind === 1417),
  });
  return balances.find((b) => b.inventory.address === inventoryAddress);
}

/** The effective quantity of one item in one inventory, read fresh and complete. */
async function freshBalance(nostr: Nostr, pubkey: string, inventoryAddress: string, itemAddress: string): Promise<number | 'unresolved'> {
  const balance = balanceOf(await readInventory(nostr, pubkey, inventoryAddress), pubkey, inventoryAddress);
  if (!balance) return 0;
  if (balance.resolution !== 'resolved') return 'unresolved';
  return effectiveQuantity(balance, itemAddress);
}

/**
 * Whether an established spend took its unit: a complete read, derived in the library's deterministic order.
 * `rejected` (a competing spend took it, or the chain voided it), `applied`, or `unknown` (not resolvable now).
 * A competing spend that reaches the relays after this read can still change the answer: no read can rule it out.
 */
async function spendVerdict(nostr: Nostr, pubkey: string, record: SpendRecord): Promise<'applied' | 'rejected' | 'unknown'> {
  const balance = balanceOf(await readInventory(nostr, pubkey, record.inventoryAddress), pubkey, record.inventoryAddress, [record.event]);
  const derived = balance?.resolution === 'resolved' ? balance.derived : null;
  if (!derived) return 'unknown';
  const has = (list: readonly { id: string }[]) => list.some((s) => s.id === record.spendId);
  if (has(derived.applied) || has(derived.folded)) return 'applied';
  if (has(derived.rejected) || has(derived.voided)) return 'rejected';
  return 'unknown';
}

/** Whether this very effect event is on a relay that counts (looked up by id, to EOSE). */
async function effectLanded(nostr: Nostr, effect: NostrEvent): Promise<boolean> {
  const pool: NPool = nostr;
  const networked: boolean = canAskRelays(pool);
  if (!networked) return (await pool.query([{ ids: [effect.id], limit: 1 }])).some((e) => e.id === effect.id);
  const census = await readCensus(pool, [{ ids: [effect.id], limit: 1 }], { required: ABSENCE_REQUIRED_RELAYS, timeoutMs: FRESH_TIMEOUT_MS });
  if (census.events.some((e) => e.id === effect.id)) return true;
  // Not found, and not every relay that counts answered: it may be there; nothing is applied twice on a guess
  if (!census.complete) throw new Error(t('world.items.error.incompleteRead'));
  return false;
}

/** Offer the SAME signed bytes; classify what the relays said. */
async function establish(publisher: HomePublisher, nostr: Nostr, event: NostrEvent): Promise<'established' | 'unconfirmed' | { reason: string }> {
  try {
    await publisher.broadcast(event);
    return 'established';
  } catch (error) {
    // Found later on that same relay would prove nothing more: it stays a signed record, offered again as it is
    if (error instanceof PublishUnconfirmedError) return 'unconfirmed';
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
