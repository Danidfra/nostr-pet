/**
 * Where the home's Blobbi is, in whichever presence this page runs (`travel-mode.ts`), behind one interface for the
 * classic home and the room:
 *
 *   v1     the cookie lease of world presence v1 (`useWorldPresence`), exactly as before;
 *   nostr  world travel on Nostr (M16): the Blobbi's World Location (kind 31126) is the authority, read from the
 *          relays every Blobbi world uses (`BLOBBI_WORLD_TRAVEL_RELAYS`), on any device. The protocol is the kit's
 *          (`@blobbi-kit/core` world-travel, `useWorldTravel`); this hook only wires the home to it:
 *            - only a signed-in account (never a guest, never a dev fixture) has a session; anyone else's Blobbi is
 *              simply home;
 *            - the player's act moves it: a trusted press or key in a visible, focused page while it is away (never
 *              one inside a sheet or a menu, `[data-overlay]`, or `[data-world-travel="ignore"]`), or the away
 *              card's "Call home" (explicit). Never a load, a focus, a timer or a re-render;
 *            - signed by the account's own signer (`usePublishAdapter().sign`): an nsec login signs silently, an
 *              extension or a remote signer may ask;
 *            - optional Active Presence (kind 21124), the player's choice (`active-presence-choice.ts`).
 *          The cookie is never read or written in this mode.
 *
 * The companion choice (11125) is untouched in both: which Blobbi it is stays `current_companion`'s business.
 */
import { createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNostr } from '@nostrify/react';
import { useNostrLogin } from '@nostrify/react/login';
import { verifyEvent } from 'nostr-tools/pure';
import {
  BLOBBI_WORLD_TRAVEL_RELAYS,
  WORLD_HOME,
  currentWorld,
  isMeaningfulInput,
  isPlayedNow,
  knownWorld,
  parseWorldLocation,
  type NostrEvent,
  type ShownBlobbi,
  type WorldTravelOptions,
  type WorldTravelSession,
  type WorldTravelSnapshot,
  type WorldTravelStore,
} from '@blobbi-kit/core';
import { poolWorldTravelRelays, useWorldTravel, useWorldTravelSync, type TravelPoolLike } from '@blobbi-kit/react';
import { DevFixtureContext } from '@/dev/DevFixtureContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePublishAdapter } from '@/features/care/usePublishAdapter';
import { canAskRelays } from '@/features/companion/pool-relays';
import type { Presence } from '@/features/teleport/react/usePresence';
import { blobbiIsHome, useWorldPresence, useWorldPresenceSync } from './useWorldPresence';
import { placeName } from './world-presence';
import { isTrustedInput, travelMode } from './travel-mode';
import { reportPresenceStatus, useActivePresenceChoice } from './active-presence-choice';

/** Where the kit keeps the last signed location of a Blobbi (the same key as `createWorldTravel`'s store). */
const storedLocationKey = (owner: string, d: string) => `blobbi-kit:world-location:v1:${owner}:${d}`;

/** The page's storage for the kit's session, every access guarded (a refusing browser keeps nothing). */
const pageStore: WorldTravelStore = {
  get(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* not kept */
    }
  },
  remove(key) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* nothing kept */
    }
  },
};

/** One move per Blobbi across this browser's tabs, when the browser has Web Locks. */
function webLock(): WorldTravelOptions['lock'] {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (!locks?.request) return undefined;
  return (name, fn) => locks.request(name, () => fn()) as ReturnType<typeof fn>;
}

const safeVerify = (e: NostrEvent) => {
  try {
    return verifyEvent(e as Parameters<typeof verifyEvent>[0]);
  } catch {
    return false;
  }
};

/**
 * Whether the Blobbi starts away, read at once for the first render (its teleport starts there: nothing is replayed
 * on load). Nostr: the last signed location this device kept, if any (the relays decide a moment later).
 */
export function travelStartsAway(pubkey: string | null | undefined, d: string): boolean {
  if (travelMode() === 'v1') return !blobbiIsHome(pubkey);
  if (!pubkey) return false;
  const raw = pageStore.get(storedLocationKey(pubkey, d));
  if (!raw) return false;
  try {
    const loc = parseWorldLocation(JSON.parse(raw), { verify: safeVerify });
    return !!loc && loc.owner === pubkey && loc.d === d && currentWorld(loc) !== WORLD_HOME;
  } catch {
    return false;
  }
}

