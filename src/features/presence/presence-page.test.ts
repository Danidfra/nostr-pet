import { afterEach, describe, expect, it } from 'vitest';
import {
  cookieLeaseStore,
  cookieName,
  createPresencePage,
  memoryLeaseStore,
  sharedCookieDomain,
  syncPresence,
  type LeaseStore,
  type ShownBlobbi,
} from './presence-page';
import { HOME_APP, LEASE_MS, MIN_STAY_MS, PIXEL_APP, VISIBLE_GRACE_MS, encodeLease } from './world-presence';

const PUBKEY = 'a'.repeat(64);

/** One clock and one timer queue for every page of a pretend browser. */
function world(start = 1_800_000_000_000) {
  let t = start;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const advance = (ms: number) => {
    const end = t + ms;
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | null = null;
      for (const e of timers) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
      if (!next) break;
      timers.delete(next[0]);
      t = Math.max(t, next[1].at);
      next[1].fn();
    }
    t = end;
  };
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => {
      const id = ++seq;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimer: (h: unknown) => {
      timers.delete(h as number);
    },
    advance,
  };
}

/** jsdom's events are never trusted; the tests mark the player's own. */
const TRUSTED = new WeakSet<Event>();

/** A pretend window and document: visible and focused unless told otherwise. */
function fakeWindow() {
  const target = new EventTarget();
  const doc = Object.assign(new EventTarget(), {
    visibilityState: 'visible' as DocumentVisibilityState,
    focused: true,
    hasFocus() {
      return this.focused;
    },
  });
  const press = (type: 'pointerdown' | 'keydown' = 'pointerdown', trusted = true) => {
    const e = new Event(type);
    if (trusted) TRUSTED.add(e);
    target.dispatchEvent(e);
  };
  const hide = () => {
    doc.visibilityState = 'hidden';
    doc.focused = false;
    doc.dispatchEvent(new Event('visibilitychange'));
  };
  const show = () => {
    doc.visibilityState = 'visible';
    doc.focused = true;
    doc.dispatchEvent(new Event('visibilitychange'));
  };
  const close = () => target.dispatchEvent(new Event('pagehide'));
  return { win: target as unknown as Window, doc: doc as unknown as Document, raw: doc, press, hide, show, close };
}

function openPage(w: ReturnType<typeof world>, app: string, store: LeaseStore, tab: string) {
  const fw = fakeWindow();
  const page = createPresencePage({ app, store, tab, trusted: (e) => TRUSTED.has(e), doc: fw.doc, win: fw.win, now: w.now, setTimer: w.setTimer, clearTimer: w.clearTimer });
  return { ...fw, page };
}

/** A Blobbi on screen that journeys instantly-ish: a journey takes 2 s on the shared clock. */
function shown(w: ReturnType<typeof world>, initial: 'present' | 'absent' = 'present'): ShownBlobbi & { journeys: string[] } {
  let state: 'present' | 'departing' | 'absent' | 'arriving' = initial;
  const journeys: string[] = [];
  return {
    journeys,
    state: () => state,
    enter() {
      if (state === 'present' || state === 'arriving') return;
      state = 'arriving';
      journeys.push('enter');
      w.setTimer(() => {
        if (state === 'arriving') state = 'present';
      }, 2000);
    },
    leave() {
      if (state === 'absent' || state === 'departing') return;
      state = 'departing';
      journeys.push('leave');
      w.setTimer(() => {
        if (state === 'departing') state = 'absent';
      }, 2000);
    },
  };
}

