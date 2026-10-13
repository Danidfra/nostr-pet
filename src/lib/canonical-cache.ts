/**
 * The Blobbi collection in the query cache never goes back in time (M13).
 *
 * Every write here (adoption, a hatch, care, an item) puts the event it
 * published into the cache and then, mostly, asks the relays again. A relay
 * that accepted the event a moment ago may not serve it yet, and answers
 * with the previous version (an egg for a Blobbi that just hatched) or with
 * nothing at all (a Blobbi just adopted). The kit's collection read replaces
 * the cache with whatever it got, so that answer would undo a write that
 * landed: the baby an egg again, the hatch offered twice, the new player
 * sent back to the way in.
 *
 * The rule is Nostr's own for an addressable event (kind 31124, one per
 * `d`): the newest `created_at` stands. An answer from the relays never
 * replaces a Blobbi with an OLDER version of itself, and one an answer did
 * not include is kept. Two versions of the same second (`created_at` is in
 * seconds) are not ordered by this: the answer is taken, as before. What
 * this app has just published always goes in (`markLocalWrite`): it is the
 * player's own act, landed, whatever another device's clock said. An update
 * from another device is newer, so it comes through as before; nothing is
 * synced less. The kit's hook and its contract are untouched: this is the
 * app's cache policy for the kit's query key (`setQueryDefaults`).
 */
import { replaceEqualDeep, type QueryClient } from '@tanstack/react-query';
import type { BlobbiCompanion } from '@blobbi-kit/core';

/** The kit's collection query key prefix (`useBlobbisCollection`). */
export const COLLECTION_QUERY_KEY = 'blobbi-collection';

interface CollectionData {
  companionsByD: Record<string, BlobbiCompanion>;
  companions: BlobbiCompanion[];
}

/** The events this app has just published and put in the cache itself: never refused. */
const localWrites = new WeakSet<object>();

/** Mark an event as this app's own write, just landed, before it goes into the cache. */
export function markLocalWrite(event: object): void {
  localWrites.add(event);
}

/** Whether `incoming` is an older version of the event than `known`: then it never replaces it. */
export function isOlder(incoming: { created_at: number }, known: { created_at: number }): boolean {
  return incoming.created_at < known.created_at;
}

function isCollection(data: unknown): data is CollectionData {
  return !!data && typeof data === 'object' && 'companionsByD' in data && 'companions' in data;
}

/** The next value of the collection, where no Blobbi is older than it was, and none known is dropped. */
export function mergeCollection(prev: unknown, next: unknown): unknown {
  if (!isCollection(prev) || !isCollection(next)) return next;
  let kept: Record<string, BlobbiCompanion> | null = null;
  for (const [d, known] of Object.entries(prev.companionsByD)) {
    const incoming = next.companionsByD[d];
    if (incoming && (localWrites.has(incoming.event) || !isOlder(incoming.event, known.event))) continue;
    kept ??= { ...next.companionsByD };
    kept[d] = known;
  }
  if (!kept) return next;
  // The kit's order: by address
  return { companionsByD: kept, companions: Object.values(kept).sort((a, b) => a.d.localeCompare(b.d)) };
}

const installed = new WeakSet<QueryClient>();

/** Install the rule on a query client, once. Safe to call on every render. */
export function keepCollectionCanonical(client: QueryClient): void {
  if (installed.has(client)) return;
  installed.add(client);
  client.setQueryDefaults([COLLECTION_QUERY_KEY], {
    // Still structurally shared, as by default: an unchanged answer keeps its references
    structuralSharing: (prev: unknown, next: unknown) => replaceEqualDeep(prev, mergeCollection(prev, next)),
  });
}
