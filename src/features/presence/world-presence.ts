/**
 * World presence v1: which Blobbi app the player's Blobbi is in, on this
 * browser, right now. Pure: no DOM, no storage, no clock, no Nostr. The same
 * file lives in Blobbi Standalone (`src/features/presence/`) and Blobbi Pixel
 * (`src/game/`), and both run the same test vectors
 * (`world-presence.vectors.json`); keep the three equal.
 *
 * The model is ONE short lease per account, shared by every tab of every
 * Blobbi app on the browser (where it is kept is `presence-page.ts`'s
 * business):
 *
 *   lease = { app, tab, at, exp }   app: where the Blobbi is; tab: the page
 *                                   keeping it there; at: when it was
 *                                   claimed; exp: when it lapses
 *
 * Rules:
 *  1. No live lease means the Blobbi is at HOME (the Standalone). A lease
 *     lapses on its own: a closed, crashed, hidden or idle page simply stops
 *     renewing it, and the Blobbi drifts home. Nothing is ever stranded.
 *  2. Only a real input in a visible, focused page claims (a pointer press or
 *     a key; never focus, visibility, a timer or a remote change). The home
 *     never needs a lease of its own except to bring the Blobbi back.
 *  3. The page holding the lease renews it while it is in active use
 *     (visible, focused, an input within ACTIVE_MS). Another page of the same
 *     app may take the renewal over with its own input; the place does not
 *     change, so nothing moves.
 *  4. A claim right after another app's claim waits (MIN_STAY_MS), and a page
 *     claims at most once per CLAIM_COOLDOWN_MS: clicking quickly back and
 *     forth between two windows never makes the Blobbi flicker.
 *  5. A page that is going away gives back the lease it holds.
 *
 * Presence is presentation only. It never touches identity, care, inventory,
 * rooms or the companion choice (which Blobbi it is stays each app's own
 * `current_companion`). Losing it loses nothing.
 */

export const WORLD_PRESENCE_PROTOCOL = 'blobbi-world-presence/1';

/** The place a lease names. `home` is the Standalone; other apps use their own short id. */
export const HOME_APP = 'home';
export const PIXEL_APP = 'pixel';

/** How long a claim or a renewal lasts. */
export const LEASE_MS = 45_000;
/** How often the holder renews it while in active use. */
export const RENEW_MS = 15_000;
/** A page with no input for this long is idle and stops renewing. */
export const ACTIVE_MS = 5 * 60_000;
/** A claim this soon after another app's claim waits. */
export const MIN_STAY_MS = 4_000;
/** One claim per page at most this often. */
export const CLAIM_COOLDOWN_MS = 2_000;
/** A page that has just become visible waits this long before playing a departure (an input in it may reclaim first). */
export const VISIBLE_GRACE_MS = 1_500;

export interface Lease {
  /** Where the Blobbi is: `home`, `pixel`, … (a short lowercase id). */
  app: string;
  /** The page keeping it there (random per page load). */
  tab: string;
  /** When it was claimed (ms since the epoch); a renewal keeps it. */
  at: number;
  /** When it lapses (ms since the epoch). */
  exp: number;
}

const ID = /^[a-z0-9-]{1,16}$/;

/** `1.<app>.<tab>.<at base36>.<exp base36>`: small enough for a cookie, nothing personal in it. */
export function encodeLease(lease: Lease): string {
  return ['1', lease.app, lease.tab, Math.floor(lease.at).toString(36), Math.floor(lease.exp).toString(36)].join('.');
}

/** The lease a stored value names, or null for anything else (a value from another version is ignored, never trusted). */
export function decodeLease(value: string | null | undefined): Lease | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 5 || parts[0] !== '1') return null;
  const [, app, tab, at36, exp36] = parts;
  if (!ID.test(app) || !ID.test(tab) || !/^[0-9a-z]{1,11}$/.test(at36) || !/^[0-9a-z]{1,11}$/.test(exp36)) return null;
  const at = parseInt(at36, 36);
  const exp = parseInt(exp36, 36);
  // `at` is when it was CLAIMED and a renewal keeps it, so a lease played for an hour has `exp - at` of an hour: only
  // the order is checked here; how far ahead it may reach is `isLive`'s (it knows the time)
  if (!Number.isSafeInteger(at) || !Number.isSafeInteger(exp) || exp <= at) return null;
  return { app, tab, at, exp };
}

