/**
 * World presence v1 in a browser page: where the lease is kept, and the page
 * that reads it, claims it and renews it by the rules in `world-presence.ts`.
 * No React and no app code: the same file lives in Blobbi Standalone
 * (`src/features/presence/`) and Blobbi Pixel (`src/game/`); keep them equal.
 *
 * WHERE THE LEASE IS KEPT: one first-party cookie per account,
 * `blobbi_presence_<accountKey>`. A cookie is the one place the browser shares
 * between the apps' origins with no new service, no frame and no change to
 * their security headers: cookies are scoped by host, not port (so
 * `127.0.0.1:8080` and `127.0.0.1:5177` share it in development), and with
 * `Domain=blobbi.pet` every `*.blobbi.pet` app shares it in production. Its
 * value is the lease only (`1.<app>.<tab>.<at>.<exp>`, no key, no pubkey, no
 * place inside a world), and its `max-age` ends with the lease, so a lapsed one
 * is gone from the browser and from requests. Another origin (a Vercel
 * preview, a different host) shares nothing: each app then keeps the Blobbi
 * by itself, today's behaviour. Nothing is ever sent to a relay.
 *
 * WHEN IT FAILS (cookies blocked, a throwing accessor): the page reads "no
 * lease" and writes nothing, so every app shows the Blobbi as before.
 */
import {
  RENEW_MS,
  decide,
  decodeLease,
  encodeLease,
  placeOf,
  reconcile,
  accountKey,
  type Lease,
  type PageState,
  type PresenceEvent,
} from './world-presence';

export interface LeaseStore {
  read(): Lease | null;
  write(lease: Lease, now: number): void;
  clear(): void;
}

/** The registrable domain the apps share, or null to keep the cookie to this host. */
export function sharedCookieDomain(hostname: string): string | null {
  return hostname === 'blobbi.pet' || hostname.endsWith('.blobbi.pet') ? 'blobbi.pet' : null;
}

export function cookieName(pubkey: string): string {
  return `blobbi_presence_${accountKey(pubkey)}`;
}

/** The lease in a cookie. Every access is guarded: a browser that refuses cookies reads as no lease. */
export function cookieLeaseStore(pubkey: string, doc: Pick<Document, 'cookie'> = document, loc: Pick<Location, 'hostname' | 'protocol'> = location): LeaseStore {
  const name = cookieName(pubkey);
  const attrs = () => {
    const domain = sharedCookieDomain(loc.hostname);
    return `; path=/; SameSite=Lax${domain ? `; domain=${domain}` : ''}${loc.protocol === 'https:' ? '; Secure' : ''}`;
  };
  return {
    read() {
      try {
        for (const part of doc.cookie.split(';')) {
          const eq = part.indexOf('=');
          if (eq > 0 && part.slice(0, eq).trim() === name) return decodeLease(decodeURIComponent(part.slice(eq + 1).trim()));
        }
      } catch {
        /* cookies refused: no lease */
      }
      return null;
    },
    write(lease, now) {
      try {
        const seconds = Math.max(1, Math.ceil((lease.exp - now) / 1000));
        doc.cookie = `${name}=${encodeURIComponent(encodeLease(lease))}; max-age=${seconds}${attrs()}`;
      } catch {
        /* cookies refused: nothing written, nothing shared */
      }
    },
    clear() {
      try {
        doc.cookie = `${name}=; max-age=0${attrs()}`;
      } catch {
        /* nothing to clear */
      }
    },
  };
}

/** A lease kept in memory: tests, and a page that shares with no one. */
export function memoryLeaseStore(): LeaseStore & { lease: Lease | null } {
  const s = {
    lease: null as Lease | null,
    read: () => s.lease,
    write: (lease: Lease) => {
      s.lease = lease;
    },
    clear: () => {
      s.lease = null;
    },
  };
  return s;
}