export interface HomeTravelOptions {
  pubkey: string | undefined;
  /** The Blobbi on screen. */
  d: string;
  /** It may travel (not an egg, not a sleeper: those stay home). */
  travels: boolean;
  /** The home's teleport. */
  presence: Presence;
  /** The home's own moment, which a departure waits for. */
  busy: boolean;
  /** The home drives its Blobbi itself (an arrival on entry, a trip to another world, an egg, a sleeper). */
  paused: boolean;
  onJourney?: (kind: 'enter' | 'leave', place: string) => void;
}

export interface HomeTravel {
  mode: 'v1' | 'nostr';
  /** Where the Blobbi is (v1: `home`/`pixel`; nostr: a World id such as `blobbi-pixel`). */
  place: string;
  /** It belongs here now (and, on Nostr, is not still on its way). */
  here: boolean;
  /** The place known for sure (v1: always; nostr: the relays answered once, or there is no session). */
  known: boolean;
  /** A place, for the words around a journey ("Blobbi Pixel", "another Blobbi world"). */
  nameOf(place: string): string;
  /** The away card's button: the player's explicit act. */
  callHome(): void;
  /** Nostr only: try again after a failure (the same signed move when it is recent, else a new explicit request). */
  retry(): void;
  /** Nostr only: the session's snapshot (null in v1, signed out, a guest, a fixture). */
  snapshot: WorldTravelSnapshot | null;
  /** Nostr only: a hidden element stating place, phase and presence for tests and diagnostics. */
  status: ReactNode;
}

export function useHomeTravel(o: HomeTravelOptions): HomeTravel {
  const [mode] = useState(travelMode);
  const v1 = useV1Travel(mode === 'v1' ? o : null);
  const nostr = useNostrTravel(mode === 'nostr' ? o : null);
  return mode === 'v1' ? v1 : nostr;
}

function useV1Travel(o: HomeTravelOptions | null): HomeTravel {
  const worldPresence = useWorldPresence(o ? o.pubkey : null);
  useWorldPresenceSync({
    page: worldPresence.page,
    presence: o?.presence ?? NO_PRESENCE,
    busy: o?.busy ?? false,
    paused: o ? o.paused || !o.travels : true,
    onJourney: o?.onJourney,
  });
  return {
    mode: 'v1',
    place: worldPresence.snapshot.place,
    here: worldPresence.snapshot.here,
    known: true,
    nameOf: placeName,
    callHome: () => worldPresence.page?.input(),
    retry: () => worldPresence.page?.input(),
    snapshot: null,
    status: null,
  };
}

const nameOfWorld = (place: string) => (place === WORLD_HOME ? 'home' : (knownWorld(place)?.name ?? 'another Blobbi world'));

