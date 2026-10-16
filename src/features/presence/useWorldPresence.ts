/**
 * World presence in React (README.md): the page's presence for the signed-in account, and the sync that moves the
 * home's Blobbi to match it through the home's own teleport (`usePresence`). Nothing here touches Nostr; nothing
 * here changes which Blobbi is the companion.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Presence } from '@/features/teleport/react/usePresence';
import { cookieLeaseStore, createPresencePage, syncPresence, type PresencePage, type PresenceSnapshot } from './presence-page';
import { worldPresenceEnabled } from './presence-switch';
import { HOME_APP, placeOf } from './world-presence';

const HOME: PresenceSnapshot = { place: HOME_APP, here: true, visible: true, visibleSince: 0 };
const noop = () => () => {};

export interface WorldPresence {
  /** Where the Blobbi is, and whether that is this home. Always home while presence is off. */
  snapshot: PresenceSnapshot;
  /** The page, for the sync and for a button that calls the Blobbi home (`page.input()`); null while off. */
  page: PresencePage | null;
}

/** The page's presence for `pubkey` (null while signed out); one page per account for the life of the component. */
export function useWorldPresence(pubkey: string | null | undefined): WorldPresence {
  const [page, setPage] = useState<PresencePage | null>(null);
  useEffect(() => {
    if (!pubkey || !worldPresenceEnabled()) return;
    const p = createPresencePage({ app: HOME_APP, store: cookieLeaseStore(pubkey) });
    setPage(p);
    return () => {
      p.dispose();
      setPage((current) => (current === p ? null : current));
    };
  }, [pubkey]);
  const snapshot = useSyncExternalStore(page ? page.subscribe : noop, page ? page.snapshot : () => HOME, () => HOME);
  return { snapshot, page };
}

export interface WorldPresenceSyncOptions {
  page: PresencePage | null;
  presence: Presence;
  /** The home's own moment, which a departure waits for (care in flight, a ceremony, a bath, a sheet). */
  busy: boolean;
  /** The home is driving its Blobbi itself (its arrival on entry, a trip to another world): the sync stands aside. */
  paused: boolean;
  /** A journey began because of where the Blobbi is. */
  onJourney?: (kind: 'enter' | 'leave', place: string) => void;
}

/** Keeps the home's Blobbi where it is: departs when another app has it, comes back when it is home again. */
export function useWorldPresenceSync({ page, presence, busy, paused, onJourney }: WorldPresenceSyncOptions): void {
  const latest = useRef({ busy, paused, onJourney });
  latest.current = { busy, paused, onJourney };
  const controller = presence.controller;
  const syncRef = useRef<ReturnType<typeof syncPresence> | null>(null);
  useEffect(() => {
    if (!page || controller.isDisposed()) return;
    const sync = syncPresence({
      page,
      blobbi: {
        state: () => (latest.current.paused ? 'present' : controller.getState()),
        enter: () => {
          if (!latest.current.paused) controller.enter();
        },
        leave: () => {
          if (!latest.current.paused) controller.leave();
        },
      },
      busy: () => latest.current.busy || latest.current.paused,
      onJourney: (kind, place) => latest.current.onJourney?.(kind, place),
    });
    syncRef.current = sync;
    return () => {
      sync.dispose();
      if (syncRef.current === sync) syncRef.current = null;
    };
  }, [page, controller]);
  // The home's moment ended, or it stopped driving its Blobbi: look again now
  useEffect(() => {
    if (!busy && !paused) syncRef.current?.check();
  }, [busy, paused]);
}

/** Whether the Blobbi is home right now, read at once (the first render's teleport starts there: no departure on load). */
export function blobbiIsHome(pubkey: string | null | undefined): boolean {
  if (!pubkey || !worldPresenceEnabled()) return true;
  return placeOf(cookieLeaseStore(pubkey).read(), Date.now()) === HOME_APP;
}
