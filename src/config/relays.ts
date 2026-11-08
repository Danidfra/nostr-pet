/**
 * Relays, as URLs the home can compare.
 *
 * The standalone has four kinds of relay knowledge, and the first two are
 * configured here:
 *
 *  1. **the primary relay** (`PRIMARY_RELAY`, `wss://relay.blobbi.pet`): the
 *     Blobbi ecosystem's own relay, asked first and written first for the
 *     kinds it accepts (`PRIMARY_KINDS`), and for nothing else;
 *  2. **application relays** (`BASE_RELAYS`): the relays the home always
 *     used, now the SECONDARIES of a Blobbi flow and still the only relays
 *     of every other flow (kind 0, NIP-46 sign-in, themes);
 *  3. **trusted ecosystem read hints**: where the games that write the
 *     player's inventories and equipment are known to publish them
 *     (`src/features/inventory/relay-hints.ts`);
 *  4. **issuer relays**: the relays each trusted item issuer's definitions
 *     are known to live on (`TrustedIssuer.relays`).
 *
 * Hints are read-only transport. They never widen the write set and they
 * never make an event trusted: trust is decided by signature (the relay
 * layer) and by the issuer/owner checks in `src/features/inventory`, exactly
 * as before. See `src/lib/relay-routing.ts` for how a read picks its relays
 * and `src/lib/home-pool.ts` for how several answers become one.
 */
import { KIND_BLOBBI_INTERACTION, KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, KIND_BLOBBONAUT_PROFILE_LEGACY } from '@blobbi-kit/core';
import { KIND_GAME_INVENTORY, KIND_GAME_INVENTORY_FOLD, KIND_GAME_INVENTORY_SPEND, KIND_GAME_ITEM_PLACEMENT } from '@nostr-games/inventory';
import { BLOBBI_RELAY_KINDS, BLOBBI_RELAY_URL } from '@/lib/blobbi-relay-routing';

/** The Blobbi relay: first for the Blobbi kinds, absent from every other flow. */
export const PRIMARY_RELAY: string = BLOBBI_RELAY_URL;

/**
 * The kinds the primary relay is part of, for reads and for writes: what the
 * relay has a write rule for, less
 *
 *  - kind 0: the relay takes it from its pilot write list only, so a new
 *    player's name would be refused there; profile metadata keeps the
 *    application relays it always had;
 *  - kind 5: the home never deletes.
 *
 * NIP-46 (24133) and the Ditto theme kinds (36767, 3367, 16769) are not on
 * the relay at all, so they never were candidates.
 */
export const PRIMARY_KINDS: readonly number[] = BLOBBI_RELAY_KINDS.filter((kind) => kind !== 0 && kind !== 5);
/** Read with the primary as well: the legacy profile (31125) is on it, read-only. */
export const PRIMARY_READ_KINDS: readonly number[] = [...PRIMARY_KINDS, KIND_BLOBBONAUT_PROFILE_LEGACY];

export const BASE_RELAYS: readonly string[] = [
  'wss://relay.ditto.pub',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
];

/**
 * The player's profile (kind 11125) is replaceable: a write replaces it
 * everywhere. A companion change is built only from a read in which EACH of
 * these relays answered: every Blobbi app (this home, Blobbi Pixel, Ditto)
 * writes profiles to both, so the newest profile is on one of them. That read
 * is what keeps a newer profile from being overwritten, so it stays.
 *
 * A write counts as saved once ONE of the application relays reads it back
 * (`PROFILE_WRITE_QUORUM`): relay.ditto.pub answered 502 on 2026-10-17, and a
 * save that needed it (as it did, with a quorum of two) could not finish while
 * it was down. The relays still missing the write are sent that very signed
 * event later (`profile-delivery.ts`), never over a newer profile. The same
 * policy as Blobbi Pixel's (`relay-config.ts` there).
 */
export const PROFILE_REQUIRED_RELAYS: readonly string[] = ['wss://relay.ditto.pub', 'wss://relay.primal.net'];
export const PROFILE_WRITE_QUORUM = 1;