export interface PresencePageOptions {
  app: string;
  store: LeaseStore;
  /** The page id; random by default. */
  tab?: string;
  /** How often the lease is re-read while visible (another page's claim shows up within this). */
  pollMs?: number;
  /** Whether an input event is the player's (default: the browser's `isTrusted`; a script's event never claims). */
  trusted?: (e: Event) => boolean;
  /** Test seams. */
  doc?: Pick<Document, 'visibilityState' | 'hasFocus' | 'addEventListener' | 'removeEventListener'>;
  win?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface PresenceSnapshot {
  /** Where the Blobbi is: `home`, `pixel`, … */
  place: string;
  /** Whether it belongs in this app. */
  here: boolean;
  visible: boolean;
  /** When the page last became visible (the clock's ms), or null while hidden. */
  visibleSince: number | null;
}

export interface PresencePage {
  snapshot(): PresenceSnapshot;
  subscribe(listener: (s: PresenceSnapshot) => void): () => void;
  /** A real input the app saw by itself (the page also listens for pointer presses and keys). */
  input(): void;
  /** Re-read the lease now (an app that knows something changed). */
  refresh(): void;
  dispose(): void;
}

const INPUT_EVENTS = ['pointerdown', 'keydown'] as const;

function randomTab(): string {
  try {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  } catch {
    return Math.random().toString(36).slice(2, 12) || 'tab';
  }
}

/**
 * One page's presence. Listens (passively, never preventing anything) for pointer presses and keys, visibility,
 * focus and the page going away; re-reads the lease every `pollMs` while visible and every few seconds while hidden;
 * writes only what `decide` asks for.
 */
export function createPresencePage({
  app,
  store,
  tab = randomTab(),
  pollMs = 1_000,
  trusted = (e) => e.isTrusted,
  doc = document,
  win = window,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
}: PresencePageOptions): PresencePage {
  const isVisible = () => doc.visibilityState === 'visible';
  const isFocused = () => {
    try {
      return doc.hasFocus();
    } catch {
      return false;
    }
  };
  const page: PageState = { app, tab, visible: isVisible(), focused: isFocused(), lastInputAt: null, lastClaimAt: null };
  let lease = store.read();
  let visibleSince: number | null = page.visible ? now() : null;
  let snap: PresenceSnapshot = make();
  let timer: unknown = null;
  let disposed = false;
  let lastRenewCheck = 0;
  const listeners = new Set<(s: PresenceSnapshot) => void>();

  function make(): PresenceSnapshot {
    const place = placeOf(lease, now());
    return { place, here: place === app, visible: page.visible, visibleSince };
  }
  const emit = () => {
    const next = make();
    if (next.place === snap.place && next.visible === snap.visible && next.visibleSince === snap.visibleSince) return;
    snap = next;
    for (const l of listeners) l(snap);
  };
  const act = (event: PresenceEvent) => {
    const t = now();
    lease = store.read();
    const d = decide(lease, page, event, t);
    if ('write' in d) {
      store.write(d.write, t);
      if (d.write.at === t) page.lastClaimAt = t;
      lease = d.write;
    } else if ('clear' in d) {
      store.clear();
      lease = null;
    }
  };
  const loop = () => {
    timer = null;
    if (disposed) return;
    page.visible = isVisible();
    page.focused = isFocused();
    const t = now();
    if (t - lastRenewCheck >= Math.min(RENEW_MS / 3, 5_000)) {
      lastRenewCheck = t;
      act('tick');
    } else {
      lease = store.read();
    }
    emit();
    timer = setTimer(loop, page.visible ? pollMs : 5_000);
  };
  const onInput = (e: Event) => {
    // A synthetic event (dispatched by script) is not the player
    if (disposed || !trusted(e)) return;
    page.lastInputAt = now();
    page.visible = isVisible();
    page.focused = isFocused() || page.visible;
    act('input');
    emit();
  };
  const onVisibility = () => {
    page.visible = isVisible();
    page.focused = isFocused();
    visibleSince = page.visible ? now() : null;
    lease = store.read();
    emit();
    if (timer !== null) clearTimer(timer);
    timer = setTimer(loop, page.visible ? pollMs : 5_000);
  };
  const onFocus = () => {
    page.focused = isFocused();
  };
  const onHide = () => {
    page.visible = false;
    page.focused = false;
    act('pagehide');
  };
  const onShow = (e: Event) => {
    // Back from the back-forward cache: the page is live again
    if ((e as PageTransitionEvent).persisted) onVisibility();
  };

  for (const type of INPUT_EVENTS) win.addEventListener(type, onInput, { capture: true, passive: true });
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('focus', onFocus);
  win.addEventListener('blur', onFocus);
  win.addEventListener('pagehide', onHide);
  win.addEventListener('pageshow', onShow);
  timer = setTimer(loop, pollMs);

  return {
    snapshot: () => snap,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    input() {
      if (disposed) return;
      page.lastInputAt = now();
      page.visible = isVisible();
      page.focused = isFocused() || page.visible;
      act('input');
      emit();
    },
    refresh() {
      lease = store.read();
      emit();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
      for (const type of INPUT_EVENTS) win.removeEventListener(type, onInput, { capture: true });
      doc.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('focus', onFocus);
      win.removeEventListener('blur', onFocus);
      win.removeEventListener('pagehide', onHide);
      win.removeEventListener('pageshow', onShow);
      listeners.clear();
    },
  };
}

/** The Blobbi on screen, in the teleport's words: what an app gives the sync to drive. */
export interface ShownBlobbi {
  state(): 'present' | 'departing' | 'absent' | 'arriving';
  enter(): void;
  leave(): void;
}

export interface PresenceSync {
  check(): void;
  dispose(): void;
}

export interface PresenceSyncOptions {
  page: PresencePage;
  blobbi: ShownBlobbi;
  /** The app's own moment that a departure waits for (an action, a menu, a minigame, a journey of its own). */
  busy?: () => boolean;
  /** A journey began because of where the Blobbi is (`leave` names where it went). */
  onJourney?: (kind: 'enter' | 'leave', place: string) => void;
  /** How often a waiting journey is re-checked (busy and the visible grace end on their own). */
  checkMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/**
 * Brings the Blobbi on screen in line with where it is (`reconcile`), and keeps checking while the two differ: a
 * departure waits for the app's moment to end and for the page to have been visible a moment. `check` looks again
 * now (the app's own moment ended, or it moved the Blobbi itself).
 */
export function syncPresence({
  page,
  blobbi,
  busy = () => false,
  onJourney,
  checkMs = 300,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
}: PresenceSyncOptions): PresenceSync {
  let timer: unknown = null;
  let disposed = false;
  const check = () => {
    timer = null;
    if (disposed) return;
    const s = page.snapshot();
    const shown = blobbi.state();
    const action = reconcile({ here: s.here, shown, visible: s.visible, visibleFor: s.visibleSince === null ? 0 : now() - s.visibleSince, busy: busy() });
    if (action === 'enter') {
      blobbi.enter();
      onJourney?.('enter', s.place);
    } else if (action === 'leave') {
      blobbi.leave();
      onJourney?.('leave', s.place);
    }
    // Still not in line (waiting for busy, the grace, or the page to be seen): look again soon
    const after = blobbi.state();
    const settled = s.here ? after === 'present' || after === 'arriving' : after === 'absent' || after === 'departing';
    if (!settled) timer = setTimer(check, checkMs);
  };
  const unsubscribe = page.subscribe(() => {
    if (timer !== null) clearTimer(timer);
    check();
  });
  check();
  return {
    check() {
      if (disposed) return;
      if (timer !== null) clearTimer(timer);
      check();
    },
    dispose() {
      disposed = true;
      unsubscribe();
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
}
