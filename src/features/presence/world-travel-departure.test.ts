/**
 * The shared departure rules (src/features/presence/world-travel-departure.ts, the same file in Blobbi Pixel and Blobbi Island):
 * the origin moves the Blobbi to the destination with ONE signed and published World Location after a fresh read;
 * already there publishes nothing; a refusal or a slow signer moves nothing; a newer location met after a slow
 * signature is never overwritten; no relay accepting is unreachable; one move per Blobbi at a time; and the
 * destination's one decision per page load (`autoArrivalDecision`). Plus the leftovers of older builds dropped.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import { WORLD_HOME, WORLD_PIXEL, buildWorldLocationTemplate, parseWorldLocation, type NostrEvent, type WorldLocation, type WorldTravelSnapshot } from '@blobbi-kit/core';
import { ARRIVAL_INTENT_TTL_MS, ArrivalIntent, DEPART_SIGN_TIMEOUT_MS, LEGACY_HANDOFF_PARAM, LEGACY_HANDOFF_USED_KEY, SIGN_PROMPT_TIMEOUT_MS, SignerTimeoutError, autoArrivalDecision, boundedSigner, departTo, dropLegacyHandoff, dropLegacyHandoffStore, pageAgeMs, pageIsFresh } from './world-travel-departure';
import { WORLD_ISLAND } from '@/features/worlds/worlds';

const sk = generateSecretKey();
const OWNER = getPublicKey(sk);
const D = `blobbi-${OWNER.slice(0, 12)}-0123456789`;
const otherSk = generateSecretKey();
const verify = (e: NostrEvent) => {
  try {
    return verifyEvent(e as Parameters<typeof verifyEvent>[0]);
  } catch {
    return false;
  }
};
const location = (world: string, latest: WorldLocation | null = null, nowMs = Date.now(), key = sk): WorldLocation =>
  parseWorldLocation(finalizeEvent(buildWorldLocationTemplate({ owner: OWNER, d: D, world, latest, now: nowMs }), key), { verify })!;

/** A pretend session over a place that tests may move, and relays that record what they are sent. */
function world(o: { place?: WorldLocation | null; resolution?: WorldTravelSnapshot['resolution']; refuse?: boolean; hang?: boolean; urls?: string[] } = {}) {
  const state = { place: o.place ?? null, resolution: o.resolution ?? ('confirmed' as WorldTravelSnapshot['resolution']), refuse: !!o.refuse, hang: !!o.hang, refreshes: 0 };
  const published: { url: string; event: NostrEvent }[] = [];
  const session = {
    refresh: async () => void state.refreshes++,
    snapshot: () => ({ owner: OWNER, d: D, world: WORLD_PIXEL, resolution: state.resolution, location: state.place }) as WorldTravelSnapshot,
  };
  const relays = {
    urls: o.urls ?? ['wss://a', 'wss://b'],
    async publish(url: string, event: NostrEvent, signal: AbortSignal) {
      if (state.hang) await new Promise((_, no) => signal.addEventListener('abort', () => no(new Error('timeout'))));
      published.push({ url, event });
      if (state.refuse) throw new Error('blocked: no');
    },
  };
  return { state, session, relays, published };
}
const signer = (o: { refuse?: boolean; delayMs?: number; key?: Uint8Array } = {}) => ({
  mode: 'silent' as const,
  asked: 0,
  async sign(t: { kind: number; created_at: number; tags: string[][]; content: string }) {
    signerObj.asked++;
    if (o.delayMs) await new Promise((r) => setTimeout(r, o.delayMs));
    if (o.refuse) throw new Error('rejected');
    return finalizeEvent(t, o.key ?? sk) as NostrEvent;
  },
});
let signerObj: ReturnType<typeof signer>;
const mk = (o: Parameters<typeof signer>[0] = {}) => (signerObj = signer(o));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2027, 2, 1, 10));
});
afterEach(() => vi.useRealTimers());