/**
 * "This account has none" (no Blobbi, no inventory, no profile to build on)
 * is a fact only when EACH of these said so to the end. The primary is new
 * and may be empty, so its word alone is never enough; the two relays every
 * Blobbi app writes to may be a moment behind it, so theirs alone is not
 * either. With one of them silent the state is UNKNOWN: the home keeps what
 * it had or offers Try again, and never the adoption entry.
 *
 * Deliberately not the same list as `PROFILE_REQUIRED_RELAYS`: that one gates
 * every profile WRITE, and a primary that is down must not stop those. This
 * one only gates concluding ABSENCE, where waiting is the safe answer.
 * relay.nostr.band is in neither: it is asked, and never waited for.
 */
export const ABSENCE_REQUIRED_RELAYS: readonly string[] = [PRIMARY_RELAY, ...PROFILE_REQUIRED_RELAYS];

/**
 * The player's OWN persistent Blobbi events the home may carry, as they were
 * signed, from a relay that has them to a relay of the same flow that
 * certainly does not (`src/lib/relay-sync.ts`). Nothing by anyone else,
 * nothing ephemeral, private or expiring, and not the legacy profile.
 */
export const OWN_SYNC_KINDS: readonly number[] = [KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, KIND_BLOBBI_INTERACTION, KIND_GAME_INVENTORY, KIND_GAME_ITEM_PLACEMENT, KIND_GAME_INVENTORY_SPEND, KIND_GAME_INVENTORY_FOLD];

/** What the home itself publishes to every application relay: those are destinations there too. */
const HOME_WRITTEN_KINDS: readonly number[] = [KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, KIND_BLOBBI_INTERACTION, KIND_GAME_INVENTORY_SPEND];

/**
 * Where an own event of this kind belongs: the primary, and the secondaries
 * of its flow. What the home writes goes wherever the home writes; an
 * inventory, its folds and the equipment go where the games that write them
 * do (relay.ditto.pub and relay.primal.net: `relay-hints.ts`), never further.
 */
export function syncDestinations(kind: number): readonly string[] {
  if (!OWN_SYNC_KINDS.includes(kind)) return [];
  return [PRIMARY_RELAY, ...(HOME_WRITTEN_KINDS.includes(kind) ? BASE_RELAYS : PROFILE_REQUIRED_RELAYS)];
}

/**
 * The most relays one read may fan out to, application relays included.
 * Hints are source-controlled constants, so this is a ceiling, not a knob:
 * it caps the damage of a mistaken table, never a player's choice.
 */
export const MAX_RELAYS_PER_READ = 8;

/**
 * One canonical spelling per relay, or `null` for anything that is not a
 * relay the home would connect to:
 *
 *  - `wss:` only (a home page is served over https; a plain `ws:` relay would
 *    be blocked as mixed content anyway);
 *  - no credentials, query or fragment;
 *  - host lower-cased, default port dropped, trailing slashes removed.
 *
 * `wss://Relay.Ditto.Pub/` and `wss://relay.ditto.pub` are one relay.
 * The pool keys connections by this string, so two spellings would be two
 * sockets; normalizing first is what makes deduplication real.
 */
export function normalizeRelayUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'wss:') return null;
  if (url.username || url.password || url.search || url.hash) return null;
  if (!url.hostname) return null;
  const path = url.pathname.replace(/\/+$/, '');
  return `wss://${url.host}${path}`;
}

/**
 * Normalize, drop the invalid, deduplicate, keep first-seen order, cap.
 * Order matters: callers put application relays first so a cap never drops
 * one of them in favour of a hint.
 */
export function relaySet(lists: readonly (readonly unknown[])[], max = MAX_RELAYS_PER_READ): string[] {
  const out: string[] = [];
  for (const list of lists) {
    for (const candidate of list) {
      const url = normalizeRelayUrl(candidate);
      if (!url || out.includes(url)) continue;
      if (out.length >= max) return out;
      out.push(url);
    }
  }
  return out;
}

/**
 * Every relay an existing event of the player's could be copied to, once they turn copying on: what the account is
 * SHOWN, and exactly what its answer covers (`src/lib/sync-consent.ts`). A relay added here later is not covered by
 * an answer given before: the account is asked again.
 */
export const COPY_DESTINATIONS: readonly string[] = relaySet([OWN_SYNC_KINDS.flatMap((kind) => syncDestinations(kind))]);
