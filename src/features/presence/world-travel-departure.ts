/*
 * SHARED ACROSS THE BLOBBI WORLDS: the same file lives in Blobbi Island (src/worlds/world-travel-departure.ts) and
 * Blobbi Home (src/features/presence/world-travel-departure.ts). Keep the three in step.
 */
/**
 * WORLD TRAVEL, THE DEPARTURE AND THE ARRIVAL (revised 2026-10-19): opening a world IS the player's intention to
 * take the Blobbi there. No other interaction is asked for, and nothing rides in a URL.
 *
 *   EXPLICIT TRIP (the Worlds menu, Home → Island, Island → Pixel, Pixel → Home ...). The ORIGIN moves the Blobbi:
 *     1. it reads the authoritative World Location again (`session.refresh`, every relay merged by NIP-01);
 *     2. if the Blobbi is already in the destination, nothing is signed or published;
 *     3. else it signs ONE kind 31126 World Location naming the destination (`buildWorldLocationTemplate`: `prev`,
 *        `from`, the ordering rules, the same schema and World ids as every other move) and publishes it to the
 *        travel relays, waiting for one acceptance or a bounded timeout (`departTo`);
 *     4. the page navigates to the destination's plain address.
 *     The DESTINATION reads the latest event on load, finds itself named, publishes nothing, and plays its arrival.
 *     One event per trip.
 *
 *   DIRECT OPENING (the address bar, a bookmark, a reload, a new tab). The DESTINATION moves the Blobbi to itself:
 *     once the account is signed in and the place is confirmed with the relays, if the Blobbi is elsewhere it starts
 *     the kit's own explicit move (`session.travel({ explicit: true })`): one signature, one event, then the arrival.
 *     If it is already here, nothing is published. ONCE PER PAGE LOAD (`autoArrivalDecision` over a per-document
 *     `ArrivalIntent`): never again on a re-render, a reconnect, a relay update or a focus change; a reload is a new
 *     page and may move again; a tab that already acted never reclaims the Blobbi by itself, however often it is
 *     focused (two open tabs can never ping-pong). The decision is also FRESH only: within
 *     `ARRIVAL_INTENT_TTL_MS` of the page's navigation start, and while the page is visible. A tab opened in the
 *     background and shown later than that, or a page left signing in for longer, is an old page being looked at
 *     again, not a world being opened: it moves nothing by itself and offers its retry (Call here / Bring here). A
 *     page restored from the back/forward cache keeps its JavaScript state, so its decision stands too.
 *     A signer that is missing, refuses or times out moves nothing; the World shows its retry.
 *
 *   INVARIANTS kept from the kit's own moves: a fresh read before deciding; never over a newer location (a newer
 *   one met after signing is `stale`: nothing is sent); one move per Blobbi at a time, across tabs with the kit's
 *   Web Lock name; the account still signed in when sending; events trusted for their signature, never their relay.
 */
import { buildWorldLocationTemplate, currentWorld, parseWorldLocation, replacesLocation, type NostrEvent, type TravelResolution, type WorldLocation, type WorldTravelLock, type WorldTravelRelays, type WorldTravelSession, type WorldTravelSigner } from '@blobbi-kit/core';

type Verifier = (event: NostrEvent) => boolean;

/** How long the origin waits for the signature before leaving without a move (ms). An extension may ask a person. */
export const DEPART_SIGN_TIMEOUT_MS = 20_000;
/** How long one relay gets to accept the event (ms). */
export const DEPART_PUBLISH_TIMEOUT_MS = 4_000;
/** A signature slower than this probably asked the player: the location is read again before sending (ms). */
export const DEPART_SLOW_SIGN_MS = 2_000;
/**
 * How long after its navigation start a page still counts as being OPENED, for the one automatic arrival (ms): long
 * enough for a sign-in and a slow first look, short enough that an old background tab shown again moves nothing.
 */
export const ARRIVAL_INTENT_TTL_MS = 5 * 60_000;
/**
 * How long the kit's own move may wait for the account's signer (ms): an extension's prompt gets a person's time; a
 * prompt left open longer ends the move as declined (`boundedSigner`), and the World offers its retry.
 */
