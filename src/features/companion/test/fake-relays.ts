/**
 * An in-memory relay network for the companion tests: each relay keeps the newest replaceable event per
 * (kind, author[, d]), answers queries, accepts events, and can be down, silent (never answers), refusing, or
 * forgetful (accepts and loses). Nothing here touches a real relay.
 */
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import type { NostrEvent } from '@blobbi-kit/core';
import { buildBlobbonautTags, updateBlobbonautTags } from '@blobbi-kit/core';
import type { ProfileFilter, ProfileRelays, UnsignedProfile } from '../profile-write';

export const DITTO = 'wss://relay.ditto.pub';
export const PRIMAL = 'wss://relay.primal.net';
export const BAND = 'wss://relay.nostr.band';

export interface FakeRelay {
  events: NostrEvent[];
  down: boolean;
  silent: boolean;
  refuse: boolean;
  forget: boolean;
  sent: NostrEvent[];
}

export interface FakeNetwork {
  relays: Map<string, FakeRelay>;
  port: ProfileRelays;
  /** Put an event on some relays (as another app would). */
  seed(event: NostrEvent, urls?: readonly string[]): void;
  /** Every event any relay was sent (by the code under test). */
  sent(): NostrEvent[];
}

const key = (e: NostrEvent) => (e.kind >= 30000 ? `${e.kind}:${e.pubkey}:${e.tags.find((t) => t[0] === 'd')?.[1] ?? ''}` : `${e.kind}:${e.pubkey}`);

function store(relay: FakeRelay, e: NostrEvent): void {
  const k = key(e);
  const old = relay.events.find((x) => key(x) === k);
  if (old && (old.created_at > e.created_at || (old.created_at === e.created_at && old.id <= e.id))) return;
  relay.events = relay.events.filter((x) => key(x) !== k);
  relay.events.push(e);
}

function matches(e: NostrEvent, f: ProfileFilter): boolean {
  return f.kinds.includes(e.kind) && f.authors.includes(e.pubkey) && (!f['#d'] || e.tags.some((t) => t[0] === 'd' && f['#d'].includes(t[1])));
}

export function fakeNetwork(urls: readonly string[] = [DITTO, PRIMAL, BAND], opts: { required?: readonly string[]; quorum?: number } = {}): FakeNetwork {
  const relays = new Map<string, FakeRelay>(urls.map((u) => [u, { events: [], down: false, silent: false, refuse: false, forget: false, sent: [] }]));
  const port: ProfileRelays = {
    urls,
    required: opts.required ?? [DITTO, PRIMAL],
    quorum: opts.quorum ?? 1,
    async query(url, filter, signal) {
      const r = relays.get(url)!;
      if (r.down) throw new Error('unreachable');
      if (r.silent)
        return new Promise<NostrEvent[]>((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        });
      return r.events.filter((e) => matches(e, filter)).map((e) => ({ ...e, tags: e.tags.map((t) => [...t]) }));
    },
    async publish(url, event) {
      const r = relays.get(url)!;
      if (r.down || r.silent) throw new Error('unreachable');
      r.sent.push(event);
      if (r.refuse) throw new Error('blocked: no');
      if (!r.forget) store(r, event);
    },
  };
  return {
    relays,
    port,
    seed(event, on = urls) {
      for (const u of on) store(relays.get(u)!, event);
    },
    sent: () => [...relays.values()].flatMap((r) => r.sent),
  };
}

export interface TestAccount {
  pubkey: string;
  sign(t: UnsignedProfile | { kind: number; created_at: number; tags: string[][]; content: string }): NostrEvent;
}

export function testAccount(): TestAccount {
  const sk = generateSecretKey();
  const pubkey = getPublicKey(sk);
  return { pubkey, sign: (t) => finalizeEvent({ ...t }, sk) as unknown as NostrEvent };
}

export const dOf = (pubkey: string, n: number) => `blobbi-${pubkey.slice(0, 12)}-${String(n).padStart(10, '0')}`;

/** A profile as the other apps write it: the kit's tags, `has`, a companion, extra tags, some content. */
export function profileEvent(acc: TestAccount, o: { has: string[]; companion?: string; createdAt: number; extra?: string[][]; content?: string; kind?: number }): NostrEvent {
  let tags = updateBlobbonautTags(buildBlobbonautTags(acc.pubkey), { has: o.has, ...(o.companion ? { current_companion: o.companion } : {}), xp: '420' });
  tags = [...tags, ...(o.extra ?? [])];
  if (o.kind === 31125) tags = tags.map((t) => (t[0] === 'd' ? ['d', `Blobbonaut-${acc.pubkey.slice(0, 8)}`] : t));
  return acc.sign({ kind: o.kind ?? 11125, created_at: o.createdAt, tags, content: o.content ?? '{"daily":{"done":3}}' });
}
