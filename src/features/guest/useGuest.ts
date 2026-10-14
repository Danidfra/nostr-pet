import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { useNostrLogin } from '@nostrify/react/login';
import { GuestStoreContext, GuestUiContext, GuestUserContext, withActiveTime, withConflictSeen, withInviteDismissed, withInviteOptOut, withLanded, withMigrationCleared, withMigrationStage, withProfileDone, type GuestSnapshot, type GuestUi, type GuestUser } from './guest-context';
import { createGuestDocument, withoutSecret, type GuestDocument, type GuestMigrationStage } from './guest-store';
import { reserveGuestIdentity } from './guest-signer';
import { resolveGuestMode, type GuestMode } from './guest-session';
import type { MigrationStep } from './guest-migration';

const EMPTY: GuestSnapshot = { doc: null, storageOk: true, persisted: false, unreadable: null };
const noop = () => () => {};

/** Who is signed in through the login store, before any resolution: the newest login's pubkey. */
export function useLoginPubkey(): string | undefined {
  const { logins } = useNostrLogin();
  return logins[0]?.pubkey;
}

/** The store's state, re-rendering on change; empty (and inert) where no provider is mounted, so nothing else changes. */
export function useGuestSnapshot(): GuestSnapshot {
  const store = useContext(GuestStoreContext);
  return useSyncExternalStore(store?.subscribe ?? noop, store ? store.snapshot : () => EMPTY, store ? store.snapshot : () => EMPTY);
}

export interface Guest extends GuestSnapshot {
  mode: GuestMode;
  /** The signed-in account's pubkey, from the login store (undefined while nobody is). */
  loginPubkey: string | undefined;
  /** Begin playing as a guest: reserve the key, open the record. Null when no key can be made here. */
  start: () => GuestDocument | null;
  /** Maybe later: the invitation rests (`INVITE_REST_MS`). */
  dismissInvite: () => void;
  /** Don't ask again: no automatic invitation in this browser (M15). */
  optOutInvite: () => void;
  /** Active play counted, in milliseconds (M15): a visible, focused stretch. */
  addActiveTime: (ms: number) => void;
  /** Saving begins (or resumes) at `stage`. */
  setStage: (stage: GuestMigrationStage) => void;
  /** Saving backed out of before any sign-in: as if never begun. */
  cancelSave: () => void;
  recordLanded: (step: MigrationStep, id: string) => void;
  profileDone: () => void;
  rememberConflict: (loginPubkey: string) => void;
  /** The record is let go: confirmed on the relays. */
  clear: () => void;
  /** The guest Blobbi removed from this device by the player's explicit, confirmed choice, with everything the device kept about it (M15). */
  removeFromDevice: () => void;
  /** The reserved secret key, for the save's key step only (`SECURITY.md`); null when there is no guest. */
  revealSecret: () => string | null;
}

export function useGuest(): Guest {
  const store = useContext(GuestStoreContext);
  const snapshot = useGuestSnapshot();
  const loginPubkey = useLoginPubkey();
  const mode = resolveGuestMode(snapshot.doc, loginPubkey);

  const start = useCallback((): GuestDocument | null => {
    if (!store) return null;
    const existing = store.snapshot().doc;
    if (existing) return existing;
    try {
      const doc = createGuestDocument(reserveGuestIdentity());
      store.begin(doc);
      return withoutSecret(doc);
    } catch {
      return null;
    }
  }, [store]);

  // The actions change only with the store, never with its state: an effect may depend on one without re-running
  // at every change of the record (and never looping on its own writes)
  const actions = useMemo<Omit<Guest, keyof GuestSnapshot | 'mode' | 'loginPubkey'>>(
    () => ({
      start,
      dismissInvite: () => store?.update((d) => withInviteDismissed(d)),
      optOutInvite: () => store?.update((d) => withInviteOptOut(d)),
      addActiveTime: (ms) => store?.update((d) => withActiveTime(d, ms)),
      setStage: (stage) => store?.update((d) => withMigrationStage(d, stage)),
      cancelSave: () => store?.update((d) => withMigrationCleared(d)),
      recordLanded: (step, id) => store?.update((d) => withLanded(d, step, id)),
      profileDone: () => store?.update((d) => withProfileDone(d)),
      rememberConflict: (pubkey) => store?.update((d) => withConflictSeen(d, pubkey)),
      clear: () => store?.clear(),
      removeFromDevice: () => store?.remove(),
      revealSecret: () => store?.revealSecret() ?? null,
    }),
    [start, store],
  );
  return useMemo<Guest>(() => ({ ...snapshot, mode, loginPubkey, ...actions }), [snapshot, mode, loginPubkey, actions]);
}

/** The guest as the current user, while a guest plays; null otherwise. */
export function useGuestUser(): GuestUser | null {
  return useContext(GuestUserContext);
}

/** What a menu asked the page to show for the guest (`GuestProvider`). */
export function useGuestUi(): GuestUi {
  return useContext(GuestUiContext);
}