export const SIGN_PROMPT_TIMEOUT_MS = 60_000;
/** The fragment parameter older builds used to carry a signed hand-off; dropped from the address, never read. */
export const LEGACY_HANDOFF_PARAM = 'blobbi-travel';
/** Where older builds kept the ids of honoured hand-offs; removed on load. */
export const LEGACY_HANDOFF_USED_KEY = 'blobbi:world-travel:handoff-used:v1';

// ─── The origin: moving the Blobbi to the destination ───────────────────────

export type DepartureOutcome =
  /** Published (one relay accepted): the destination finds the Blobbi there. */
  | 'moved'
  /** The canonical location already names the destination: nothing published. */
  | 'already-there'
  /** The signer refused or took too long. */
  | 'declined'
  /** No relay confirmed the place first, or none accepted the event. */
  | 'unreachable'
  /** A newer location came meanwhile: not overwritten. */
  | 'stale'
  /** No signer for this account here. */
  | 'read-only'
  /** The account changed, or the signer answered for another key. */
  | 'wrong-account'
  /** Another move of this Blobbi is under way in this page. */
  | 'busy';

export interface DepartToInput {
  owner: string;
  d: string;
  /** The World the trip goes to (its World id). */
  destination: string;
  /** The session for this Blobbi in this World (its reads are the authority). */
  session: Pick<WorldTravelSession, 'refresh' | 'snapshot'>;
  relays: Pick<WorldTravelRelays, 'urls' | 'publish'>;
  /** The account's signer now, or null when it cannot sign here. */
  signer: WorldTravelSigner | null;
  verify: Verifier;
  lock?: WorldTravelLock;
  /** The account is still the signed-in one (asked before signing and before sending). */
  stillAccount?: () => boolean;
  now?: () => number;
  signTimeoutMs?: number;
  publishTimeoutMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface DepartureResult {
  outcome: DepartureOutcome;
  /** The location published (`moved`) or found (`already-there`); null otherwise. */
  location: WorldLocation | null;
}

const defaultLock: WorldTravelLock = (_name, fn) => fn();
/** Moves under way in this page, per Blobbi (a second press never signs twice, with or without Web Locks). */
const inFlight = new Set<string>();

/** Move the Blobbi to `destination` from here: sign and publish one World Location. Never throws. */
export async function departTo(input: DepartToInput): Promise<DepartureResult> {
  const { owner, d, destination, session, relays, verify } = input;
  const now = input.now ?? (() => Date.now());
  const setTimer = input.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = input.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const lock = input.lock ?? defaultLock;
  const stillAccount = input.stillAccount ?? (() => true);
  const key = `${owner}:${d}`;
  if (inFlight.has(key)) return { outcome: 'busy', location: null };
  inFlight.add(key);
  try {
    return await lock(`blobbi-world-travel:${owner}:${d}`, async (): Promise<DepartureResult> => {
      // 1. The place as the relays hold it now
      await session.refresh();
      const snap = session.snapshot();
      if (snap.resolution !== 'confirmed') return { outcome: 'unreachable', location: null };
      const latest = snap.location;
      // 2. Already there: nothing to do
      if (currentWorld(latest) === destination) return { outcome: 'already-there', location: latest };
      const signer = input.signer;
      if (!signer) return { outcome: 'read-only', location: null };
      if (!stillAccount()) return { outcome: 'wrong-account', location: null };
      // 3. One World Location naming the destination, signed by the owner (an extension may ask)
      const template = buildWorldLocationTemplate({ owner, d, world: destination, latest, now: now(), departureWindowS: 0 });
      const startedAt = now();
      const signed = await withTimeout(signer.sign(template), input.signTimeoutMs ?? DEPART_SIGN_TIMEOUT_MS, setTimer, clearTimer);
      if (!signed) return { outcome: 'declined', location: null };
      const mine = parseWorldLocation(signed, { verify });
      if (!mine || mine.owner !== owner || mine.d !== d || mine.world !== destination) return { outcome: 'wrong-account', location: null };
      // A slow signature (a person answered): the place may have moved meanwhile; never over a newer location
      if (now() - startedAt > DEPART_SLOW_SIGN_MS) {
        await session.refresh();
        const fresh = session.snapshot().location;
        if (fresh && fresh.id !== latest?.id && replacesLocation(fresh, mine)) {
          return currentWorld(fresh) === destination ? { outcome: 'already-there', location: fresh } : { outcome: 'stale', location: fresh };
        }
      }
      if (!stillAccount()) return { outcome: 'wrong-account', location: null };
      // 4. Publish: moved once one relay accepted; the rest go on in the background (the sessions heal laggards)
      const accepted = await publishFirst(relays, mine.event, input.publishTimeoutMs ?? DEPART_PUBLISH_TIMEOUT_MS, setTimer, clearTimer);
      if (!accepted) return { outcome: 'unreachable', location: null };
      // The origin's own session learns the move (its Blobbi leaves); not awaited: the page is about to go
      void session.refresh().catch(() => {});
      return { outcome: 'moved', location: mine };
    });
  } catch {
    return { outcome: 'unreachable', location: null };
  } finally {
    inFlight.delete(key);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, setTimer: NonNullable<DepartToInput['setTimer']>, clearTimer: NonNullable<DepartToInput['clearTimer']>): Promise<T | null> {
  let timer: unknown = null;
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimer(() => resolve(null), ms);
    }),
  ]).finally(() => {
    if (timer !== null) clearTimer(timer);
  });
}

