/**
 * Reading relay by relay, when a write must not build on less than the
 * relays that hold the newest version: only an EOSE makes an answer. A
 * timeout, a CLOSED, a refused connection or a stream that ended without EOSE
 * is no answer at all, never "nothing there".
 */
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';

/** One relay's answer, or null when it did not answer to the end. */
export async function readToEose(nostr: NPool, url: string, filters: NostrFilter[], timeoutMs: number): Promise<NostrEvent[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const events: NostrEvent[] = [];
  try {
    for await (const msg of nostr.relay(url).req(filters, { signal: controller.signal })) {
      if (msg[0] === 'EVENT') events.push(msg[2]);
      else if (msg[0] === 'EOSE') return events;
      else if (msg[0] === 'CLOSED') return null;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export interface Census {
  /** Every required relay answered to the end. */
  complete: boolean;
  /** Required relays that did not. */
  missing: string[];
  /** Every event the relays that answered returned. */
  events: NostrEvent[];
}

/** Ask the required relays and the others at once; the others are heard while in time and never required. */
export async function readCensus(nostr: NPool, filters: NostrFilter[], { required, others = [], timeoutMs }: { required: readonly string[]; others?: readonly string[]; timeoutMs: number }): Promise<Census> {
  const urls = [...new Set([...required, ...others])];
  const answers = await Promise.all(urls.map(async (url) => ({ url, events: await readToEose(nostr, url, filters, timeoutMs) })));
  return {
    complete: answers.every((a) => a.events !== null || !required.includes(a.url)),
    missing: answers.filter((a) => a.events === null && required.includes(a.url)).map((a) => a.url),
    events: answers.flatMap((a) => a.events ?? []),
  };
}

/** A pool that can plan a complete read (`HomePool.censusPlan`). */
export interface CensusPlanner {
  censusPlan(filters: NostrFilter[], set: 'absence' | 'profile'): { routes: Map<string, NostrFilter[]>; required: string[] };
}

export function canPlanCensus(nostr: unknown): nostr is NPool & CensusPlanner {
  return !!nostr && typeof (nostr as CensusPlanner).censusPlan === 'function';
}

/**
 * A complete read planned by the pool: each relay asked with exactly the filters it is routed (a relay never
 * gets a kind it does not hold), the pool's required relays for `set` must each answer to the end. A pool that
 * cannot plan (not the home's) is read on `fallback`. `onlyRequired`: ask the required relays alone, for a
 * decision that must rest on them only (what a write builds on, whether a write landed where it counts).
 */
export async function readPlannedCensus(nostr: NPool, filters: NostrFilter[], set: 'absence' | 'profile', fallback: { required: readonly string[]; others?: readonly string[] }, timeoutMs: number, { onlyRequired = false }: { onlyRequired?: boolean } = {}): Promise<Census> {
  if (!canPlanCensus(nostr)) return readCensus(nostr, filters, { required: fallback.required, others: onlyRequired ? [] : fallback.others, timeoutMs });
  const { routes, required } = nostr.censusPlan(filters, set);
  const asked = [...routes].filter(([url]) => !onlyRequired || required.includes(url));
  const answers = await Promise.all(asked.map(async ([url, routed]) => ({ url, events: await readToEose(nostr, url, routed, timeoutMs) })));
  return {
    complete: answers.every((a) => a.events !== null || !required.includes(a.url)),
    missing: answers.filter((a) => a.events === null && required.includes(a.url)).map((a) => a.url),
    events: answers.flatMap((a) => a.events ?? []),
  };
}
