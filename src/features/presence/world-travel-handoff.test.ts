/**
 * The World Travel hand-off's rules, without a page: the payload (encode, decode, malformed), the address (read
 * once and removed, the other fragment parameters kept), the origin's signing (refused, too slow, already there),
 * the destination's checks (every rejection), the ids honoured on this device, and the arrival controller over a
 * pretend session and relays (held until confirmed, published once, failed and retried, dropped, expired).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import { WORLD_HOME, WORLD_PIXEL, buildWorldLocationTemplate, parseWorldLocation, type NostrEvent, type WorldLocation, type WorldTravelRelays, type WorldTravelSession, type WorldTravelSnapshot } from '@blobbi-kit/core';

const WORLD_ISLAND = 'blobbi-island';
import {
  HANDOFF_MAX_AGE_S,
  HANDOFF_MAX_AHEAD_S,
  HANDOFF_PARAM,
  HANDOFF_SIGN_TIMEOUT_MS,
  HANDOFF_USED_KEY,
  checkHandoff,
  createHandoffArrival,
  decodeHandoff,
  encodeHandoff,
  handoffFragment,
  readHandoff,
  signHandoff,
  usedHandoffs,
  withHandoff,
} from './world-travel-handoff';

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

/** A World Location signed by the owner (or another key), dated `nowMs`. */
function location(world: string, latest: WorldLocation | null = null, nowMs = Date.now(), key = sk, o: { owner?: string; d?: string } = {}): NostrEvent {
  const t = buildWorldLocationTemplate({ owner: o.owner ?? OWNER, d: o.d ?? D, world, latest, now: nowMs, departureWindowS: 0 });
  return finalizeEvent({ kind: t.kind, created_at: t.created_at, tags: t.tags, content: t.content }, key) as NostrEvent;
}
const parsed = (e: NostrEvent) => parseWorldLocation(e, { verify })!;
/** As it comes off the wire or out of a fragment: JSON only (no library's cached "verified" mark travels with it). */
const plain = <T,>(e: T): T => JSON.parse(JSON.stringify(e)) as T;
const none = { has: () => false };

describe('the payload', () => {
  it('encodes a signed event into a fragment-safe string and decodes it back, as data', () => {
    const e = location(WORLD_ISLAND);
    const payload = encodeHandoff(e);
    expect(payload).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    expect(decodeHandoff(payload)).toEqual(plain(e));
    expect(handoffFragment(e)).toBe(`${HANDOFF_PARAM}=${payload}`);
    expect(withHandoff('https://island.blobbi.pet/', e)).toBe(`https://island.blobbi.pet/#${HANDOFF_PARAM}=${payload}`);
  });

  it('refuses anything malformed: another version, bad characters, not JSON, not an event, too long', () => {
    const e = location(WORLD_ISLAND);
    const good = encodeHandoff(e);
    expect(decodeHandoff(null)).toBeNull();
    expect(decodeHandoff('')).toBeNull();
    expect(decodeHandoff(good.replace(/^v1/, 'v2'))).toBeNull();
    expect(decodeHandoff(`${good}=`)).toBeNull();
    expect(decodeHandoff('v1.!!!')).toBeNull();
    expect(decodeHandoff(`v1.${btoa('not json')}`)).toBeNull();
    expect(decodeHandoff(`v1.${btoa('[1,2]')}`)).toBeNull();
    expect(decodeHandoff(`v1.${btoa(JSON.stringify({ ...e, tags: 'nope' }))}`)).toBeNull();
    expect(decodeHandoff(`v1.${btoa(JSON.stringify({ ...e, kind: '31126' }))}`)).toBeNull();
    expect(decodeHandoff(`v1.${'A'.repeat(5_000)}`)).toBeNull();
  });
});

describe('the address', () => {
  it('reads the hand-off out of the fragment and removes it, keeping the other parameters; nothing without one', () => {
    const e = location(WORLD_ISLAND);
    const replaced: string[] = [];
    const hist = { state: { x: 1 }, replaceState: (_s: unknown, _t: string, url?: string | URL | null) => void replaced.push(String(url)) };
    const loc = { hash: `#mp=1&${handoffFragment(e)}&world-travel=nostr`, pathname: '/', search: '?a=b' };
    expect(readHandoff(loc, hist)).toEqual(plain(e));
    expect(replaced).toEqual(['/?a=b#mp=1&world-travel=nostr']);
    expect(readHandoff({ hash: `#${handoffFragment(e)}`, pathname: '/room', search: '' }, hist)).toEqual(plain(e));
    expect(replaced.at(-1)).toBe('/room');
    expect(readHandoff({ hash: '#mp=1', pathname: '/', search: '' }, hist)).toBeNull();
    expect(readHandoff({ hash: '', pathname: '/', search: '' }, hist)).toBeNull();
    // A malformed payload is removed all the same, and is nothing
    expect(readHandoff({ hash: `#${HANDOFF_PARAM}=v1.garbage!`, pathname: '/', search: '' }, hist)).toBeNull();
    expect(replaced.at(-1)).toBe('/');
  });
});