/** True as soon as one relay accepted; false once every relay refused, failed or timed out. */
function publishFirst(relays: Pick<WorldTravelRelays, 'urls' | 'publish'>, event: NostrEvent, timeoutMs: number, setTimer: NonNullable<DepartToInput['setTimer']>, clearTimer: NonNullable<DepartToInput['clearTimer']>): Promise<boolean> {
  if (!relays.urls.length) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    let left = relays.urls.length;
    for (const url of relays.urls) {
      const controller = new AbortController();
      const timer = setTimer(() => controller.abort(), timeoutMs);
      relays
        .publish(url, event, controller.signal)
        .then(
          () => resolve(true),
          () => {
            if (--left === 0) resolve(false);
          },
        )
        .finally(() => clearTimer(timer));
    }
  });
}

// ─── The destination: one arrival per page load ─────────────────────────────

export type AutoArrival =
  /** Move the Blobbi here now (the kit's explicit `travel()`), and consume the intent. */
  | 'arrive'
  /** Not yet: the place is not confirmed, or the page has not been seen. Ask again on the next change. */
  | 'wait'
  /** Nothing to do (here already, no relay answered, no signer): the intent is consumed; the World's retry stands. */
  | 'none';

export interface AutoArrivalInput {
  /** This page already acted for this Blobbi (`ArrivalIntent.consumed`). */
  consumed: boolean;
  /** The page is still being opened: within `ARRIVAL_INTENT_TTL_MS` of its navigation start (`pageAgeMs`). */
  fresh: boolean;
  resolution: TravelResolution;
  /** The Blobbi is here (and not on its way). */
  here: boolean;
  /** The page is visible now. */
  visible: boolean;
  /** A signer can be asked now (`false`: nothing is signed; the World asks the player to reconnect, then retries). */
  signer: boolean;
}

export function autoArrivalDecision(o: AutoArrivalInput): AutoArrival {
  if (o.consumed) return 'none';
  // An old page looked at again is not a world being opened: whatever it finds, it moves nothing by itself
  if (!o.fresh) return 'none';
  if (o.resolution === 'pending' || o.resolution === 'cached') return 'wait';
  if (o.resolution === 'unreachable') return 'none';
  if (o.here) return 'none';
  if (!o.visible) return 'wait';
  if (!o.signer) return 'none';
  return 'arrive';
}

/**
 * How long ago this page's navigation started (ms): `performance.now()` counts from the navigation start of this
 * document (a reload or a new tab starts it over; a back/forward-cache restore does not, and keeps the page's state
 * too). Where there is no performance clock (tests, workers), 0: the page counts as fresh.
 */