describe('departTo: the origin moves the Blobbi to the destination', () => {
  it('Home → Island as the origin publishes it: a fresh read, one event naming the destination, `from` and `prev` the canonical ones, one relay enough', async () => {
    const home = location(WORLD_HOME, null, Date.now() - 60_000);
    const w = world({ place: home });
    const s = mk();
    const r = await departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: w.session, relays: w.relays, signer: s, verify });
    expect(r.outcome).toBe('moved');
    expect(w.state.refreshes).toBeGreaterThanOrEqual(1);
    expect(s.asked).toBe(1);
    const events = [...new Set(w.published.map((p) => p.event.id))];
    expect(events).toHaveLength(1);
    expect(r.location).toMatchObject({ owner: OWNER, d: D, world: WORLD_ISLAND, from: WORLD_HOME, prev: home.id });
    expect(r.location!.event.kind).toBe(31126);
  });

  it('Pixel → Home and Island → Pixel the same way (the destination is only a World id)', async () => {
    for (const [fromWorld, to] of [
      [WORLD_PIXEL, WORLD_HOME],
      [WORLD_ISLAND, WORLD_PIXEL],
    ] as const) {
      const w = world({ place: location(fromWorld, null, Date.now() - 60_000) });
      const r = await departTo({ owner: OWNER, d: D, destination: to, session: w.session, relays: w.relays, signer: mk(), verify });
      expect(r.outcome).toBe('moved');
      expect(r.location).toMatchObject({ world: to, from: fromWorld });
    }
  });

  it('already there (the destination already names it, by the relays\' newest): nothing signed, nothing published', async () => {
    const w = world({ place: location(WORLD_ISLAND, null, Date.now() - 60_000) });
    const s = mk();
    const r = await departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: w.session, relays: w.relays, signer: s, verify });
    expect(r.outcome).toBe('already-there');
    expect(s.asked).toBe(0);
    expect(w.published).toEqual([]);
  });

  it('no World Location at all is Home: a trip to Home publishes nothing; a trip elsewhere moves from Home', async () => {
    const w = world();
    expect((await departTo({ owner: OWNER, d: D, destination: WORLD_HOME, session: w.session, relays: w.relays, signer: mk(), verify })).outcome).toBe('already-there');
    const r = await departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: w.session, relays: w.relays, signer: mk(), verify });
    expect(r.outcome).toBe('moved');
    expect(r.location).toMatchObject({ from: WORLD_HOME, prev: null });
  });

  it('the place not confirmed by any relay: nothing is signed (a stale place is never written over)', async () => {
    for (const resolution of ['pending', 'cached', 'unreachable'] as const) {
      const w = world({ resolution });
      const s = mk();
      expect((await departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: w.session, relays: w.relays, signer: s, verify })).outcome).toBe('unreachable');
      expect(s.asked).toBe(0);
    }
  });

  it('the signer refusing: declined, nothing published', async () => {
    const w = world();
    const r = await departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: w.session, relays: w.relays, signer: mk({ refuse: true }), verify });
    expect(r.outcome).toBe('declined');
    expect(w.published).toEqual([]);
  });

  it('the signer too slow: declined after the sign timeout, and a late signature is never published', async () => {
    const w = world();
    const p = departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: w.session, relays: w.relays, signer: mk({ delayMs: DEPART_SIGN_TIMEOUT_MS + 5_000 }), verify });
    await vi.advanceTimersByTimeAsync(DEPART_SIGN_TIMEOUT_MS + 10);
    expect((await p).outcome).toBe('declined');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(w.published).toEqual([]);
  });

  it('no signer here: read-only, nothing asked', async () => {
    const w = world();
    expect((await departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: w.session, relays: w.relays, signer: null, verify })).outcome).toBe('read-only');
  });

  it('a signer answering for another key, or an account that changed meanwhile: wrong-account, nothing published', async () => {
    const w = world();
    expect((await departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: w.session, relays: w.relays, signer: mk({ key: otherSk }), verify })).outcome).toBe('wrong-account');
    expect((await departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: w.session, relays: w.relays, signer: mk(), verify, stillAccount: () => false })).outcome).toBe('wrong-account');
    expect(w.published).toEqual([]);
  });

  it('a slow signature (a person answered) re-reads: a newer location met meanwhile is not overwritten (stale), or already there', async () => {
    const home = location(WORLD_HOME, null, Date.now() - 60_000);
    const w = world({ place: home });
    const p = departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: w.session, relays: w.relays, signer: mk({ delayMs: 3_000 }), verify });
    // Another device moves it to Pixel while the extension's prompt is open
    await vi.advanceTimersByTimeAsync(1_000);
    w.state.place = location(WORLD_PIXEL, home, Date.now() + 1_000);
    await vi.advanceTimersByTimeAsync(2_100);
    expect((await p).outcome).toBe('stale');
    expect(w.published).toEqual([]);
    // Or to the very destination: nothing to publish
    const w2 = world({ place: home });
    const p2 = departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: w2.session, relays: w2.relays, signer: mk({ delayMs: 3_000 }), verify });
    await vi.advanceTimersByTimeAsync(1_000);
    w2.state.place = location(WORLD_ISLAND, home, Date.now() + 1_000);
    await vi.advanceTimersByTimeAsync(2_100);
    expect((await p2).outcome).toBe('already-there');
    expect(w2.published).toEqual([]);
  });

  it('no relay accepting (refused, or hanging past the timeout): unreachable; one accepting relay is a move', async () => {
    const refused = world({ refuse: true });
    expect((await departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: refused.session, relays: refused.relays, signer: mk(), verify })).outcome).toBe('unreachable');
    const hanging = world({ hang: true });
    const p = departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: hanging.session, relays: hanging.relays, signer: mk(), verify, publishTimeoutMs: 1_000 });
    await vi.advanceTimersByTimeAsync(1_100);
    expect((await p).outcome).toBe('unreachable');
    // One of two accepts
    const half = world();
    const slow = half.relays.publish.bind(half.relays);
    half.relays.publish = async (url, e, signal) => {
      if (url === 'wss://a') throw new Error('blocked: no');
      return slow(url, e, signal);
    };
    expect((await departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: half.session, relays: half.relays, signer: mk(), verify })).outcome).toBe('moved');
  });

  it('one move per Blobbi at a time: a second call while one is under way is busy, and signs nothing', async () => {
    const w = world();
    const s = mk({ delayMs: 500 });
    const first = departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: w.session, relays: w.relays, signer: s, verify });
    await vi.advanceTimersByTimeAsync(10);
    const second = await departTo({ owner: OWNER, d: D, destination: WORLD_HOME, session: w.session, relays: w.relays, signer: s, verify });
    expect(second.outcome).toBe('busy');
    await vi.advanceTimersByTimeAsync(1_000);
    expect((await first).outcome).toBe('moved');
    expect(s.asked).toBe(1);
  });

  it('runs under the kit\'s lock name, so two tabs (or the kit\'s own move) take turns', async () => {
    const w = world();
    const names: string[] = [];
    const lock = async <T,>(name: string, fn: () => Promise<T>) => (names.push(name), fn());
    await departTo({ owner: OWNER, d: D, destination: WORLD_ISLAND, session: w.session, relays: w.relays, signer: mk(), verify, lock });
    expect(names).toEqual([`blobbi-world-travel:${OWNER}:${D}`]);
  });
});

