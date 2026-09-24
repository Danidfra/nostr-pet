/**
 * A network of fake relays for the REAL `NPool`: every routing, dedupe and
 * grace-period rule under test is nostrify's own, only the socket is fake.
 *
 * Each relay is a NIP-01 store (`nostr-tools`' `matchFilters`) with a mode:
 *   ok          answers what matches, then EOSE
 *   offline     the REQ throws (connection refused)
 *   hanging     connects, never answers, ends only when the pool aborts
 *   slow        answers after `delayMs` (aborted by the pool's grace period if longer)
 *   unfiltered  serves EVERY stored event regardless of the filter: a
 *               misbehaving relay, to prove the app trusts nothing for being served
 *
 * A real `NRelay1` verifies signatures and applies `matchFilters` to what
 * arrives; the fake does neither, so a test can hand the app what a
 * malicious relay would try, one layer past where the connection would have
 * stopped it.
 */
import type { NRelay, NostrEvent, NostrFilter, NostrRelayCLOSED, NostrRelayEOSE, NostrRelayEVENT } from '@nostrify/nostrify';
import { matchFilters, type Filter } from 'nostr-tools/filter';

export type FakeRelayMode = 'ok' | 'offline' | 'hanging' | 'slow' | 'unfiltered';

function untilAborted(signal: AbortSignal | undefined): Promise<void> {
  if (!signal) return Promise.resolve();
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export class FakeRelay implements NRelay {
  events: NostrEvent[] = [];
  /** Every event offered to this relay through `event()`, in order. */
  published: NostrEvent[] = [];
  /** Every REQ this relay received, in order. */
  requests: NostrFilter[][] = [];
  mode: FakeRelayMode = 'ok';
  delayMs = 0;
  closed = false;

  constructor(readonly url: string) {}

  async *req(filters: NostrFilter[], opts?: { signal?: AbortSignal }): AsyncIterable<NostrRelayEVENT | NostrRelayEOSE | NostrRelayCLOSED> {
    this.requests.push(filters);
    const signal = opts?.signal;
    if (this.mode === 'offline') throw new Error(`${this.url}: connection refused`);
    if (this.mode === 'hanging') {
      await untilAborted(signal);
      return;
    }
    if (this.mode === 'slow') await sleep(this.delayMs, signal);
    if (signal?.aborted) return;
    const served = this.mode === 'unfiltered' ? this.events : this.events.filter((e) => matchFilters(filters as Filter[], e));
    for (const event of served) yield ['EVENT', 'fake', event];
    yield ['EOSE', 'fake'];
  }

  async event(event: NostrEvent): Promise<void> {
    if (this.mode === 'offline') throw new Error(`${this.url}: connection refused`);
    this.published.push(event);
    this.events.push(event);
  }

  async query(filters: NostrFilter[]): Promise<NostrEvent[]> {
    return this.events.filter((e) => matchFilters(filters as Filter[], e));
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

export interface FakeNetwork {
  relays: Map<string, FakeRelay>;
  /** The relay at this URL, created on first use (so an unexpected URL is visible in `relays`). */
  relay(url: string): FakeRelay;
  /** `NPool`'s `open`. */
  open(url: string): FakeRelay;
  /** Everything published anywhere, with where. */
  published(): { url: string; event: NostrEvent }[];
}

export function fakeNetwork(): FakeNetwork {
  const relays = new Map<string, FakeRelay>();
  const relay = (url: string) => {
    let r = relays.get(url);
    if (!r) {
      r = new FakeRelay(url);
      relays.set(url, r);
    }
    return r;
  };
  return {
    relays,
    relay,
    open: relay,
    published: () => [...relays.values()].flatMap((r) => r.published.map((event) => ({ url: r.url, event }))),
  };
}