describe('the page: claims only on a real input', () => {
  it('a press in Pixel takes the Blobbi there; the home sees it go within a poll', () => {
    const w = world();
    const store = memoryLeaseStore();
    const home = openPage(w, HOME_APP, store, 'h1');
    const pixel = openPage(w, PIXEL_APP, store, 'p1');
    expect(home.page.snapshot().here).toBe(true);
    expect(pixel.page.snapshot().here).toBe(false);
    w.advance(10_000);
    // Ten seconds open, nothing pressed: nothing written
    expect(store.lease).toBeNull();
    pixel.press();
    expect(pixel.page.snapshot().place).toBe(PIXEL_APP);
    expect(store.lease?.app).toBe(PIXEL_APP);
    w.advance(1_000);
    expect(home.page.snapshot()).toMatchObject({ place: PIXEL_APP, here: false });
  });

  it('a synthetic event, focus or visibility never claims', () => {
    const w = world();
    const store = memoryLeaseStore();
    const pixel = openPage(w, PIXEL_APP, store, 'p1');
    pixel.press('pointerdown', false);
    pixel.hide();
    pixel.show();
    pixel.win.dispatchEvent(new Event('focus'));
    w.advance(60_000);
    expect(store.lease).toBeNull();
  });

  it('a press in a hidden or unfocused page never claims', () => {
    const w = world();
    const store = memoryLeaseStore();
    const pixel = openPage(w, PIXEL_APP, store, 'p1');
    pixel.raw.visibilityState = 'hidden';
    pixel.press('keydown');
    expect(store.lease).toBeNull();
  });

  it('an active holder keeps it; a hidden one lets it lapse home within the lease', () => {
    const w = world();
    const store = memoryLeaseStore();
    const home = openPage(w, HOME_APP, store, 'h1');
    const pixel = openPage(w, PIXEL_APP, store, 'p1');
    pixel.press();
    for (let i = 0; i < 12; i++) {
      w.advance(10_000);
      pixel.press('keydown');
    }
    expect(home.page.snapshot().place).toBe(PIXEL_APP);
    pixel.hide();
    w.advance(LEASE_MS + 6_000);
    expect(home.page.snapshot().place).toBe(HOME_APP);
    expect(pixel.page.snapshot().here).toBe(false);
  });

  it('closing the holder gives it back at once', () => {
    const w = world();
    const store = memoryLeaseStore();
    const home = openPage(w, HOME_APP, store, 'h1');
    const pixel = openPage(w, PIXEL_APP, store, 'p1');
    pixel.press();
    pixel.close();
    expect(store.lease).toBeNull();
    w.advance(1_000);
    expect(home.page.snapshot().here).toBe(true);
  });

  it('a press at home brings it back, but not in the same breath as Pixel took it', () => {
    const w = world();
    const store = memoryLeaseStore();
    const home = openPage(w, HOME_APP, store, 'h1');
    const pixel = openPage(w, PIXEL_APP, store, 'p1');
    pixel.press();
    w.advance(500);
    home.press();
    expect(store.lease?.app).toBe(PIXEL_APP);
    w.advance(MIN_STAY_MS);
    home.press();
    expect(store.lease?.app).toBe(HOME_APP);
    expect(home.page.snapshot().here).toBe(true);
  });

  it('two Pixel tabs: either one keeps it, and the place never changes between them', () => {
    const w = world();
    const store = memoryLeaseStore();
    const home = openPage(w, HOME_APP, store, 'h1');
    const a = openPage(w, PIXEL_APP, store, 'p1');
    const b = openPage(w, PIXEL_APP, store, 'p2');
    a.press();
    const places = new Set<string>();
    for (let i = 0; i < 40; i++) {
      w.advance(5_000);
      (i % 2 ? a : b).press();
      places.add(home.page.snapshot().place);
    }
    expect([...places]).toEqual([PIXEL_APP]);
  });

  it('dispose removes every listener and timer', () => {
    const w = world();
    const store = memoryLeaseStore();
    const pixel = openPage(w, PIXEL_APP, store, 'p1');
    pixel.page.dispose();
    pixel.press();
    w.advance(60_000);
    expect(store.lease).toBeNull();
  });
});

describe('the lease in a cookie', () => {
  afterEach(() => {
    document.cookie = `${cookieName(PUBKEY)}=; max-age=0; path=/`;
  });

  it('shares the cookie across *.blobbi.pet and keeps it to the host elsewhere', () => {
    expect(sharedCookieDomain('blobbi.pet')).toBe('blobbi.pet');
    expect(sharedCookieDomain('pixel.blobbi.pet')).toBe('blobbi.pet');
    expect(sharedCookieDomain('notblobbi.pet')).toBeNull();
    expect(sharedCookieDomain('nostr-pet-git-x.vercel.app')).toBeNull();
    expect(sharedCookieDomain('127.0.0.1')).toBeNull();
  });

  it('round-trips through jsdom\'s cookie jar and names no pubkey', () => {
    const store = cookieLeaseStore(PUBKEY);
    const now = Date.now();
    const lease = { app: PIXEL_APP, tab: 'p1', at: now, exp: now + LEASE_MS };
    store.write(lease, now);
    expect(store.read()).toEqual(lease);
    expect(document.cookie).not.toContain(PUBKEY);
    expect(document.cookie).toContain(encodeURIComponent(encodeLease(lease)));
    store.clear();
    expect(store.read()).toBeNull();
  });

  it('writes the attributes: path, SameSite, the shared domain and Secure on https, and a max-age ending with the lease', () => {
    const set: string[] = [];
    const doc = {
      get cookie() {
        return '';
      },
      set cookie(v: string) {
        set.push(v);
      },
    };
    const store = cookieLeaseStore(PUBKEY, doc, { hostname: 'pixel.blobbi.pet', protocol: 'https:' });
    store.write({ app: PIXEL_APP, tab: 'p1', at: 0, exp: LEASE_MS }, 0);
    expect(set[0]).toMatch(/; max-age=45; path=\/; SameSite=Lax; domain=blobbi\.pet; Secure$/);
    store.clear();
    expect(set[1]).toMatch(/=; max-age=0; path=\/; SameSite=Lax; domain=blobbi\.pet; Secure$/);
  });

  it('a browser that refuses cookies reads no lease and never throws', () => {
    const doc = {
      get cookie(): string {
        throw new Error('SecurityError');
      },
      set cookie(_v: string) {
        throw new Error('SecurityError');
      },
    };
    const store = cookieLeaseStore(PUBKEY, doc, { hostname: '127.0.0.1', protocol: 'http:' });
    expect(() => store.write({ app: PIXEL_APP, tab: 'p1', at: 0, exp: LEASE_MS }, 0)).not.toThrow();
    expect(store.read()).toBeNull();
    expect(() => store.clear()).not.toThrow();
  });

  it('ignores a malformed or foreign value', () => {
    document.cookie = `${cookieName(PUBKEY)}=garbage; path=/`;
    expect(cookieLeaseStore(PUBKEY).read()).toBeNull();
    document.cookie = `${cookieName(PUBKEY)}=${encodeURIComponent('2.pixel.p1.a.b')}; path=/`;
    expect(cookieLeaseStore(PUBKEY).read()).toBeNull();
  });
});

