/**
 * Guest mode's two providers.
 *
 * `GuestProvider` owns the guest store (one per app, over this origin's
 * storage) and mounts inside the login store, so the mode can be decided
 * from both: a guest record and a login.
 *
 * `GuestTransport` mounts inside `NostrProvider`, where the real pool is.
 * While a guest plays (`mode === 'active'`) it hands the app the guest pool
 * (`guest-pool.ts`) and the guest as the signed-in user; the real pool stays
 * underneath for what is not the guest's (catalogues, a signer's handshake).
 * In every other mode it renders its children untouched: a signed-in player,
 * or an app with no guest record, runs exactly as before M14.
 */
import { useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { NostrContext, useNostr } from '@nostrify/react';
import type { NostrEvent } from '@blobbi-kit/core';
import { GuestStoreContext, GuestUiContext, GuestUserContext, createGuestStore, withEvents, type GuestStore, type GuestUi, type GuestUiRequest } from './guest-context';
import { createGuestPool } from './guest-pool';
import { localRecordSigner } from './guest-signer';
import { storageOrNull, type GuestStorage } from './guest-store';
import { useGuestSnapshot, useLoginPubkey } from './useGuest';
import { resolveGuestMode } from './guest-session';

export function GuestProvider({ children, store, storage }: { children: ReactNode; store?: GuestStore; storage?: GuestStorage | null }) {
  const own = useMemo(() => store ?? createGuestStore(storage === undefined ? storageOrNull() : storage), [store, storage]);
  // What a menu asked the page for (Save my Blobbi, I already have an account): the page renders it, the menu never does
  const [request, setRequest] = useState<GuestUiRequest>(null);
  const [saved, setSaved] = useState(false);
  const ui = useMemo<GuestUi>(
    () => ({ request, requestSave: () => setRequest('save'), requestSignIn: () => setRequest('sign-in'), clearRequest: () => setRequest(null), saved, markSaved: () => setSaved(true) }),
    [request, saved],
  );
  return (
    <GuestStoreContext.Provider value={own}>
      <GuestUiContext.Provider value={ui}>{children}</GuestUiContext.Provider>
    </GuestStoreContext.Provider>
  );
}

export function GuestTransport({ children }: { children: ReactNode }) {
  const store = useContext(GuestStoreContext);
  const snapshot = useGuestSnapshot();
  const loginPubkey = useLoginPubkey();
  const { nostr: upstream } = useNostr();
  const mode = resolveGuestMode(snapshot.doc, loginPubkey);
  const guestPubkey = mode === 'active' ? snapshot.doc?.identity.pubkey : undefined;

  // The world handle reads the store live, so a pool made once sees every later record
  const replace = useCallback(
    (events: NostrEvent[]) => {
      store?.update((doc) => {
        const written = events.length > 0 ? [...events].sort((a, b) => b.created_at - a.created_at).find((e) => !doc.events.some((old) => old.id === e.id)) ?? null : null;
        return withEvents(doc, events, written);
      });
    },
    [store],
  );
  const pool = useMemo(() => {
    if (!store || !guestPubkey) return null;
    return createGuestPool({
      guestPubkey,
      world: { events: () => store.snapshot().doc?.events ?? [], replace },
      upstream,
      log: import.meta.env.DEV ? (m) => console.info(m) : undefined,
    });
  }, [store, guestPubkey, upstream, replace]);
  const user = useMemo(() => (guestPubkey ? { pubkey: guestPubkey, signer: localRecordSigner(guestPubkey) } : null), [guestPubkey]);

  if (!pool || !user) return <>{children}</>;
  return (
    <GuestUserContext.Provider value={user}>
      <NostrContext.Provider value={{ nostr: pool }}>{children}</NostrContext.Provider>
    </GuestUserContext.Provider>
  );
}
