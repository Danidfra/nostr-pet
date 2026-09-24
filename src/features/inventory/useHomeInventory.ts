/**
 * The player's items as the home sees them: read-only, from real Nostr state.
 *
 * Two reads, both through the app's relay pool:
 *
 *  1. every kind 31633 the player authored, plus every kind 1416 and 1417 they
 *     authored (spends and folds, any inventory), derived into balances;
 *  2. the kind 31632 definitions for the item addresses those balances name,
 *     fetched per TRUSTED issuer (`authors` + `#d`), never for anyone else.
 *
 * Nothing here publishes. The result is grouped by source (the game that
 * owns the inventory) and every item says whether THIS Blobbi could use it.
 *
 * Transport is the pool's: both reads reach the application relays and, by
 * kind and issuer, the ecosystem's read hints (`relay-hints.ts`), so an
 * inventory the Island or the Farm wrote elsewhere is still found. Being
 * served by a hinted relay trusts nothing; the checks below are unchanged.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrFilter } from '@nostrify/nostrify';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import {
  buildGameInventoryFilter,
  buildGameInventoryFoldFilter,
  buildGameInventorySpendFilter,
  buildGameItemDefinitionFilter,
  parseGameItemAddress,
  parseGameItemDefinition,
  type GameItemDefinition,
  type NostrEvent,
} from '@nostr-games/inventory';
import { deriveBalances, itemAddressesOf, uniqueEvents, type InventoryBalance } from './inventory-state';
import { itemUsability, resolveHomeItem, type HomeItem, type ItemUsability } from './item-model';
import { isTrustedIssuer } from './issuers';
import { knownSpendEvents } from './spend-ledger';
import type { InventorySource } from './sources';
import { timeoutSignal } from '@/lib/abort';

export const INVENTORY_QUERY_KEY = 'home-inventory';
export const DEFINITIONS_QUERY_KEY = 'item-definitions';

const READ_TIMEOUT_MS = 6_000;

/** The library's filters are plain objects shaped like NIP-01 filters; the pool wants its own type. */
export function asNostrFilters(filters: readonly object[]): NostrFilter[] {
  return filters as unknown as NostrFilter[];
}

export interface HomeInventoryItem {
  item: HomeItem;
  quantity: number;
  inventoryAddress: string;
  source: InventorySource;
  /** Whether the current Blobbi could use it now (stage, state, kind); quantity and balance aside. */
  usability: ItemUsability;
  /** The balance this item sits in could not be resolved: shown, not usable. */
  unverified: boolean;
}

export interface HomeInventorySection {
  source: InventorySource;
  inventoryAddress: string;
  resolution: InventoryBalance['resolution'];
  items: HomeInventoryItem[];
}

export interface HomeInventory {
  status: 'signed-out' | 'loading' | 'ready' | 'error';
  sections: HomeInventorySection[];
  /** Every item with a positive quantity, flattened, for counts and lookups. */
  items: HomeInventoryItem[];
  error: unknown;
  refresh: () => void;
  /** True while a refetch is running after data was shown. */
  isRefreshing: boolean;
}

export interface UseHomeInventoryOptions {
  pubkey: string | undefined;
  blobbi: Pick<BlobbiCompanion, 'stage' | 'state' | 'name'> | undefined;
}

/** Group item addresses by trusted issuer; addresses from anyone else are dropped (never fetched). */
export function definitionFilters(addresses: readonly string[]): NostrFilter[] {
  const byIssuer = new Map<string, string[]>();
  for (const address of addresses) {
    const parsed = parseGameItemAddress(address);
    if (!parsed || !isTrustedIssuer(parsed.pubkey)) continue;
    const list = byIssuer.get(parsed.pubkey) ?? [];
    if (!list.includes(parsed.itemId)) list.push(parsed.itemId);
    byIssuer.set(parsed.pubkey, list);
  }
  return asNostrFilters([...byIssuer.entries()].map(([issuer, itemIds]) => buildGameItemDefinitionFilter({ authors: [issuer], itemIds })));
}

