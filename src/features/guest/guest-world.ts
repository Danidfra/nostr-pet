/**
 * The guest world: the guest's records, kept and answered the way a relay
 * would, so the kit's hooks run over them unchanged. Pure functions over an
 * array; the store that persists them is `guest-store.ts`.
 *
 * Replaceable and addressable kinds (the Blobbi state 31124, the profile
 * 11125, a kind 0) replace by (kind, pubkey, d); everything else appends.
 * Receipts (kind 1124) are capped so the document stays small: the oldest
 * go first, and the Blobbi's state, where the care itself is recorded, is
 * never touched by the cap.
 */
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { matchFilters, type Filter } from 'nostr-tools/filter';
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';

/** How many non-replaceable records (care receipts) the world keeps. */
export const GUEST_RECEIPT_CAP = 240;

const isReplaceableKind = (kind: number) => kind === 0 || kind === 3 || (kind >= 10000 && kind < 20000) || (kind >= 30000 && kind < 40000);
const dOf = (event: NostrEvent) => event.tags.find(([n]) => n === 'd')?.[1] ?? '';

/** The world with `event` put in as a relay would store it. Does not mutate `events`. */
export function applyGuestEvent(events: readonly NostrEvent[], event: NostrEvent): NostrEvent[] {
  if (isReplaceableKind(event.kind)) {
    const d = dOf(event);
    const rest = events.filter((e) => !(e.kind === event.kind && e.pubkey === event.pubkey && dOf(e) === d));
    return [...rest, event];
  }
  const next = [...events, event];
  const appended = next.filter((e) => !isReplaceableKind(e.kind));
  if (appended.length <= GUEST_RECEIPT_CAP) return next;
  const drop = new Set(appended.slice(0, appended.length - GUEST_RECEIPT_CAP).map((e) => e.id));
  return next.filter((e) => !drop.has(e.id));
}

/** What a relay would answer: every record matching any filter, each once, newest first. */
export function queryGuestEvents(events: readonly NostrEvent[], filters: readonly NostrFilter[]): NostrEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => matchFilters(filters as Filter[], e) && !seen.has(e.id) && seen.add(e.id)).sort((a, b) => b.created_at - a.created_at);
}

/** True when every author the filter names is the guest: a question the guest world alone can answer. */
export function isAboutGuest(filter: NostrFilter, guestPubkey: string): boolean {
  return Array.isArray(filter.authors) && filter.authors.length > 0 && filter.authors.every((a) => a === guestPubkey);
}

/** The guest's latest Blobbi state, if any. */
export function guestBlobbiEvent(events: readonly NostrEvent[], d: string | null): NostrEvent | undefined {
  if (!d) return undefined;
  return events.filter((e) => e.kind === KIND_BLOBBI_STATE && dOf(e) === d).sort((a, b) => b.created_at - a.created_at)[0];
}

/** The guest's profile record, if any. */
export function guestProfileEvent(events: readonly NostrEvent[]): NostrEvent | undefined {
  return events.filter((e) => e.kind === KIND_BLOBBONAUT_PROFILE).sort((a, b) => b.created_at - a.created_at)[0];
}

/** The guest Blobbi and its name, for the words; "your Blobbi" where no record is readable (M15). */
export function guestBlobbiOf(doc: { events: readonly NostrEvent[]; blobbiD: string | null }): { blobbi: BlobbiCompanion | undefined; name: string } {
  const record = guestBlobbiEvent(doc.events, doc.blobbiD);
  const blobbi = record ? parseModernBlobbiEvent(record) : undefined;
  return { blobbi, name: blobbi?.name ?? 'your Blobbi' };
}