describe('the origin signs the move', () => {
  it('a World Location for the destination, from the canonical place, with prev; refused, too slow or already there: nothing', async () => {
    vi.useFakeTimers();
    const home = parsed(location(WORLD_HOME, null, Date.now() - 60_000));
    const sign = vi.fn(async (t: { kind: number; created_at: number; tags: string[][]; content: string }) => finalizeEvent(t, sk) as NostrEvent);
    const signed = await signHandoff({ owner: OWNER, d: D, destination: WORLD_ISLAND, canonical: home, sign, verify });
    const loc = parsed(signed!);
    expect(loc).toMatchObject({ owner: OWNER, d: D, world: WORLD_ISLAND, from: WORLD_HOME, prev: home.id });
    expect(loc.createdAt).toBeGreaterThan(home.createdAt);
    expect(sign).toHaveBeenCalledTimes(1);
    // Refused
    expect(await signHandoff({ owner: OWNER, d: D, destination: WORLD_ISLAND, canonical: home, sign: async () => Promise.reject(new Error('no')), verify })).toBeNull();
    // Signed by someone else, or for somewhere else: not carried
    expect(await signHandoff({ owner: OWNER, d: D, destination: WORLD_ISLAND, canonical: home, sign: async (t) => finalizeEvent(t, otherSk) as NostrEvent, verify })).toBeNull();
    // Already there
    expect(await signHandoff({ owner: OWNER, d: D, destination: WORLD_HOME, canonical: home, sign, verify })).toBeNull();
    // Too slow: the page leaves without it
    const slow = signHandoff({ owner: OWNER, d: D, destination: WORLD_ISLAND, canonical: home, sign: () => new Promise(() => {}), verify });
    await vi.advanceTimersByTimeAsync(HANDOFF_SIGN_TIMEOUT_MS + 1);
    expect(await slow).toBeNull();
    vi.useRealTimers();
  });
});

describe('the destination checks', () => {
  const now = Date.now();
  const home = parsed(location(WORLD_HOME, null, now - 60_000));
  const ok = () => location(WORLD_ISLAND, home, now);
  const check = (event: NostrEvent, o: Partial<Parameters<typeof checkHandoff>[0]> = {}) => checkHandoff({ event, world: WORLD_ISLAND, owner: OWNER, d: D, canonical: home, verify, used: none, now, ...o });

  it('accepts the owner\'s fresh move to this World from the canonical place', () => {
    const r = check(ok());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.location.world).toBe(WORLD_ISLAND);
  });

  it('rejects a bad signature, another World, another account, another Blobbi, no origin', () => {
    const tampered = plain(ok());
    tampered.content = 'x';
    expect(check(tampered)).toEqual({ ok: false, reason: 'invalid' });
    expect(check(location(WORLD_PIXEL, home, now))).toEqual({ ok: false, reason: 'wrong-world' });
    expect(check(location(WORLD_ISLAND, home, now, otherSk, { owner: getPublicKey(otherSk), d: `blobbi-${getPublicKey(otherSk).slice(0, 12)}-0123456789` }))).toEqual({ ok: false, reason: 'wrong-account' });
    expect(check(location(WORLD_ISLAND, home, now, sk, { d: `blobbi-${OWNER.slice(0, 12)}-9999999999` }))).toEqual({ ok: false, reason: 'wrong-blobbi' });
    // From this very World (a move "here from here" has no origin)
    const island = parsed(location(WORLD_ISLAND, null, now - 60_000));
    expect(check(location(WORLD_ISLAND, island, now), { canonical: island })).toEqual({ ok: false, reason: 'no-origin' });
  });

  it('rejects an old or a far-future hand-off', () => {
    expect(check(ok(), { now: now + (HANDOFF_MAX_AGE_S + 1) * 1000 })).toEqual({ ok: false, reason: 'expired' });
    expect(check(ok(), { now: now - (HANDOFF_MAX_AHEAD_S + 1) * 1000 })).toEqual({ ok: false, reason: 'future' });
  });

  it('rejects a stale one: the canonical place moved on, or the event is not newer than it', () => {
    // Moved meanwhile: prev no longer names the canonical location
    const moved = parsed(location(WORLD_PIXEL, home, now - 1_000));
    expect(check(ok(), { canonical: moved })).toEqual({ ok: false, reason: 'stale' });
    // Nothing known any more (relays lost it): the prev names something unknown
    expect(check(ok(), { canonical: null })).toEqual({ ok: false, reason: 'stale' });
    // A hand-off from a Blobbi that never travelled, while the relays now hold a location
    expect(check(location(WORLD_ISLAND, null, now), { canonical: home })).toEqual({ ok: false, reason: 'stale' });
  });

  it('says so when the event is already the canonical location, and refuses an id honoured before', () => {
    const e = ok();
    expect(check(e, { canonical: parsed(e) })).toEqual({ ok: false, reason: 'already-published' });
    expect(check(e, { used: { has: (id) => id === e.id } })).toEqual({ ok: false, reason: 'used' });
  });
});

