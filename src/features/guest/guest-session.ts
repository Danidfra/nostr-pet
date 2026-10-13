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
 * The invitation to save: after the player has really cared for their
 * hatched Blobbi, once, when the home is quiet; declined, it rests for a
 * day. Never a countdown, never a second ask in the same session.
 */
export const INVITE_REST_MS = 20 * 60 * 60 * 1000;
/** How long the home is quiet after the care landed before the invitation appears. */
export const INVITE_DELAY_MS = 2_800;

export interface InviteFacts {
  hatched: boolean;
  careCount: number;
  dismissedAt: number | null;
  /** Saving already begun (even interrupted): the invitation is to finish, shown from the menu, not from here. */
  migrationBegun: boolean;
  now: number;
}

export function inviteDue({ hatched, careCount, dismissedAt, migrationBegun, now }: InviteFacts): boolean {
  if (!hatched || careCount < 1 || migrationBegun) return false;
  if (dismissedAt !== null && now - dismissedAt < INVITE_REST_MS) return false;
  return true;
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
