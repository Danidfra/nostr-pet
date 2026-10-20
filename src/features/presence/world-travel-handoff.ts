/*
 * SHARED ACROSS THE BLOBBI WORLDS: the same file lives in Blobbi Island (src/worlds/world-travel-handoff.ts)
 * and Blobbi Pixel (src/game/travel-handoff.ts). Keep the three in step; a destination only honours what this file
 * accepts, and an origin only sends what it writes.
 */
/**
 * THE WORLD TRAVEL HAND-OFF: a Blobbi follows its player through an explicit
 * trip (the Worlds sheet) without the player acting again at the destination.
 *
 *   1. On the door press, the ORIGIN prepares the World Location (kind 31126)
 *      the destination would write (`buildWorldLocationTemplate` for the
 *      destination World, from the canonical location the origin has just
 *      confirmed), and asks the account's signer for it (`signHandoff`). A
 *      silent signer (an nsec login, Pixel's vault) signs at once; an
 *      extension or a remote signer prompts, where the choice was just made.
 *      The origin publishes NOTHING: a refusal, a timeout or a trip that stops
 *      (Stay) leaves no trace anywhere.
 *   2. The signed event rides in the URL FRAGMENT of the navigation
 *      (`#blobbi-travel=v1.<base64url JSON>`): never a query string, so no
 *      server or log sees it; removed from the address before anything else
 *      runs (`readHandoff`), so a reload or Back never presents it again.
 *   3. The DESTINATION holds it until its own session has confirmed the
 *      canonical location with the relays, then checks everything
 *      (`checkHandoff`) and publishes the event as it was signed
 *      (`createHandoffArrival`), takes the lock the kit's own moves take,
 *      marks the id used, and asks the session to look again: the kit learns
 *      the move as a live change and the World's teleport plays the arrival.
 *      The destination signs nothing. If it cannot honour the hand-off, it
 *      says nothing and the ordinary rule stands: the Blobbi follows the
 *      player's play, or "Bring here".
 *
 * WHAT A DESTINATION CHECKS (every one, else the hand-off is dropped):
 *   - the signature verifies and the event is a valid World Location (the
 *     kit's `parseWorldLocation` with `verify`);
 *   - the author is the signed-in account, and the Blobbi (`d`, `a`) is the
 *     one this World shows: the destination never acts for anyone else;
 *   - `world` names THIS World; `from` names another;
 *   - `created_at` is at most `HANDOFF_MAX_AGE_S` old and at most
 *     `HANDOFF_MAX_AHEAD_S` ahead of this clock (a far-future event would pin
 *     relays; the kit's own moves are never dated ahead either);
 *   - `prev` is the id of the canonical location the destination just read,
 *     `from` is that location's World, and the event replaces it by NIP-01:
 *     a Blobbi that moved meanwhile is not moved back by an old intention;
 *   - the id was not honoured before on this device (`used`), and is not
 *     already the canonical location (then there is nothing to do).
 *
 * WHAT THIS PROVES AND WHAT IT DOES NOT. The event is the owner's own
 * signature over "this Blobbi is now in <destination>", made on the door
 * press: a link cannot forge it, and a captured link can only publish the
 * owner's own decision, once, while it is fresh and still the newest. It does
 * not prove the player ARRIVED: a trip that never opened leaves an unsent
 * event that expires. The destination never signs because a URL asked it to.
 *
 * THE KIT'S INVARIANTS, KEPT BY HAND (`createHandoffArrival` publishes
 * outside `session.travel()`, the only other writer): one move in flight per
 * Blobbi (the same Web Lock name as the kit's); a fresh look before writing
 * and never over a newer location (`checkHandoff` against the canonical
 * location read inside the lock); only to move the Blobbi to THIS World;
 * the same signed event resent on a retry, never a second signature; the
 * owner's account still signed in when sending. The kit then heals lagging
 * relays with the event on its own looks, as with any canonical location.
 */
import { buildWorldLocationTemplate, currentWorld, parseWorldLocation, replacesLocation, type NostrEvent, type WorldLocation, type WorldTravelLock, type WorldTravelRelays, type WorldTravelSession } from '@blobbi-kit/core';