describe('the ids honoured on this device', () => {
  it('are kept in the store, pruned by age, and remembered in memory when the store refuses', () => {
    let t = 1_000_000;
    const kept = new Map<string, string>();
    const used = usedHandoffs({ get: (k) => kept.get(k) ?? null, set: (k, v) => void kept.set(k, v) }, () => t);
    expect(used.has('a')).toBe(false);
    used.add('a');
    expect(used.has('a')).toBe(true);
    expect(JSON.parse(kept.get(HANDOFF_USED_KEY)!)).toEqual([{ id: 'a', at: t }]);
    t += 11 * 60_000;
    const later = usedHandoffs({ get: (k) => kept.get(k) ?? null, set: (k, v) => void kept.set(k, v) }, () => t);
    expect(later.has('a')).toBe(false);
    const refusing = usedHandoffs({
      get: () => null,
      set: () => {
        throw new Error('full');
      },
    });
    refusing.add('b');
    expect(refusing.has('b')).toBe(true);
  });
});

// ─── The arrival controller over a pretend session and relays ───────────────

function fakeSession(o: { resolution?: WorldTravelSnapshot['resolution']; canonical?: NostrEvent | null }) {
  let canonical: WorldLocation | null = o.canonical ? parsed(o.canonical) : null;
  let resolution: WorldTravelSnapshot['resolution'] = o.resolution ?? 'confirmed';
  const refreshes: number[] = [];
  const session = {
    snapshot: () => ({ owner: OWNER, d: D, world: WORLD_ISLAND, resolution, location: canonical, place: canonical?.world ?? WORLD_HOME, here: canonical?.world === WORLD_ISLAND }) as WorldTravelSnapshot,
    refresh: async () => void refreshes.push(Date.now()),
  } as unknown as WorldTravelSession;
  return {
    session,
    refreshes,
    confirm: () => void (resolution = 'confirmed'),
    moveTo: (e: NostrEvent) => void (canonical = parsed(e)),
  };
}

function fakeRelays(o: { fail?: boolean } = {}) {
  const published: NostrEvent[] = [];
  const relays: WorldTravelRelays & { fail: boolean } = {
    fail: !!o.fail,
    urls: ['wss://a.test', 'wss://b.test'],
    query: async () => [],
    publish: async (_url, e) => {
      if (relays.fail) throw new Error('down');
      published.push(e);
    },
  };
  return { relays, published };
}