function useNostrTravel(o: HomeTravelOptions | null): HomeTravel {
  const { nostr } = useNostr();
  const { logins } = useNostrLogin();
  const { user } = useCurrentUser();
  const fixture = useContext(DevFixtureContext);
  const publisher = usePublishAdapter();
  const login = logins[0];
  // Only a real login moves a Blobbi: a guest's Blobbi and a dev fixture's live on this device only
  const owner = o && o.pubkey && !fixture && login && user?.pubkey === o.pubkey && canAskRelays(nostr) ? o.pubkey : null;
  const presenceOn = useActivePresenceChoice(owner);

  const sessionRef = useRef<WorldTravelSession | null>(null);
  const lastInputAt = useRef<number | null>(null);
  const latest = useRef({ publisher, user, login, owner });
  latest.current = { publisher, user, login, owner };

  const relays = useMemo(() => (canAskRelays(nostr) ? poolWorldTravelRelays(nostr as unknown as TravelPoolLike, BLOBBI_WORLD_TRAVEL_RELAYS, { onReconnect: () => void sessionRef.current?.refresh() }) : null), [nostr]);
  const options = useMemo<WorldTravelOptions | null>(() => {
    if (!owner || !o || !relays) return null;
    return {
      owner,
      d: o.d,
      world: WORLD_HOME,
      relays,
      verify: safeVerify,
      store: pageStore,
      lock: webLock(),
      signer: () => {
        const { user: u, login: l, publisher: p, owner: own } = latest.current;
        if (!u || !l || u.pubkey !== own) return null;
        return { mode: l.type === 'nsec' ? 'silent' : 'prompt', sign: (t) => p.sign(t) };
      },
      stillAccount: () => latest.current.user?.pubkey === owner && latest.current.owner === owner,
      isActive: () => isPlayedNow({ visible: typeof document === 'undefined' || document.visibilityState !== 'hidden', lastInputAt: lastInputAt.current, now: Date.now() }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one session per owner, Blobbi and relay set
  }, [owner, o?.d, relays]);
  const travel = useWorldTravel(options ? { ...options, presenceEnabled: presenceOn } : null);
  const { session, snapshot } = travel;
  sessionRef.current = session;

  const presenceStatus = snapshot?.presence.status ?? null;
  useEffect(() => {
    if (!owner) return;
    reportPresenceStatus(owner, presenceStatus);
    return () => reportPresenceStatus(owner, null);
  }, [owner, presenceStatus]);

  const controller = o?.presence.controller;
  const travels = !!o?.travels;
  useWorldTravelSync({
    session,
    blobbi: (): ShownBlobbi | null =>
      controller && !controller.isDisposed() && travels
        ? { state: () => controller.getState(), enter: () => void controller.enter(), leave: () => void controller.leave(), settle: (s) => controller.settle(s) }
        : null,
    busy: o?.busy ?? false,
    paused: o ? o.paused || !o.travels : true,
    onJourney: o?.onJourney,
  });

  // The player's act: a trusted press or key here, while the Blobbi is away; every such input is also activity
  const latestSnap = useRef(snapshot);
  latestSnap.current = snapshot;
  const travelsRef = useRef(travels);
  travelsRef.current = travels;
  useEffect(() => {
    if (!session) return;
    const onInput = (e: Event) => {
      const target = e.target as Element | null;
      const inside = (sel: string) => !!(target && typeof target.closest === 'function' && target.closest(sel));
      if (inside('[data-world-travel="ignore"], [data-overlay="true"]')) return;
      const visible = document.visibilityState !== 'hidden';
      let focused = visible;
      try {
        focused = document.hasFocus() || visible;
      } catch {
        /* visible is enough */
      }
      if (!isMeaningfulInput({ trusted: isTrustedInput(e), visible, focused })) return;
      lastInputAt.current = Date.now();
      session.noteActivity();
      // The away card's own button asks explicitly (its click); a press on it is not a second, casual request
      if (inside('[data-world-travel="explicit"]')) return;
      const s = latestSnap.current;
      if (!s || s.status === 'loading' || !travelsRef.current) return;
      if (s.place !== WORLD_HOME && s.travel.phase !== 'signing' && s.travel.phase !== 'publishing' && s.travel.phase !== 'checking') void session.travel();
    };
    window.addEventListener('pointerdown', onInput, { capture: true, passive: true });
    window.addEventListener('keydown', onInput, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', onInput, { capture: true });
      window.removeEventListener('keydown', onInput, { capture: true });
    };
  }, [session]);

  const callHome = useCallback(() => void sessionRef.current?.travel({ explicit: true }), []);
  const retry = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    const phase = s.snapshot().travel;
    if (phase.phase === 'failed' && phase.reason === 'unreachable') {
      void s.retry().then((out) => {
        if (out === 'stale') void s.travel({ explicit: true });
      });
    } else void s.travel({ explicit: true });
  }, []);

  const status = createElement('span', {
    hidden: true,
    'data-testid': 'world-travel-status',
    'data-travel-mode': 'nostr',
    'data-travel-session': snapshot ? 'on' : 'none',
    'data-travel-place': snapshot?.place ?? WORLD_HOME,
    'data-travel-here': String(snapshot ? snapshot.here : true),
    'data-travel-status': snapshot?.status ?? 'none',
    'data-travel-phase': snapshot?.travel.phase ?? 'idle',
    'data-travel-reason': snapshot?.travel.phase === 'failed' ? snapshot.travel.reason : undefined,
    'data-travel-change': snapshot ? `${snapshot.change.kind}:${snapshot.change.key}` : undefined,
    'data-travel-location': snapshot?.location?.id,
    'data-presence-status': snapshot?.presence.status ?? 'off',
    'data-presence-there': snapshot?.presence.there?.world,
  });

  return {
    mode: 'nostr',
    place: snapshot?.place ?? WORLD_HOME,
    here: snapshot ? snapshot.here : true,
    known: !snapshot || snapshot.status !== 'loading' || !!snapshot.location,
    nameOf: nameOfWorld,
    callHome,
    retry,
    snapshot,
    status,
  };
}

/** A teleport that is never driven (the v1 sync with no page does nothing with it). */
const NO_PRESENCE = { controller: { isDisposed: () => true } } as unknown as Presence;
