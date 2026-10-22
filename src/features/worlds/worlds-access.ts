/**
 * Whether the Worlds door is open, and the one-time word that it just opened.
 *
 * The door is decided from what the guest feature already knows, never from
 * a flag of its own:
 *
 *   guest      a guest plays (the record, no login): the Blobbi lives on
 *              this device and no world can know it; the door is locked
 *   saving     the guest's own key is signed in and the save is under way
 *              (key, profile, publishing, or published but not yet read
 *              back): still locked; a key alone is no account
 *   open       the save was confirmed on the relays (the record's `done`,
 *              then the record let go), or the player signed in with an
 *              account of their own: the door is open
 *
 * The word (the "highlight") follows a save the way the look guide follows
 * the room's introduction (`room/lib/look-guide.ts`): the button glows and a
 * bubble says the worlds are open, once. It is due only when this visit
 * saw the door go from locked to open for the same key, which is a save
 * confirmed now; a reload that finds an account already open, or a guest
 * who signs in to another account, is no such moment. It is remembered for
 * that account the moment it shows, so it never comes back.
 */
import type { GuestMigrationStage, GuestMode } from '@/features/guest';

export type WorldsAccess = 'guest' | 'saving' | 'open';

export function worldsAccess(mode: GuestMode, saveStage: GuestMigrationStage | null | undefined): WorldsAccess {
  if (mode === 'active') return 'guest';
  if (mode === 'promoting') return saveStage === 'done' ? 'open' : 'saving';
  return 'open';
}

/** The key the door is about: the guest's own while a guest plays, the signed-in account's otherwise. */
export interface WorldsAccessSeen {
  access: WorldsAccess;
  pubkey: string | undefined;
}

/** Whether going from `prev` to `next` is a guest's save confirmed: locked to open, the same key. */
export function unlockedBySave(prev: WorldsAccessSeen | null, next: WorldsAccessSeen): boolean {
  return !!prev && prev.access !== 'open' && next.access === 'open' && !!next.pubkey && prev.pubkey === next.pubkey;
}

// ─── The word, once ─────────────────────────────────────────────────────────

/** Whether the word was shown for an account on this browser; namespaced like the home's other keys. */
export const WORLDS_GUIDE_STORAGE_PREFIX = 'blobbi:worlds:unlock-guide:v1:';

/** The bubble by the Worlds button once the door opens. */
export const WORLDS_GUIDE_LINE = 'Worlds are open!';

export function readWorldsGuideShown(pubkey: string, storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(WORLDS_GUIDE_STORAGE_PREFIX + pubkey) === 'shown';
  } catch {
    return false;
  }
}

export function writeWorldsGuideShown(pubkey: string, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(WORLDS_GUIDE_STORAGE_PREFIX + pubkey, 'shown');
  } catch {
    /* the word may show once more on this browser; nothing else is lost */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

// ─── What this visit saw ────────────────────────────────────────────────────
//
// Module state, as the blocking layers' queue is: the save's ceremony lives
// above the pages and a save may move the player from one home to the other,
// so what was seen must outlive either page. A reload starts it empty, so a
// door found open at start is never taken for one that just opened.

let seen: WorldsAccessSeen | null = null;
/** The account whose word is due, until it is shown. */
let due: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function subscribeWorldsGuide(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The account whose word is due, or null. */
export function worldsGuideDue(): string | null {
  return due;
}

/** The door as it is now; a save confirmed since the last look makes the word due (unless shown before). */
export function noteWorldsAccess(next: WorldsAccessSeen, storage?: Pick<Storage, 'getItem'> | null): void {
  const prev = seen;
  seen = next;
  if (unlockedBySave(prev, next) && !readWorldsGuideShown(next.pubkey!, storage)) {
    due = next.pubkey!;
    emit();
  } else if (due && next.pubkey !== due) {
    // Another account now: the word was this one's
    due = null;
    emit();
  }
}

/** The word was shown: remembered for the account, and no longer due. */
export function markWorldsGuideShown(pubkey: string, storage?: Pick<Storage, 'setItem'> | null): void {
  writeWorldsGuideShown(pubkey, storage);
  if (due === pubkey) {
    due = null;
    emit();
  }
}

/** For tests: as a fresh visit. */
export function resetWorldsAccessSeen(): void {
  seen = null;
  due = null;
  emit();
}