describe('the arrival at the destination', () => {
  const now = Date.now();
  const home = location(WORLD_HOME, null, now - 60_000);
  const event = location(WORLD_ISLAND, parsed(home), now);
  const states: string[] = [];
  const used = { ids: new Set<string>(), has: (id: string) => used.ids.has(id), add: (id: string) => void used.ids.add(id) };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    states.length = 0;
    used.ids.clear();
  });
  afterEach(() => vi.useRealTimers());
  const flush = () => vi.advanceTimersByTimeAsync(10);

  it('holds until the session has confirmed the place, then publishes once to every relay and asks the session to look again', async () => {
    const s = fakeSession({ resolution: 'cached', canonical: home });
    const r = fakeRelays();
    const a = createHandoffArrival({ event, world: WORLD_ISLAND, session: () => s.session, relays: () => r.relays, verify, used, onChange: (st) => states.push(st.status) });
    a.update();
    await flush();
    expect(a.state().status).toBe('holding');
    expect(r.published).toHaveLength(0);
    s.confirm();
    a.update();
    await flush();
    expect(a.state().status).toBe('done');
    expect(r.published.map((e) => e.id)).toEqual([event.id, event.id]);
    expect(states).toEqual(['publishing', 'done']);
    // Looked before writing (the place as it is now) and after (to learn the move)
    expect(s.refreshes).toHaveLength(2);
    expect(used.has(event.id)).toBe(true);
    // Nothing more, whatever happens later
    a.update();
    await a.retry();
    await flush();
    expect(r.published).toHaveLength(2);
  });

  it('drops a hand-off the fresh look no longer supports (the Blobbi moved meanwhile), publishing nothing', async () => {
    const s = fakeSession({ canonical: home });
    const r = fakeRelays();
    const a = createHandoffArrival({ event, world: WORLD_ISLAND, session: () => s.session, relays: () => r.relays, verify, used });
    s.moveTo(location(WORLD_PIXEL, parsed(home), now - 500));
    a.update();
    await flush();
    expect(a.state()).toMatchObject({ status: 'dropped', reason: 'stale' });
    expect(r.published).toHaveLength(0);
  });

  it('is done without publishing when the event is already the canonical location (another tab, a reload)', async () => {
    const s = fakeSession({ canonical: event });
    const r = fakeRelays();
    const a = createHandoffArrival({ event, world: WORLD_ISLAND, session: () => s.session, relays: () => r.relays, verify, used });
    a.update();
    await flush();
    expect(a.state().status).toBe('done');
    expect(r.published).toHaveLength(0);
  });

  it('no relay accepting: failed, the same event again on retry, once accepted done', async () => {
    const s = fakeSession({ canonical: home });
    const r = fakeRelays({ fail: true });
    const a = createHandoffArrival({ event, world: WORLD_ISLAND, session: () => s.session, relays: () => r.relays, verify, used });
    a.update();
    await flush();
    expect(a.state()).toMatchObject({ status: 'failed', reason: 'unreachable' });
    expect(used.has(event.id)).toBe(false);
    // Nothing happens by itself
    a.update();
    await flush();
    expect(a.state().status).toBe('failed');
    r.relays.fail = false;
    await a.retry();
    expect(a.state().status).toBe('done');
    expect(r.published.map((e) => e.id)).toEqual([event.id, event.id]);
  });

  it('expires while held, and expires before a retry; a disposed controller does nothing more', async () => {
    const s = fakeSession({ resolution: 'pending', canonical: null });
    const r = fakeRelays();
    const a = createHandoffArrival({ event, world: WORLD_ISLAND, session: () => s.session, relays: () => r.relays, verify, used });
    a.update();
    expect(a.state().status).toBe('holding');
    vi.setSystemTime(now + (HANDOFF_MAX_AGE_S + 1) * 1000);
    a.update();
    expect(a.state()).toMatchObject({ status: 'dropped', reason: 'expired' });
    vi.setSystemTime(now);
    const s2 = fakeSession({ canonical: home });
    const r2 = fakeRelays({ fail: true });
    const b = createHandoffArrival({ event, world: WORLD_ISLAND, session: () => s2.session, relays: () => r2.relays, verify, used });
    b.update();
    await flush();
    expect(b.state().status).toBe('failed');
    vi.setSystemTime(now + (HANDOFF_MAX_AGE_S + 1) * 1000);
    await b.retry();
    expect(b.state()).toMatchObject({ status: 'dropped', reason: 'expired' });
    const c = createHandoffArrival({ event, world: WORLD_ISLAND, session: () => s2.session, relays: () => r2.relays, verify, used });
    c.dispose();
    c.update();
    await flush();
    expect(c.state().status).toBe('holding');
  });

  it('a session that is gone, or no relays: holds, publishes nothing', async () => {
    const r = fakeRelays();
    const a = createHandoffArrival({ event, world: WORLD_ISLAND, session: () => null, relays: () => r.relays, verify, used });
    a.update();
    await flush();
    expect(a.state().status).toBe('holding');
    const s = fakeSession({ canonical: home });
    const b = createHandoffArrival({ event, world: WORLD_ISLAND, session: () => s.session, relays: () => null, verify, used });
    b.update();
    await flush();
    expect(b.state()).toMatchObject({ status: 'failed', reason: 'unreachable' });
  });
});