export const HANDOFF_VERSION = 'v1';
/** The fragment parameter (`#blobbi-travel=v1.<payload>`). */
export const HANDOFF_PARAM = 'blobbi-travel';
/** A hand-off older than this is not honoured (s). */
export const HANDOFF_MAX_AGE_S = 120;
/** A hand-off dated further ahead of the reader's clock than this is not honoured (s). */
export const HANDOFF_MAX_AHEAD_S = 60;
/** How long the origin waits for the signature before leaving without a hand-off (ms). */
export const HANDOFF_SIGN_TIMEOUT_MS = 20_000;
/** How long one relay gets to accept the event (ms). */
export const HANDOFF_PUBLISH_TIMEOUT_MS = 4_000;
/** Ids honoured on this device, kept this long (ms). */
export const HANDOFF_USED_TTL_MS = 10 * 60_000;
export const HANDOFF_USED_KEY = 'blobbi:world-travel:handoff-used:v1';
/** The most a payload may be (characters), well above a signed World Location. */
const HANDOFF_MAX_PAYLOAD = 4_096;

type Verifier = (event: NostrEvent) => boolean;

// ─── The payload ────────────────────────────────────────────────────────────

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string | null {
  try {
    const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
    const bin = atob(b64);
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** The payload for a signed event: `v1.<base64url of its JSON>`. */
export function encodeHandoff(event: NostrEvent): string {
  return `${HANDOFF_VERSION}.${toBase64Url(JSON.stringify(event))}`;
}

/** The event a payload carries, as data (NOT verified: `checkHandoff` does that), or null for anything malformed. */
export function decodeHandoff(payload: string | null | undefined): NostrEvent | null {
  if (typeof payload !== 'string' || payload.length > HANDOFF_MAX_PAYLOAD) return null;
  const prefix = `${HANDOFF_VERSION}.`;
  if (!payload.startsWith(prefix)) return null;
  const body = payload.slice(prefix.length);
  if (!/^[A-Za-z0-9_-]+$/.test(body)) return null;
  const json = fromBase64Url(body);
  if (json === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const e = parsed as Record<string, unknown>;
  if (typeof e.id !== 'string' || typeof e.pubkey !== 'string' || typeof e.sig !== 'string' || typeof e.content !== 'string') return null;
  if (typeof e.kind !== 'number' || typeof e.created_at !== 'number') return null;
  if (!Array.isArray(e.tags) || !e.tags.every((t) => Array.isArray(t) && t.every((x) => typeof x === 'string'))) return null;
  return { id: e.id, pubkey: e.pubkey, sig: e.sig, content: e.content, kind: e.kind, created_at: e.created_at, tags: e.tags as string[][] } as NostrEvent;
}

/** The fragment (without `#`) that carries a signed event. */
export function handoffFragment(event: NostrEvent): string {
  return `${HANDOFF_PARAM}=${encodeHandoff(event)}`;
}

/** A world's address with the hand-off attached (the address itself carries no fragment). */
export function withHandoff(url: string, event: NostrEvent): string {
  return `${url}#${handoffFragment(event)}`;
}

/**
 * The hand-off in the page's address, if any, REMOVED from it at once (the other fragment parameters, if any, stay):
 * a reload, Back or a copied address never carries it again. Call it once, as early as the page runs.
 */
export function readHandoff(loc: Pick<Location, 'hash' | 'pathname' | 'search'> = location, hist: Pick<History, 'replaceState' | 'state'> = history): NostrEvent | null {
  let hash = '';
  try {
    hash = loc.hash.startsWith('#') ? loc.hash.slice(1) : loc.hash;
  } catch {
    return null;
  }
  if (!hash.includes(HANDOFF_PARAM)) return null;
  const params = new URLSearchParams(hash);
  const payload = params.get(HANDOFF_PARAM);
  if (payload === null) return null;
  params.delete(HANDOFF_PARAM);
  const rest = params.toString();
  try {
    hist.replaceState(hist.state, '', `${loc.pathname}${loc.search}${rest ? `#${rest}` : ''}`);
  } catch {
    /* the address stays as it is: the payload is single-use on this device anyway */
  }
  return decodeHandoff(payload);
}

// ─── The origin: signing ────────────────────────────────────────────────────

export interface SignHandoffInput {
  owner: string;
  d: string;
  /** The World the trip goes to (its World id). */
  destination: string;
  /** The canonical location the origin has confirmed (null: none, the Blobbi is at the default World). */
  canonical: WorldLocation | null;
  /** The account's signer. */
  sign: (template: { kind: number; created_at: number; tags: string[][]; content: string }) => Promise<NostrEvent>;
  verify: Verifier;
  now?: number;
  timeoutMs?: number;
}

/**
 * The World Location the destination will publish, signed by the owner now, or null when it cannot be had (refused,
 * too slow, not the owner's, already there). Never throws, never publishes.
 */
export async function signHandoff({ owner, d, destination, canonical, sign, verify, now = Date.now(), timeoutMs = HANDOFF_SIGN_TIMEOUT_MS }: SignHandoffInput): Promise<NostrEvent | null> {
  if (currentWorld(canonical) === destination) return null;
  const template = buildWorldLocationTemplate({ owner, d, world: destination, latest: canonical, now, departureWindowS: 0 });
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const signed = await Promise.race([
      sign(template),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    if (!signed) return null;
    const loc = parseWorldLocation(signed, { verify });
    if (!loc || loc.owner !== owner || loc.d !== d || loc.world !== destination) return null;
    return loc.event;
  } catch {
    return null;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

// ─── The destination: checking ──────────────────────────────────────────────

export type HandoffRejection =
  /** Not a valid, signed World Location. */
  | 'invalid'
  /** It names another World. */
  | 'wrong-world'
  /** Not the signed-in account's. */
  | 'wrong-account'
  /** Not the Blobbi this World shows. */
  | 'wrong-blobbi'
  /** No `from`, or `from` is this World. */
  | 'no-origin'
  | 'expired'
  | 'future'
  /** The canonical location moved on: `prev`/`from` no longer match, or it is not newer. */
  | 'stale'
  /** Honoured before on this device. */
  | 'used';

export type HandoffCheck = { ok: true; location: WorldLocation } | { ok: false; reason: HandoffRejection | 'already-published' };

export interface CheckHandoffInput {
  event: NostrEvent;
  /** This World. */
  world: string;
  /** The signed-in account, and the Blobbi this World shows. */
  owner: string;
  d: string;
  /** The canonical location, as just read from the relays. */
  canonical: WorldLocation | null;
  verify: Verifier;
  used: { has(id: string): boolean };
  now?: number;
}

export function checkHandoff({ event, world, owner, d, canonical, verify, used, now = Date.now() }: CheckHandoffInput): HandoffCheck {
  const loc = parseWorldLocation(event, { verify });
  if (!loc) return { ok: false, reason: 'invalid' };
  if (loc.world !== world) return { ok: false, reason: 'wrong-world' };
  if (loc.owner !== owner) return { ok: false, reason: 'wrong-account' };
  if (loc.d !== d) return { ok: false, reason: 'wrong-blobbi' };
  if (!loc.from || loc.from === world) return { ok: false, reason: 'no-origin' };
  const nowS = now / 1000;
  if (nowS - loc.createdAt > HANDOFF_MAX_AGE_S) return { ok: false, reason: 'expired' };
  if (loc.createdAt - nowS > HANDOFF_MAX_AHEAD_S) return { ok: false, reason: 'future' };
  if (canonical && canonical.id === loc.id) return { ok: false, reason: 'already-published' };
  if (used.has(loc.id)) return { ok: false, reason: 'used' };
  if ((loc.prev ?? null) !== (canonical?.id ?? null)) return { ok: false, reason: 'stale' };
  if (loc.from !== currentWorld(canonical)) return { ok: false, reason: 'stale' };
  if (canonical && !replacesLocation(loc, canonical)) return { ok: false, reason: 'stale' };
  return { ok: true, location: loc };
}

// ─── The destination: the ids honoured on this device ───────────────────────

export interface UsedHandoffs {
  has(id: string): boolean;
  add(id: string): void;
}

interface StoreLike {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** Ids honoured on this device, in a small key-value store (the page's guarded localStorage), pruned by age. */
export function usedHandoffs(store: StoreLike | null, now: () => number = Date.now): UsedHandoffs {
  const read = (): { id: string; at: number }[] => {
    try {
      const raw = store?.get(HANDOFF_USED_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      const t = now();
      return parsed.filter((x): x is { id: string; at: number } => !!x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string' && typeof (x as { at?: unknown }).at === 'number' && t - (x as { at: number }).at < HANDOFF_USED_TTL_MS);
    } catch {
      return [];
    }
  };
  // Kept in memory too: a store that refuses still protects this page
  const memory = new Set<string>();
  return {
    has: (id) => memory.has(id) || read().some((x) => x.id === id),
    add(id) {
      memory.add(id);
      try {
        store?.set(HANDOFF_USED_KEY, JSON.stringify([...read().filter((x) => x.id !== id), { id, at: now() }]));
      } catch {
        /* not kept beyond this page */
      }
    },
  };
}

// ─── The destination: publishing the signed move ────────────────────────────

export type HandoffStatus =
  /** Waiting for the session to confirm the canonical location with the relays. */
  | 'holding'
  | 'publishing'
  /** Published (or found already canonical): the session's look brings the arrival. */
  | 'done'
  /** No relay accepted: the same signed event may be sent again (`retry`). */
  | 'failed'
  /** Not honoured: the ordinary rule stands. */
  | 'dropped';

export interface HandoffState {
  status: HandoffStatus;
  reason?: HandoffRejection | 'unreachable';
  /** The event's id. */
  id: string;
}

export interface HandoffArrivalDeps {
  event: NostrEvent;
  /** This World. */
  world: string;
  /** The session for the account's Blobbi, when there is one. */
  session: () => WorldTravelSession | null;
  relays: () => WorldTravelRelays | null;
  verify: Verifier;
  lock?: WorldTravelLock;
  used: UsedHandoffs;
  /** The account is still the signed-in one (asked before sending). */
  stillAccount?: (owner: string) => boolean;
  onChange?: (state: HandoffState) => void;
  now?: () => number;
  timeoutMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface HandoffArrival {
  state(): HandoffState;
  /** Look at the session now (its snapshot changed): publish once it has confirmed the place. */
  update(): void;
  /** After `failed`: send the same signed event again (no new signature). */
  retry(): Promise<void>;
  dispose(): void;
}

const defaultLock: WorldTravelLock = (_name, fn) => fn();

export function createHandoffArrival(deps: HandoffArrivalDeps): HandoffArrival {
  const now = deps.now ?? (() => Date.now());
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const lock = deps.lock ?? defaultLock;
  const timeoutMs = deps.timeoutMs ?? HANDOFF_PUBLISH_TIMEOUT_MS;
  const { event } = deps;
  let state: HandoffState = { status: 'holding', id: event.id };
  let inFlight = false;
  let disposed = false;
  const set = (next: HandoffState) => {
    state = next;
    deps.onChange?.(next);
  };
  const terminal = () => state.status === 'done' || state.status === 'dropped';
  const expired = () => now() / 1000 - event.created_at > HANDOFF_MAX_AGE_S;

  const publishAll = async (relays: WorldTravelRelays): Promise<number> => {
    const results = await Promise.all(
      relays.urls.map(async (url) => {
        const controller = new AbortController();
        const timer = setTimer(() => controller.abort(), timeoutMs);
        try {
          await relays.publish(url, event, controller.signal);
          return true;
        } catch {
          return false;
        } finally {
          clearTimer(timer);
        }
      }),
    );
    return results.filter(Boolean).length;
  };

  const attempt = async (session: WorldTravelSession) => {
    if (inFlight || disposed || terminal()) return;
    inFlight = true;
    set({ status: 'publishing', id: event.id });
    try {
      const snap = session.snapshot();
      await lock(`blobbi-world-travel:${snap.owner}:${snap.d}`, async () => {
        if (disposed) return;
        // The place as the relays hold it NOW (another device, another tab, may have moved it meanwhile)
        await session.refresh();
        if (disposed) return;
        const fresh = session.snapshot();
        const check = checkHandoff({ event, world: deps.world, owner: fresh.owner, d: fresh.d, canonical: fresh.location, verify: deps.verify, used: deps.used, now: now() });
        if (!check.ok) {
          if (check.reason === 'already-published') set({ status: 'done', id: event.id });
          else set({ status: 'dropped', reason: check.reason, id: event.id });
          return;
        }
        if (deps.stillAccount && !deps.stillAccount(fresh.owner)) {
          set({ status: 'dropped', reason: 'wrong-account', id: event.id });
          return;
        }
        const relays = deps.relays();
        const accepted = relays ? await publishAll(relays) : 0;
        if (disposed) return;
        if (accepted === 0) {
          set({ status: 'failed', reason: 'unreachable', id: event.id });
          return;
        }
        deps.used.add(event.id);
        set({ status: 'done', id: event.id });
        // The session learns its new canonical location as a live change: the World's arrival follows
        await session.refresh();
      });
    } catch {
      if (!disposed && !terminal()) set({ status: 'failed', reason: 'unreachable', id: event.id });
    } finally {
      inFlight = false;
    }
  };

  return {
    state: () => state,
    update() {
      if (disposed || terminal() || inFlight || state.status === 'failed') return;
      if (expired()) {
        set({ status: 'dropped', reason: 'expired', id: event.id });
        return;
      }
      const session = deps.session();
      if (!session) return;
      // Unreachable: the session keeps looking; the hand-off waits for a confirmed place or expires
      if (session.snapshot().resolution !== 'confirmed') return;
      void attempt(session);
    },
    async retry() {
      if (disposed || state.status !== 'failed') return;
      if (expired()) {
        set({ status: 'dropped', reason: 'expired', id: event.id });
        return;
      }
      const session = deps.session();
      if (!session) return;
      await attempt(session);
    },
    dispose() {
      disposed = true;
    },
  };
}