export function pageAgeMs(perf: Pick<Performance, 'now'> | null = typeof performance === 'undefined' ? null : performance): number {
  try {
    return perf ? Math.max(0, perf.now()) : 0;
  } catch {
    return 0;
  }
}

/** Whether a page is still being opened (see `ARRIVAL_INTENT_TTL_MS`). */
export const pageIsFresh = (ageMs: number = pageAgeMs()) => ageMs < ARRIVAL_INTENT_TTL_MS;

/** Which Blobbis this page has already decided for (per owner and d). One per document; a reload starts afresh. */
export class ArrivalIntent {
  private done = new Set<string>();
  consumed(owner: string, d: string): boolean {
    return this.done.has(`${owner}:${d}`);
  }
  consume(owner: string, d: string): void {
    this.done.add(`${owner}:${d}`);
  }
}

// ─── The signer, bounded ────────────────────────────────────────────────────

/** The error a bounded signer rejects with when the player did not answer in time. */
export class SignerTimeoutError extends Error {
  constructor(ms: number) {
    super(`the signer did not answer within ${ms} ms`);
    this.name = 'SignerTimeoutError';
  }
}

/**
 * The account's signer with a time limit, for the kit's own move (the kit waits for its signer without one): after
 * `timeoutMs` the signature is REFUSED (the kit ends the move as declined and the World offers its retry). The
 * underlying request cannot be cancelled (an extension's prompt may still be open), so a late answer is dropped
 * here: it never reaches the kit, so it is never published, and a later retry asks for a new signature of its own
 * (a new template, a new id). Nothing a late answer can do creates an event or an arrival.
 */
export function boundedSigner(signer: WorldTravelSigner, timeoutMs: number = SIGN_PROMPT_TIMEOUT_MS, setTimer: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms), clearTimer: (h: unknown) => void = (h) => clearTimeout(h as ReturnType<typeof setTimeout>), onLate?: () => void): WorldTravelSigner {
  return {
    mode: signer.mode,
    sign(template) {
      return new Promise<NostrEvent>((resolve, reject) => {
        let settled = false;
        const timer = setTimer(() => {
          if (settled) return;
          settled = true;
          reject(new SignerTimeoutError(timeoutMs));
        }, timeoutMs);
        signer.sign(template).then(
          (event) => {
            if (settled) {
              onLate?.();
              return; // too late: dropped, never published
            }
            settled = true;
            clearTimer(timer);
            resolve(event);
          },
          (error) => {
            if (settled) return;
            settled = true;
            clearTimer(timer);
            reject(error);
          },
        );
      });
    },
  };
}

// ─── Older builds' leftovers ────────────────────────────────────────────────

/**
 * An address that still carries an old hand-off fragment (a link made by an earlier build) has it removed and
 * ignored: nothing in it is read or honoured. The other fragment parameters, if any, stay.
 */
export function dropLegacyHandoff(loc: Pick<Location, 'hash' | 'pathname' | 'search'> = location, hist: Pick<History, 'replaceState' | 'state'> = history): boolean {
  let hash = '';
  try {
    hash = loc.hash.startsWith('#') ? loc.hash.slice(1) : loc.hash;
  } catch {
    return false;
  }
  if (!hash.includes(LEGACY_HANDOFF_PARAM)) return false;
  const params = new URLSearchParams(hash);
  if (!params.has(LEGACY_HANDOFF_PARAM)) return false;
  params.delete(LEGACY_HANDOFF_PARAM);
  const rest = params.toString();
  try {
    hist.replaceState(hist.state, '', `${loc.pathname}${loc.search}${rest ? `#${rest}` : ''}`);
  } catch {
    /* the address stays; nothing reads it anyway */
  }
  return true;
}

/** The ids older builds kept of honoured hand-offs: no longer used, removed. */
export function dropLegacyHandoffStore(storage: Pick<Storage, 'removeItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try {
    storage?.removeItem(LEGACY_HANDOFF_USED_KEY);
  } catch {
    /* nothing kept */
  }
}
