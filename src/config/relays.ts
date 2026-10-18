/**
 * Relays, as URLs the home can compare.
 *
 * The standalone has three kinds of relay knowledge, and only the first is
 * configured here:
 *
 *  1. **application relays** (`BASE_RELAYS`): where the home reads by default
 *     and the ONLY relays it ever publishes to;
 *  2. **trusted ecosystem read hints**: where the games that write the
 *     player's inventories and equipment are known to publish them
 *     (`src/features/inventory/relay-hints.ts`);
 *  3. **issuer relays**: the relays each trusted item issuer's definitions
 *     are known to live on (`TrustedIssuer.relays`).
 *
 * Hints are read-only transport. They never widen the write set and they
 * never make an event trusted: trust is decided by signature (the relay
 * layer) and by the issuer/owner checks in `src/features/inventory`, exactly
 * as before. See `src/lib/relay-routing.ts` for how a read picks its relays.
 */
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