describe('the sync: the Blobbi on screen follows where it is, gently', () => {
  it('leaves home when Pixel takes it, and comes back when the home is used again', () => {
    const w = world();
    const store = memoryLeaseStore();
    const home = openPage(w, HOME_APP, store, 'h1');
    const pixel = openPage(w, PIXEL_APP, store, 'p1');
    const homeBlobbi = shown(w, 'present');
    const pixelBlobbi = shown(w, 'absent');
    const opts = { now: w.now, setTimer: w.setTimer, clearTimer: w.clearTimer };
    syncPresence({ page: home.page, blobbi: homeBlobbi, ...opts });
    syncPresence({ page: pixel.page, blobbi: pixelBlobbi, ...opts });
    w.advance(VISIBLE_GRACE_MS);
    pixel.press();
    expect(pixelBlobbi.state()).toBe('arriving');
    w.advance(1_000);
    expect(homeBlobbi.state()).toBe('departing');
    w.advance(5_000);
    expect(homeBlobbi.state()).toBe('absent');
    expect(pixelBlobbi.state()).toBe('present');
    home.press();
    expect(homeBlobbi.state()).toBe('arriving');
    w.advance(1_000);
    expect(pixelBlobbi.state()).toBe('departing');
    expect(homeBlobbi.journeys).toEqual(['leave', 'enter']);
    expect(pixelBlobbi.journeys).toEqual(['enter', 'leave']);
  });

  it('a departure waits while the app is busy, then plays', () => {
    const w = world();
    const store = memoryLeaseStore();
    const pixel = openPage(w, PIXEL_APP, store, 'p1');
    const home = openPage(w, HOME_APP, store, 'h1');
    let busy = true;
    const blobbi = shown(w, 'absent');
    syncPresence({ page: pixel.page, blobbi, busy: () => busy, now: w.now, setTimer: w.setTimer, clearTimer: w.clearTimer });
    pixel.press();
    w.advance(MIN_STAY_MS + 2_000);
    home.press();
    w.advance(10_000);
    expect(blobbi.state()).toBe('present');
    busy = false;
    w.advance(400);
    expect(blobbi.state()).toBe('departing');
  });

  it('a hidden page waits to play its journey until it is seen, then a moment more for a departure', () => {
    const w = world();
    const store = memoryLeaseStore();
    const home = openPage(w, HOME_APP, store, 'h1');
    const pixel = openPage(w, PIXEL_APP, store, 'p1');
    const blobbi = shown(w, 'present');
    syncPresence({ page: home.page, blobbi, now: w.now, setTimer: w.setTimer, clearTimer: w.clearTimer });
    home.hide();
    pixel.press();
    w.advance(20_000);
    expect(blobbi.state()).toBe('present');
    home.show();
    w.advance(VISIBLE_GRACE_MS - 400);
    expect(blobbi.state()).toBe('present');
    w.advance(800);
    expect(blobbi.state()).toBe('departing');
  });

  it('coming back to a page whose lease lapsed: a press within the grace reclaims, with no departure first', () => {
    const w = world();
    const store = memoryLeaseStore();
    const pixel = openPage(w, PIXEL_APP, store, 'p1');
    const blobbi = shown(w, 'absent');
    syncPresence({ page: pixel.page, blobbi, now: w.now, setTimer: w.setTimer, clearTimer: w.clearTimer });
    pixel.press();
    w.advance(3_000);
    pixel.hide();
    w.advance(LEASE_MS + 10_000);
    pixel.show();
    w.advance(500);
    pixel.press();
    w.advance(5_000);
    expect(blobbi.journeys).toEqual(['enter']);
    expect(blobbi.state()).toBe('present');
  });

  it('cookies refused: every app keeps showing its Blobbi, as before', () => {
    const w = world();
    const refusing: LeaseStore = {
      read: () => null,
      write: () => {
        /* refused */
      },
      clear: () => {
        /* refused */
      },
    };
    const home = openPage(w, HOME_APP, refusing, 'h1');
    const blobbi = shown(w, 'present');
    syncPresence({ page: home.page, blobbi, now: w.now, setTimer: w.setTimer, clearTimer: w.clearTimer });
    home.press();
    w.advance(60_000);
    expect(blobbi.journeys).toEqual([]);
  });
});