describe('autoArrivalDecision: the destination\'s one decision per page load', () => {
  const base = { consumed: false, fresh: true, resolution: 'confirmed' as const, here: false, visible: true, signer: true };
  it('an away Blobbi, confirmed, visible, with a signer: arrive', () => {
    expect(autoArrivalDecision(base)).toBe('arrive');
  });
  it('waits while the place is not confirmed or the page not yet seen', () => {
    expect(autoArrivalDecision({ ...base, resolution: 'pending' })).toBe('wait');
    expect(autoArrivalDecision({ ...base, resolution: 'cached' })).toBe('wait');
    expect(autoArrivalDecision({ ...base, visible: false })).toBe('wait');
  });
  it('nothing when here already, when no relay answered, when no signer can be asked, or when this page decided before', () => {
    expect(autoArrivalDecision({ ...base, here: true })).toBe('none');
    expect(autoArrivalDecision({ ...base, resolution: 'unreachable' })).toBe('none');
    expect(autoArrivalDecision({ ...base, signer: false })).toBe('none');
    expect(autoArrivalDecision({ ...base, consumed: true })).toBe('none');
  });
  it('an old page looked at again is not a world being opened: nothing, whatever it finds (no Blobbi is pulled by a tab shown hours later)', () => {
    expect(autoArrivalDecision({ ...base, fresh: false })).toBe('none');
    expect(autoArrivalDecision({ ...base, fresh: false, resolution: 'pending' })).toBe('none');
    expect(autoArrivalDecision({ ...base, fresh: false, visible: false })).toBe('none');
  });
  it('a page is fresh within ARRIVAL_INTENT_TTL_MS of its navigation start (performance.now); no clock: fresh', () => {
    expect(ARRIVAL_INTENT_TTL_MS).toBe(5 * 60_000);
    expect(pageIsFresh(0)).toBe(true);
    expect(pageIsFresh(ARRIVAL_INTENT_TTL_MS - 1)).toBe(true);
    expect(pageIsFresh(ARRIVAL_INTENT_TTL_MS)).toBe(false);
    expect(pageAgeMs({ now: () => 12_345 })).toBe(12_345);
    expect(pageAgeMs(null)).toBe(0);
    expect(pageAgeMs({ now: () => { throw new Error('no'); } })).toBe(0);
    expect(pageIsFresh(pageAgeMs(null))).toBe(true);
  });
  it('the intent is per Blobbi within one page', () => {
    const i = new ArrivalIntent();
    expect(i.consumed(OWNER, D)).toBe(false);
    i.consume(OWNER, D);
    expect(i.consumed(OWNER, D)).toBe(true);
    expect(i.consumed(OWNER, `${D}-other`)).toBe(false);
  });
});