/** Live: not lapsed, and not reaching further ahead than a lease can (a value from a broken or hostile writer). */
export function isLive(lease: Lease | null, now: number): lease is Lease {
  return !!lease && lease.exp > now && lease.exp - now <= LEASE_MS * 2;
}

/** Where the Blobbi is now (rule 1). */
export function placeOf(lease: Lease | null, now: number): string {
  return isLive(lease, now) ? lease.app : HOME_APP;
}

/** What a page knows about itself. */
export interface PageState {
  app: string;
  tab: string;
  visible: boolean;
  focused: boolean;
  /** The last real input in this page (ms), or null for none yet. */
  lastInputAt: number | null;
  /** The last claim this page wrote (ms), or null for none yet. */
  lastClaimAt: number | null;
}

export type PresenceEvent = 'input' | 'tick' | 'pagehide';

/** What to write: a lease, `null` to clear the stored one, or nothing at all. */
export type Decision = { write: Lease } | { clear: true } | { none: true };

const NONE: Decision = { none: true };

/** Whether this page is in active use (rule 3). */
export function isActive(page: PageState, now: number): boolean {
  return page.visible && page.focused && page.lastInputAt !== null && now - page.lastInputAt < ACTIVE_MS;
}

/**
 * The one decision: given the stored lease, this page and what just happened, what (if anything) to write. Called on
 * every real input, on a timer while the page is open, and when the page goes away.
 */
export function decide(lease: Lease | null, page: PageState, event: PresenceEvent, now: number): Decision {
  const live = isLive(lease, now) ? lease : null;
  if (event === 'pagehide') return live && live.tab === page.tab ? { clear: true } : NONE;
  if (event === 'input' && !(page.visible && page.focused)) return NONE;
  if (event === 'tick' && !(live && live.tab === page.tab && isActive(page, now))) return NONE;

  // Already here: renew when due (rule 3), by the holder or another page of this app with an input
  if (live && live.app === page.app) {
    // The home's lease only brings the Blobbi back; when it lapses the Blobbi is still home (rule 1), so it is never renewed
    if (page.app === HOME_APP) return NONE;
    if (now - (live.exp - LEASE_MS) < RENEW_MS) return NONE;
    return { write: { app: page.app, tab: page.tab, at: live.at, exp: now + LEASE_MS } };
  }
  if (event !== 'input') return NONE;
  // At home with no lease: the home has nothing to claim (rule 2)
  if (!live && page.app === HOME_APP) return NONE;
  // Rule 4: no flicker
  if (live && now - live.at < MIN_STAY_MS) return NONE;
  if (page.lastClaimAt !== null && now - page.lastClaimAt < CLAIM_COOLDOWN_MS) return NONE;
  return { write: { app: page.app, tab: page.tab, at: now, exp: now + LEASE_MS } };
}

/** What the page's Blobbi is doing on screen, in the teleport's words. */
export type ShownState = 'present' | 'departing' | 'absent' | 'arriving';

export interface ViewState {
  /** Whether the Blobbi belongs in this app now (`placeOf(...) === app`). */
  here: boolean;
  shown: ShownState;
  visible: boolean;
  /** How long the page has been visible (ms); 0 when hidden. */
  visibleFor: number;
  /** The app's own moment that must not be interrupted (an action, a menu, a minigame, a journey of its own). */
  busy: boolean;
}

/**
 * The journey to play, if any, to bring what is shown in line with where the Blobbi is. Hidden pages wait (the
 * player sees the journey when they look); an arrival never waits for `busy` (nothing of the Blobbi's is going on
 * while it is away), a departure does (a remote change never interrupts the player's moment), and a page that has
 * just become visible gives an input a moment to reclaim before anything leaves.
 */
export function reconcile(view: ViewState): 'enter' | 'leave' | null {
  if (!view.visible) return null;
  if (view.here) return view.shown === 'absent' || view.shown === 'departing' ? 'enter' : null;
  if (view.shown === 'absent' || view.shown === 'departing') return null;
  if (view.busy || view.visibleFor < VISIBLE_GRACE_MS) return null;
  return 'leave';
}

/** A short, stable, non-reversible name for an account's lease (FNV-1a over the pubkey, 8 hex digits). */
export function accountKey(pubkey: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < pubkey.length; i++) {
    h ^= pubkey.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The display name of a place, for the words around a journey. */
export function placeName(app: string): string {
  if (app === HOME_APP) return 'home';
  if (app === PIXEL_APP) return 'Blobbi Pixel';
  return 'another Blobbi world';
}
