/**
 * Where the home's Blobbi is, behind one interface for the classic home and the room (`travel-mode.ts`):
 *
 *   off    the default: the Blobbi is home. No session, no location read or written, nothing signed, no listener;
 *   nostr  world travel on Nostr (M16): the Blobbi's World Location (kind 31126) is the only authority, read from the
 *          relays every Blobbi world uses (`BLOBBI_WORLD_TRAVEL_RELAYS`), on any device. The protocol is the kit's
 *          (`@blobbi-kit/core` world-travel, `useWorldTravel`); this hook only wires the home to it:
 *            - only a signed-in account (never a guest, never a dev fixture) has a session; anyone else's Blobbi is
 *              simply home;
 *            - OPENING THE HOME IS THE PLAYER'S INTENTION TO BRING THE BLOBBI HERE (revised 2026-10-19,
 *              `world-travel-departure.ts`): once the place is confirmed with the relays, an away Blobbi is moved
 *              here with the kit's own explicit move (`session.travel({ explicit: true })`: one signature, one
 *              event), ONCE PER PAGE LOAD per Blobbi (`ArrivalIntent`, one per document): never again on a
 *              re-render, a remount, a reconnect, a relay update or a focus change; a tab opened hidden acts the
 *              first time it is seen; a reload is a new page and may move again. A signer that is missing, refuses
 *              or times out moves nothing: the away card's "Call home" is the retry (explicit, at once);
 *            - LEAVING for another world from the Worlds sheet moves the Blobbi there from here (`departTo`: a
 *              fresh read, one signed World Location naming the destination, published before the page goes);
 *              the destination reads it and plays its arrival. Nothing rides in a URL;
 *            - no input moves the Blobbi: a trusted press or key is activity (`session.noteActivity`), for the
 *              optional Active Presence only;
 *            - while its place is not known yet (`resolution: 'pending'`: a fresh device, the first look under
 *              way) it is neither here nor away: the teleport starts absent and the home shows "looking for it"
 *              (`view: 'looking'`); the first answer is settled, never played as a journey;
 *            - signed by the account's own signer (`usePublishAdapter().sign`): an nsec login signs silently, an
 *              extension or a remote signer may ask;
 *            - optional Active Presence (kind 21124), the player's choice (`active-presence-choice.ts`); it never
 *              moves the Blobbi, and its expiry leaves it where its World Location says.
 *
 * Nothing else says where a Blobbi is: no cookie, no page storage of its own (the kit keeps the last SIGNED location
 * on this device, a cache of the relays' answer, never a source of moves).
 *
 * The companion choice (11125) is untouched: which Blobbi it is stays `current_companion`'s business.
 */
