/**
 * The rules of guest mode, as pure functions the provider and the tests
 * share.
 *
 * Where the app stands, from the guest record and the login store alone:
 *
 *   none       no guest record: the app is exactly what it was before M14
 *   active     a guest record and nobody signed in: the guest's Blobbi is
 *              the home, over the guest world, nothing published
 *   promoting  signed in with the guest's own reserved key: saving is under
 *              way (or was interrupted) and resumes where it stood; the
 *              home waits for it
 *   dormant    signed in with ANOTHER account while a guest record exists:
 *              that account's home, untouched; the guest Blobbi stays on the
 *              device, said once, never merged
 *
 * A signed-in player always wins over the guest (nobody is forced into guest
 * mode), and a guest record is never changed by a sign-in.
 */
import type { GuestDocument } from './guest-store';

export type GuestMode = 'none' | 'active' | 'promoting' | 'dormant';

export function resolveGuestMode(doc: GuestDocument | null, loginPubkey: string | undefined): GuestMode {
  if (!doc) return 'none';
  if (!loginPubkey) return 'active';
  return loginPubkey === doc.identity.pubkey ? 'promoting' : 'dormant';
}

/** Guest mode supports exactly one Blobbi: another egg needs an account. */
export const GUEST_MAX_BLOBBIS = 1;

/**
 * The invitation to save (M15): after the player has really cared for their
 * hatched Blobbi AND played with it for a while, once, when the home is
 * quiet. Declined with Maybe later, it rests for about a day; declined
 * with Don't ask again, it never comes back on its own in this browser.
 * Never a countdown, never a second ask in the same visit; the menu and the
 * status pill keep the way to save at all times.
 */
export const INVITE_REST_MS = 24 * 60 * 60 * 1000;
/** Active play (a visible, focused tab) before the first invitation: about five minutes. */
export const INVITE_ACTIVE_MS = 5 * 60 * 1000;
/** How long the home is quiet before the invitation appears. */
export const INVITE_DELAY_MS = 2_800;

export interface InviteFacts {
  hatched: boolean;
  careCount: number;
  /** Active play so far, in milliseconds (the record's `invite.activeMs`). */
  activeMs: number;
  dismissedAt: number | null;
  /** "Don't ask again" was chosen in this browser. */
  optOut: boolean;
  /** Saving already begun (even interrupted): the invitation is to finish, shown from the menu, not from here. */
  migrationBegun: boolean;
  now: number;
}

export function inviteDue({ hatched, careCount, activeMs, dismissedAt, optOut, migrationBegun, now }: InviteFacts): boolean {
  if (optOut || !hatched || careCount < 1 || migrationBegun) return false;
  if (activeMs < INVITE_ACTIVE_MS) return false;
  if (dismissedAt !== null && now - dismissedAt < INVITE_REST_MS) return false;
  return true;
}

/** True once the guest's Blobbi has been published somewhere: a save that landed, confirmed or not (M15, the removal's warning). */
export function guestEverSaved(doc: Pick<GuestDocument, 'migration'>): boolean {
  const m = doc.migration;
  return !!m && (m.stage === 'verifying' || m.stage === 'done' || typeof m.landed.blobbi === 'string');
}

/** The invitation's one line. */
export function inviteLine(name: string): string {
  return `${name} loves being with you. Want to take them on adventures?`;
}

/**
 * What the player is told about where the Blobbi lives (M14.2: a child's
 * words, no relays). Two short sentences, honest, no fear.
 */
export function deviceOnlyLine(name: string): string {
  return `Right now, ${name} lives only on this device. If its data disappears, ${name} could disappear too.`;
}
/** The same when this browser is remembering nothing (private browsing, storage blocked). */
export function noStorageLine(name: string): string {
  return `This browser is not remembering anything right now, so ${name} will be gone when you leave. Saving ${name} keeps it.`;
}
/** The line without a name, where none is known (the menu before a Blobbi). */
export const DEVICE_ONLY_LINE = deviceOnlyLine('your Blobbi');
export const NO_STORAGE_LINE = noStorageLine('your Blobbi');