describe('boundedSigner: the kit\'s signer with a time limit', () => {
  const template = { kind: 31126, created_at: 1, tags: [] as string[][], content: '' };
  it('passes a timely answer or refusal through unchanged', async () => {
    const ok = boundedSigner({ mode: 'prompt', sign: async (t) => finalizeEvent(t, sk) as NostrEvent }, 1_000);
    expect(ok.mode).toBe('prompt');
    const e = await ok.sign(template);
    expect(verify(e)).toBe(true);
    const no = boundedSigner({ mode: 'prompt', sign: async () => { throw new Error('rejected'); } }, 1_000);
    await expect(no.sign(template)).rejects.toThrow('rejected');
  });
  it('a prompt left open past the limit is a refusal (the kit ends the move as declined); the default limit gives a person a minute', async () => {
    expect(SIGN_PROMPT_TIMEOUT_MS).toBe(60_000);
    const slow = boundedSigner({ mode: 'prompt', sign: () => new Promise(() => {}) }, 1_000);
    const p = slow.sign(template);
    const seen = p.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(await seen).toBeInstanceOf(SignerTimeoutError);
  });
  it('a late answer (the prompt approved after the limit) is dropped: it never reaches the caller, so nothing is published', async () => {
    let late = 0;
    let answer: ((e: NostrEvent) => void) | null = null;
    const signer = boundedSigner({ mode: 'prompt', sign: () => new Promise((r) => (answer = r)) }, 1_000, undefined, undefined, () => void late++);
    const p = signer.sign(template);
    const result = p.then(() => 'signed', () => 'refused');
    await vi.advanceTimersByTimeAsync(1_001);
    expect(await result).toBe('refused');
    answer!(finalizeEvent(template, sk) as NostrEvent);
    await vi.advanceTimersByTimeAsync(10);
    expect(late).toBe(1);
    // The promise stayed refused; a retry asks for a signature of its own
    expect(await result).toBe('refused');
  });
});

describe('older builds\' leftovers', () => {
  it('an address with an old hand-off fragment has it removed, unread; other fragment parameters stay', () => {
    const calls: string[] = [];
    const loc = { hash: `#mode=play&${LEGACY_HANDOFF_PARAM}=v1.abc`, pathname: '/', search: '' };
    const hist = { replaceState: (_s: unknown, _t: string, url?: string | URL | null) => void calls.push(String(url)), state: null };
    expect(dropLegacyHandoff(loc, hist)).toBe(true);
    expect(calls).toEqual(['/#mode=play']);
    expect(dropLegacyHandoff({ hash: '#mode=play', pathname: '/', search: '' }, hist)).toBe(false);
    expect(calls).toHaveLength(1);
  });
  it('the ids older builds kept are removed', () => {
    const removed: string[] = [];
    dropLegacyHandoffStore({ removeItem: (k) => void removed.push(k) });
    expect(removed).toEqual([LEGACY_HANDOFF_USED_KEY]);
  });
});