/** Newest definition per address, permissive parse, issuer must match the address. */
export function indexDefinitions(events: readonly NostrEvent[]): Map<string, GameItemDefinition> {
  const map = new Map<string, GameItemDefinition>();
  for (const event of events) {
    const parsed = parseGameItemDefinition(event, { mode: 'permissive' });
    if (!parsed) continue;
    const current = map.get(parsed.address);
    if (!current || current.event.created_at < parsed.event.created_at) map.set(parsed.address, parsed);
  }
  return map;
}

export function useHomeInventory({ pubkey, blobbi }: UseHomeInventoryOptions): HomeInventory {
  const { nostr } = useNostr();

  const balances = useQuery({
    queryKey: [INVENTORY_QUERY_KEY, pubkey],
    enabled: !!pubkey,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      if (!pubkey) return [];
      const filters = asNostrFilters([
        buildGameInventoryFilter({ authors: [pubkey] }),
        buildGameInventorySpendFilter({ authors: [pubkey] }),
        buildGameInventoryFoldFilter({ authors: [pubkey] }),
      ]);
      const events = await nostr.query(filters, { signal: timeoutSignal(READ_TIMEOUT_MS, signal) });
      return deriveBalances({
        inventories: events.filter((e) => e.kind === 31633),
        spends: uniqueEvents(
          events.filter((e) => e.kind === 1416),
          knownSpendEvents(pubkey),
        ),
        folds: events.filter((e) => e.kind === 1417),
      });
    },
  });

  const addresses = useMemo(() => (balances.data ? itemAddressesOf(balances.data).sort() : []), [balances.data]);
  const definitions = useQuery({
    queryKey: [DEFINITIONS_QUERY_KEY, addresses],
    enabled: addresses.length > 0,
    staleTime: 60 * 60_000,
    queryFn: async ({ signal }) => {
      const filters = definitionFilters(addresses);
      if (filters.length === 0) return new Map<string, GameItemDefinition>();
      const events = await nostr.query(filters, { signal: timeoutSignal(READ_TIMEOUT_MS, signal) });
      return indexDefinitions(events);
    },
  });

  const sections = useMemo<HomeInventorySection[]>(() => {
    if (!balances.data) return [];
    const defs = definitions.data ?? new Map<string, GameItemDefinition>();
    return balances.data.map((balance) => ({
      source: balance.source,
      inventoryAddress: balance.inventory.address,
      resolution: balance.resolution,
      items: balance.items
        .filter((entry) => entry.quantity > 0)
        .map((entry) => {
          const item = resolveHomeItem(entry.address, defs.get(entry.address));
          return {
            item,
            quantity: entry.quantity,
            inventoryAddress: balance.inventory.address,
            source: balance.source,
            usability: blobbi ? itemUsability(item, blobbi) : { ok: false, reason: 'No Blobbi to use it on.' },
            unverified: balance.resolution !== 'resolved',
          };
        })
        .sort(compareItems),
    }));
  }, [balances.data, definitions.data, blobbi]);

  const items = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  const status: HomeInventory['status'] = !pubkey ? 'signed-out' : balances.isError ? 'error' : balances.data && (addresses.length === 0 || definitions.data || definitions.isError) ? 'ready' : 'loading';

  return {
    status,
    sections,
    items,
    error: balances.error ?? definitions.error,
    refresh: () => {
      void balances.refetch();
      void definitions.refetch();
    },
    isRefreshing: balances.isFetching && !!balances.data,
  };
}

const KIND_ORDER: Record<HomeItem['kind'], number> = { care: 0, cosmetic: 1, currency: 2, unknown: 3 };

/** Usable care items first, then the rest, alphabetically within a group. */
function compareItems(a: HomeInventoryItem, b: HomeInventoryItem): number {
  const usable = Number(b.usability.ok) - Number(a.usability.ok);
  if (usable !== 0) return usable;
  const kind = KIND_ORDER[a.item.kind] - KIND_ORDER[b.item.kind];
  if (kind !== 0) return kind;
  return a.item.name.localeCompare(b.item.name);
}
