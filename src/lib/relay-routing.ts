/**
 * Which relays a READ goes to. Pure; the pool calls it for every request.
 *
 * ```
 *   a filter for a primary kind  →  the primary relay, first (only that filter)
 *   every filter                 →  every application relay
 *   a filter a hint covers       →  the hint's relays as well (only that filter)
 * ```
 *
 * The primary (`wss://relay.blobbi.pet`) is asked for the kinds it holds and
 * for nothing else: a profile-metadata, theme or NIP-46 request never reaches
 * it, and a filter without `kinds` does not either.
 *
 * A hint covers a filter when they share a kind and, if the hint names
 * authors, the filter asks for one of them. So a kind 31632 request for the
 * official issuer also goes to the official issuer's relays; a request for a
 * stranger's definitions goes nowhere extra; a kind 31633 request goes to
 * every relay a known game writes inventories to. A filter without `kinds`
 * (an `ids` lookup) is never hinted.
 *
 * What this deliberately is not: a relay manager, a NIP-65 reader, a
 * crawler. The hint table is a source constant; nothing at run time adds to
 * it. And it routes reads only: publishing has its own router, which knows
 * nothing about hints (`createHomePool`).
 *
 * Querying a relay says nothing about trusting what it returns. Signatures
 * are checked at the connection (`NRelay1`'s default `verifyEvent`) and every
 * inventory, definition and placement is gated by owner/issuer afterwards,
 * the same for an event from a hint as from an application relay.
 */
import type { NostrFilter } from '@nostrify/nostrify';
import { MAX_RELAYS_PER_READ, normalizeRelayUrl, relaySet } from '@/config/relays';

export interface ReadHint {
  /** Why these relays are hinted, for tests and the journal. */
  label: string;
  /** Event kinds this hint is about. */
  kinds: readonly number[];
  /** When set, only filters asking for one of these authors are hinted. */
  authors?: readonly string[];
  /** Read-only relay URLs; normalized when the policy is built. */
  relays: readonly string[];
}

export interface ReadRoutingPolicy {
  /** The primary relay (normalized) and the kinds it is asked for; null when there is none. */
  primary: { url: string; kinds: readonly number[] } | null;
  /** Normalized application relays: every read, in this order. */
  appRelays: readonly string[];
  hints: readonly ReadHint[];
  /** Ceiling on relays per read, application relays included. */
  maxRelays?: number;
}

/** Normalize every URL once so routing compares canonical strings. Invalid entries vanish here. */
export function buildReadRoutingPolicy(input: { appRelays: readonly unknown[]; hints: readonly ReadHint[]; maxRelays?: number; primary?: { url: unknown; kinds: readonly number[] } | null }): ReadRoutingPolicy {
  const max = input.maxRelays ?? MAX_RELAYS_PER_READ;
  const primaryUrl = input.primary ? normalizeRelayUrl(input.primary.url) : null;
  return {
    primary: primaryUrl && input.primary ? { url: primaryUrl, kinds: [...input.primary.kinds] } : null,
    // The primary is routed by kind, never as an application relay
    appRelays: relaySet([input.appRelays], max).filter((url) => url !== primaryUrl),
    hints: input.hints.map((hint) => ({ ...hint, relays: relaySet([hint.relays], max).filter((url) => url !== primaryUrl) })),
    maxRelays: max,
  };
}

function covers(hint: ReadHint, filter: NostrFilter): boolean {
  const kinds = filter.kinds;
  if (!kinds || !kinds.some((k) => hint.kinds.includes(k))) return false;
  if (hint.authors) {
    const authors = filter.authors;
    if (!authors || !authors.some((a) => hint.authors!.includes(a))) return false;
  }
  return true;
}

/** The hint relays for one filter, in policy order, deduplicated; application relays excluded. */
export function hintedRelaysFor(filter: NostrFilter, policy: ReadRoutingPolicy): string[] {
  const out: string[] = [];
  for (const hint of policy.hints) {
    if (!covers(hint, filter)) continue;
    for (const url of hint.relays) {
      if (!policy.appRelays.includes(url) && !out.includes(url)) out.push(url);
    }
  }
  return out;
}

/** Whether the primary relay is asked for this filter: it names a kind the primary holds. */
export function primaryCovers(filter: NostrFilter, policy: ReadRoutingPolicy): boolean {
  return !!policy.primary && !!filter.kinds && filter.kinds.some((k) => policy.primary!.kinds.includes(k));
}

/**
 * The pool's request routes: relay URL → the filters to send there.
 * The primary comes first, with exactly the filters for its kinds;
 * application relays get every filter; a hinted relay gets exactly the
 * filters it was hinted for. The cap keeps the primary and the application
 * relays and drops the last hints first.
 */
export function routeReadFilters(filters: NostrFilter[], policy: ReadRoutingPolicy): Map<string, NostrFilter[]> {
  const max = policy.maxRelays ?? MAX_RELAYS_PER_READ;
  const routes = new Map<string, NostrFilter[]>();
  const forPrimary = filters.filter((filter) => primaryCovers(filter, policy));
  if (policy.primary && forPrimary.length > 0) routes.set(policy.primary.url, forPrimary);
  for (const url of policy.appRelays) routes.set(url, filters);
  for (const filter of filters) {
    for (const url of hintedRelaysFor(filter, policy)) {
      const existing = routes.get(url);
      if (existing) {
        if (!existing.includes(filter)) existing.push(filter);
        continue;
      }
      if (routes.size >= max) continue;
      routes.set(url, [filter]);
    }
  }
  return routes;
}