import { createElement, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  registerWorld,
  storedWorldLocation,
  travelView,
  type NostrEvent,
  type TravelResolution,
  type TravelViewKind,
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
import { ARRIVE } from '@/features/teleport/timeline';
import { WORLD_FARM, WORLD_ISLAND, WORLD_RUMBLE } from '@/features/worlds/worlds';
import { isTrustedInput, travelMode, type TravelMode } from './travel-mode';
import { reportPresenceStatus, useActivePresenceChoice } from './active-presence-choice';
import { ArrivalIntent, autoArrivalDecision, boundedSigner, departTo as departFromHere, pageAgeMs, pageIsFresh, type DepartureOutcome } from './world-travel-departure';

export type { DepartureOutcome } from './world-travel-departure';

// The worlds the kit does not know by name, for the words around a journey ("Brook is in Blobbi Island")
registerWorld({ id: WORLD_ISLAND, name: 'Blobbi Island' });
registerWorld({ id: WORLD_FARM, name: 'Nostr Farm' });
registerWorld({ id: WORLD_RUMBLE, name: 'Blobbi Rumble' });

/**
 * This page's one decision per Blobbi: opening the home brings an away Blobbi here once. One per document, not per
 * hook instance, so a remount of the home (a route change, a Blobbi switch and back) never moves it again; a reload
 * is a new document and may.
 */
const pageIntent = new ArrivalIntent();

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

const pageVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

/**
 * Whether the Blobbi starts away, read at once for the first render (its teleport starts there: nothing is replayed
 * on load). Nostr: the last signed location this device kept, if any (the relays decide a moment later).
 */
export function travelStartsAway(pubkey: string | null | undefined, d: string): boolean {
  if (travelMode() !== 'nostr' || !pubkey) return false;
  const loc = storedWorldLocation(pageStore, { owner: pubkey, d, verify: safeVerify });
  return !!loc && currentWorld(loc) !== WORLD_HOME;
}

/**
 * Whether this page's Blobbi starts with its place unknown: Nostr travel, a session for this account (a real login,
 * not a guest, not a fixture), and no signed location kept on this device. Its teleport then starts absent (never
 * standing here for a moment before the relays say it is elsewhere), and the home shows "looking for it". Read once,
 * for the first render.
 */
export function useTravelStartsUnknown(pubkey: string | null | undefined, d: string): boolean {
  const owner = useTravelOwner(pubkey ?? undefined);
  const [unknown] = useState(() => travelMode() === 'nostr' && !!owner && !storedWorldLocation(pageStore, { owner, d, verify: safeVerify }));
  return unknown;
}

/**
 * Whether this page's Blobbi starts unseen on Nostr: a session for this account is coming, so nothing about its
 * place is believed until the relays answer, not even the location this device kept (the origin of a trip never
 * learns the move the destination made, so a kept "home" may be stale). The sync settles it once confirmed. Read
 * once, for the first render.
 */
export function useTravelStartsUnseen(pubkey: string | null | undefined, d: string): boolean {
  const owner = useTravelOwner(pubkey ?? undefined);
  const [unseen] = useState(() => travelMode() === 'nostr' && !!owner && !!d);
  return unseen;
}

/** The account that may have a travel session for `pubkey` here (only a real login: never a guest, never a dev fixture). */
function useTravelOwner(pubkey: string | undefined): string | null {
  const { nostr } = useNostr();
  const { logins } = useNostrLogin();
  const { user } = useCurrentUser();
  const fixture = useContext(DevFixtureContext);
  const login = logins[0];
  return pubkey && !fixture && login && user?.pubkey === pubkey && canAskRelays(nostr) ? pubkey : null;
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
  mode: TravelMode;
  /** Where the Blobbi is: a World id such as `blobbi-pixel` (`blobbi-home` when off). */
  place: string;
  /** It belongs here now (and is not still on its way). Always true when off. */
  here: boolean;
  /** The place known (off: always; nostr: kept on this device, the relays answered, or there is no session). */
  known: boolean;
  /**
   * What the home shows of its place (the kit's `travelView`): `looking` (not known yet: neither here nor away),
   * `here`, `away`, `coming` (a move here under way: checking, signing, publishing, the departure window).
   */
  view: TravelViewKind;
  /** Nostr: no relay answered the first look (the kept place, or home by default, is shown); off: false. */
  unreachable: boolean;
  /**
   * How sure the place is (the kit's resolution), or `none` when no session runs (off, a guest, signed out): the
   * room's arrival on entry waits on it.
   */
  resolution: TravelResolution | 'none';
  /** Nostr: read the relays again now (the "can't reach" hint's button). */
  refresh(): void;
  /** A place, for the words around a journey ("Blobbi Pixel", "another Blobbi world"). */
  nameOf(place: string): string;
  /** The away card's button: the player's explicit act (and the retry after a refusal or a failure). */
  callHome(): void;
  /** Nostr only: try again after a failure (the same signed move when it is recent, else a new explicit request). */
  retry(): void;
  /** Nostr only: the session's snapshot (null when off, signed out, a guest, a fixture). */
  snapshot: WorldTravelSnapshot | null;
  /**
   * Leaving for `destination` (a World id): move the Blobbi there from here, now (`world-travel-departure.ts`: a
   * fresh read, one World Location signed by the account, published to the travel relays, one acceptance or a
   * bounded timeout). Never throws; `read-only` without a session (off, signed out, a guest, a fixture). The page
   * goes once it has resolved, whatever the outcome.
   */
  departTo(destination: string): Promise<DepartureOutcome>;
  /** The account's signer may ask the player (an extension, a remote signer), so a wait for it is worth a word. */
  signerPrompts: boolean;
  /** Nostr only: a hidden element stating place, phase and presence for tests and diagnostics. */
  status: ReactNode;
}

export function useHomeTravel(o: HomeTravelOptions): HomeTravel {
  const [mode] = useState(travelMode);
  // Off: the same hook with no options, so no session, no sync, no listener and nothing signed; the Blobbi is home
  const travel = useNostrTravel(mode === 'nostr' ? o : null);
  return mode === 'nostr' ? travel : { ...travel, mode: 'off', status: null };
}

const nameOfWorld = (place: string) => (place === WORLD_HOME ? 'home' : (knownWorld(place)?.name ?? 'another Blobbi world'));

function useNostrTravel(o: HomeTravelOptions | null): HomeTravel {
  const { nostr } = useNostr();
  const { logins } = useNostrLogin();
  const { user } = useCurrentUser();
  const publisher = usePublishAdapter();
  const login = logins[0];
  // Only a real login moves a Blobbi: a guest's Blobbi and a dev fixture's live on this device only
  const accountOwner = useTravelOwner(o?.pubkey);
  const owner = o ? accountOwner : null;
  const presenceOn = useActivePresenceChoice(owner);

  const sessionRef = useRef<WorldTravelSession | null>(null);
  const lastInputAt = useRef<number | null>(null);
  const latest = useRef({ publisher, user, login, owner });
  latest.current = { publisher, user, login, owner };

  const relays = useMemo(() => (canAskRelays(nostr) ? poolWorldTravelRelays(nostr as unknown as TravelPoolLike, BLOBBI_WORLD_TRAVEL_RELAYS, { onReconnect: () => void sessionRef.current?.refresh() }) : null), [nostr]);
  const relaysRef = useRef(relays);
  relaysRef.current = relays;
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
      // The kit waits for its signer without a limit: bounded here (`SIGN_PROMPT_TIMEOUT_MS`, a minute for a person).
      // Past it the move ends as `declined` (the away card offers its retry), and a late approval is dropped by the
      // wrapper: it never reaches the kit, so it is never published
      signer: () => {
        const { user: u, login: l, publisher: p, owner: own } = latest.current;
        if (!u || !l || u.pubkey !== own) return null;
        return boundedSigner({ mode: l.type === 'nsec' ? 'silent' : 'prompt', sign: (t) => p.sign(t) });
      },
      stillAccount: () => latest.current.user?.pubkey === owner && latest.current.owner === owner,
      isActive: () => isPlayedNow({ visible: pageVisible(), lastInputAt: lastInputAt.current, now: Date.now() }),
      // The teleport's arrival plays its "incoming" motes before the body forms: started that much earlier, the body
      // forms at the session's `formAt` (the departure window's end, and no sooner than MIN_TRAVEL_MS after the act)
      arrivalLeadMs: ARRIVE.incoming,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one session per owner, Blobbi and relay set
  }, [owner, o?.d, relays]);
  const travel = useWorldTravel(options ? { ...options, presenceEnabled: presenceOn } : null);
  const { session } = travel;
  // The kit makes its session in an effect: until its first snapshot, a session that is coming says what it will
  // start with (the location kept on this device, or `pending`), so no render shows the Blobbi home meanwhile
  const kept = useMemo(() => (options ? storedWorldLocation(pageStore, { owner: options.owner, d: options.d, verify: safeVerify }) : null), [options]);
  const snapshot = travel.snapshot && options && travel.snapshot.owner === options.owner && travel.snapshot.d === options.d ? travel.snapshot : null;
  const coming = !!options && !snapshot;
  const view: TravelViewKind = snapshot ? travelView(snapshot).kind : coming ? (kept ? (currentWorld(kept) === WORLD_HOME ? 'here' : 'away') : 'looking') : 'here';
  const resolution = snapshot ? snapshot.resolution : coming ? (kept ? 'cached' : 'pending') : 'none';
  sessionRef.current = session;

  const presenceStatus = snapshot?.presence.status ?? null;
  useEffect(() => {
    if (!owner) return;
    reportPresenceStatus(owner, presenceStatus);
    return () => reportPresenceStatus(owner, null);
  }, [owner, presenceStatus]);

  const controller = o?.presence.controller;
  const travels = !!o?.travels;
  // Not known where it is (a fresh device, a new account or Blobbi): not standing here meanwhile. Before the paint, so
  // no frame shows it home; settled with no journey (the first answer is settled too, by the sync)
  useLayoutEffect(() => {
    if (view !== 'looking' || !travels || !controller || controller.isDisposed() || o?.paused) return;
    if (controller.getState() !== 'absent') controller.settle('absent');
  }, [view, travels, controller, o?.paused]);
  useWorldTravelSync({
    session,
    blobbi: (): ShownBlobbi | null =>
      controller && !controller.isDisposed() && travels
        ? { state: () => controller.getState(), enter: () => void controller.enter(), leave: () => void controller.leave(), settle: (s) => controller.settle(s) }
        : null,
    busy: o?.busy ?? false,
    // A kept location is never shown as the place: the sync stands aside until the relays have answered
    paused: o ? o.paused || !o.travels || resolution === 'cached' : true,
    onJourney: o?.onJourney,
  });

  // OPENING THE HOME brings an away Blobbi here: the one automatic decision per page and Blobbi
  // (`autoArrivalDecision` over the per-document `pageIntent`). Looked at again when the place is confirmed or
  // changes, when the session changes, and when the page is first seen; never on anything else. An egg or a sleeper
  // never travels, so nothing is decided for one.
  // The decision counts as OPENING the world only while the page is fresh (`pageIsFresh(pageAgeMs())`: within
  // `ARRIVAL_INTENT_TTL_MS` of the page's navigation start) and visible: a background tab shown later than that, or a
  // page left signing in for longer, is an old page being looked at again, and moves nothing by itself (Call home
  // remains). A reload is a new document (fresh again); a back/forward-cache restore keeps the page's state, so its
  // earlier decision stands
  const [visible, setVisible] = useState(pageVisible);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => setVisible(pageVisible());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  const arrivalResolution = snapshot?.resolution ?? null;
  const arrivalHere = snapshot?.here ?? null;
  useEffect(() => {
    if (!session || !options || !travels || arrivalResolution === null || arrivalHere === null) return;
    const { owner: own, d } = options;
    const consumed = pageIntent.consumed(own, d);
    const decision = autoArrivalDecision({ consumed, fresh: pageIsFresh(pageAgeMs()), resolution: arrivalResolution, here: arrivalHere, visible, signer: !!options.signer?.() });
    if (decision === 'wait' || consumed) return;
    pageIntent.consume(own, d);
    if (decision === 'arrive') void session.travel({ explicit: true });
  }, [session, options, travels, arrivalResolution, arrivalHere, visible]);

  // A trusted press or key here is activity (Active Presence renews only while played); it never moves the Blobbi
  useEffect(() => {
    if (!session) return;
    const onInput = (e: Event) => {
      const visibleNow = pageVisible();
      let focused = visibleNow;
      try {
        focused = document.hasFocus() || visibleNow;
      } catch {
        /* visible is enough */
      }
      if (!isMeaningfulInput({ trusted: isTrustedInput(e), visible: visibleNow, focused })) return;
      lastInputAt.current = Date.now();
      session.noteActivity();
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
  const refresh = useCallback(() => void sessionRef.current?.refresh(), []);
  // Leaving for another world: the Blobbi is moved there from here, on the player's choice, before the page goes
  const depart = useCallback(async (destination: string): Promise<DepartureOutcome> => {
    const s = sessionRef.current;
    const r = relaysRef.current;
    const { user: u, login: l, publisher: p, owner: own } = latest.current;
    if (!s || !r || !u || !l || !own) return 'read-only';
    const snap = s.snapshot();
    if (snap.owner !== own || u.pubkey !== own) return 'wrong-account';
    const result = await departFromHere({
      owner: own,
      d: snap.d,
      destination,
      session: s,
      relays: r,
      signer: { mode: l.type === 'nsec' ? 'silent' : 'prompt', sign: (t) => p.sign(t) },
      verify: safeVerify,
      lock: webLock(),
      stillAccount: () => latest.current.user?.pubkey === own && latest.current.owner === own,
    });
    return result.outcome;
  }, []);
  const signerPrompts = !!login && login.type !== 'nsec';

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
    'data-travel-at': snapshot?.travel.phase === 'arriving' ? String(snapshot.travel.at) : undefined,
    'data-travel-form-at': snapshot?.travel.phase === 'arriving' ? String(snapshot.travel.formAt) : undefined,
    'data-travel-change': snapshot ? `${snapshot.change.kind}:${snapshot.change.key}` : undefined,
    'data-travel-location': snapshot?.location?.id,
    'data-travel-resolution': resolution,
    'data-travel-view': view,
    'data-presence-status': snapshot?.presence.status ?? 'off',
    'data-presence-there': snapshot?.presence.there?.world,
  });

  return {
    mode: 'nostr',
    place: snapshot?.place ?? (kept && coming ? currentWorld(kept) : WORLD_HOME),
    // Not known yet: neither here nor away
    here: view === 'looking' ? false : snapshot ? snapshot.here : kept && coming ? currentWorld(kept) === WORLD_HOME : true,
    known: view !== 'looking',
    view,
    unreachable: resolution === 'unreachable',
    resolution,
    refresh,
    nameOf: nameOfWorld,
    callHome,
    retry,
    snapshot,
    departTo: depart,
    signerPrompts,
    status,
  };
}
