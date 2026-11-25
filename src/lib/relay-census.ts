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
