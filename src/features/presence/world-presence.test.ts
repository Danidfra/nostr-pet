import { describe, expect, it } from 'vitest';
import vectors from './world-presence.vectors.json';
import {
  CLAIM_COOLDOWN_MS,
  HOME_APP,
  LEASE_MS,
  MIN_STAY_MS,
  PIXEL_APP,
  RENEW_MS,
  accountKey,
  decide,
  decodeLease,
  encodeLease,
  placeOf,
  reconcile,
  type Decision,
  type Lease,
  type PageState,
  type PresenceEvent,
  type ViewState,
} from './world-presence';

describe('world presence v1: the shared vectors', () => {
  it('is the protocol the vectors name', () => {
    expect(vectors.protocol).toBe('blobbi-world-presence/1');
  });

  it.each(vectors.codec)('codec: $name', ({ lease, encoded }) => {
    expect(encodeLease(lease)).toBe(encoded);
    expect(decodeLease(encoded)).toEqual(lease);
  });

  it.each(vectors.rejected)('rejects %j', (value) => {
    expect(decodeLease(value)).toBeNull();
  });

  it.each(vectors.accountKey)('accountKey($pubkey)', ({ pubkey, key }) => {
    expect(accountKey(pubkey)).toBe(key);
  });

  it.each(vectors.place)('place: $name', ({ lease, now, place }) => {
    expect(placeOf(lease as Lease | null, now)).toBe(place);
  });

  it.each(vectors.decide)('decide: $name', ({ lease, page, event, now, decision }) => {
    expect(decide(lease as Lease | null, page as PageState, event as PresenceEvent, now)).toEqual(decision);
  });

  it.each(vectors.reconcile)('reconcile: $name', ({ view, action }) => {
    expect(reconcile(view as ViewState)).toBe(action);
  });
});

/** A browser's worth of pages sharing one stored lease, stepped by hand. The lease is kept ENCODED, as the cookie
 * keeps it, so every read goes through the codec (a lease the codec refuses is no lease, as in a browser). */
function browser() {
  let raw: string | null = null;
  const read = () => decodeLease(raw);
  let writes = 0;
  const pages = new Map<string, PageState>();
  const apply = (d: Decision, page: PageState, now: number) => {
    if ('write' in d) {
      raw = encodeLease(d.write);
      writes++;
      if (d.write.at === now) page.lastClaimAt = now;
    } else if ('clear' in d) {
      raw = null;
      writes++;
    }
  };
  return {
    page(app: string, tab: string, visible = true, focused = true) {
      const p: PageState = { app, tab, visible, focused, lastInputAt: null, lastClaimAt: null };
      pages.set(tab, p);
      return p;
    },
    input(tab: string, now: number) {
      const p = pages.get(tab)!;
      p.lastInputAt = now;
      apply(decide(read(), p, 'input', now), p, now);
    },
    tick(now: number) {
      for (const p of pages.values()) apply(decide(read(), p, 'tick', now), p, now);
    },
    hide(tab: string, now: number) {
      const p = pages.get(tab)!;
      apply(decide(read(), p, 'pagehide', now), p, now);
      pages.delete(tab);
    },
    place: (now: number) => placeOf(read(), now),
    get writes() {
      return writes;
    },
  };
}

describe('world presence v1: whole stories', () => {
  it('Pixel takes the Blobbi with an input, an active Pixel keeps it, and an idle Pixel lets it drift home', () => {
    const b = browser();
    b.page(HOME_APP, 'h1');
    b.page(PIXEL_APP, 'p1');
    expect(b.place(0)).toBe(HOME_APP);
    b.input('p1', 0);
    expect(b.place(0)).toBe(PIXEL_APP);
    // Played for two minutes: renewed every RENEW_MS, never lapsing
    for (let t = 1000; t <= 120_000; t += 1000) {
      if (t % 10_000 === 0) b.input('p1', t);
      b.tick(t);
      expect(b.place(t)).toBe(PIXEL_APP);
    }
    // Writes: one claim plus a renewal every RENEW_MS, never one per tick
    expect(b.writes).toBeLessThanOrEqual(1 + Math.ceil(120_000 / RENEW_MS));
    // Then nothing for longer than ACTIVE_MS: the lease lapses within LEASE_MS of the last renewal
    let home = -1;
    for (let t = 121_000; t <= 120_000 + 5 * 60_000 + LEASE_MS + RENEW_MS; t += 1000) {
      b.tick(t);
      if (home < 0 && b.place(t) === HOME_APP) home = t;
    }
    expect(home).toBeGreaterThan(0);
  });

  it('an hour of active play in Pixel keeps the Blobbi there the whole time (renewals keep the claim time)', () => {
    const b = browser();
    b.page(HOME_APP, 'h1');
    b.page(PIXEL_APP, 'p1');
    b.input('p1', 0);
    for (let t = 1000; t <= 3_600_000; t += 1000) {
      if (t % 4000 === 0) b.input('p1', t);
      b.tick(t);
      expect(b.place(t)).toBe(PIXEL_APP);
    }
  });

  it('a hidden Pixel tab never keeps the Blobbi', () => {
    const b = browser();
    const p = b.page(PIXEL_APP, 'p1');
    b.input('p1', 0);
    p.visible = false;
    p.focused = false;
    for (let t = 1000; t <= LEASE_MS; t += 1000) b.tick(t);
    expect(b.place(LEASE_MS)).toBe(HOME_APP);
  });

  it('returning home with an input brings it back; closing Pixel gives it back at once', () => {
    const b = browser();
    b.page(HOME_APP, 'h1');
    b.page(PIXEL_APP, 'p1');
    b.input('p1', 0);
    b.input('h1', 10_000);
    expect(b.place(10_000)).toBe(HOME_APP);
    b.input('p1', 20_000);
    expect(b.place(20_000)).toBe(PIXEL_APP);
    b.hide('p1', 21_000);
    expect(b.place(21_000)).toBe(HOME_APP);
  });

  it('clicking back and forth between two windows moves the Blobbi at most once per MIN_STAY_MS', () => {
    const b = browser();
    b.page(HOME_APP, 'h1');
    b.page(PIXEL_APP, 'p1');
    let moves = 0;
    let last = b.place(0);
    for (let t = 0; t < 20_000; t += 250) {
      b.input(t % 500 === 0 ? 'p1' : 'h1', t);
      const now = b.place(t);
      if (now !== last) moves++;
      last = now;
    }
    expect(moves).toBeLessThanOrEqual(Math.ceil(20_000 / MIN_STAY_MS) + 1);
    expect(MIN_STAY_MS).toBeGreaterThan(CLAIM_COOLDOWN_MS);
  });

  it('two Pixel tabs never move it: the second takes the renewal over and the place stays', () => {
    const b = browser();
    b.page(PIXEL_APP, 'p1');
    b.page(PIXEL_APP, 'p2');
    b.input('p1', 0);
    for (let t = 1000; t <= 200_000; t += 1000) {
      b.input(t % 2000 === 0 ? 'p1' : 'p2', t);
      b.tick(t);
      expect(b.place(t)).toBe(PIXEL_APP);
    }
  });

  it('pages that never get an input never write, however long they stay open', () => {
    const b = browser();
    b.page(HOME_APP, 'h1');
    b.page(PIXEL_APP, 'p1');
    b.page(PIXEL_APP, 'p2', false, false);
    for (let t = 0; t <= 600_000; t += 1000) b.tick(t);
    expect(b.writes).toBe(0);
    expect(b.place(600_000)).toBe(HOME_APP);
  });
});
