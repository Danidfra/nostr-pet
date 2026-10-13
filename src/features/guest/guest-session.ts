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

/** What the player is told about where the Blobbi lives. One sentence, no fear. */
export const DEVICE_ONLY_LINE = 'Your Blobbi lives on this device for now. Clearing your browser data or losing this device may erase it.';
export const NO_STORAGE_LINE = 'This browser is not remembering anything right now (private browsing, or storage is blocked), so your Blobbi will be gone when you leave. Saving it to an account keeps it.';
