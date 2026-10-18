import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useBlobbisCollection } from '@blobbi-kit/react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { getSelectedBlobbiKey, parseBlobbonautEvent, type BlobbiCompanion, type BlobbonautProfile, type NostrEvent } from '@blobbi-kit/core';

import { useCurrentUser } from './useCurrentUser';
import { useBlobbonautProfile } from './useBlobbonautProfile';
import { selectCurrentBlobbi } from '@/lib/select-current-blobbi';
import { useSetCurrentCompanion, type SetCurrentCompanionResult } from '@/features/care/useSetCurrentCompanion';
import { useRelayHealth } from './useRelayHealth';
import { RelayTransportError } from '@/lib/relay-transport';
import { keepCollectionCanonical, markLocalWrite } from '@/lib/canonical-cache';
import { useGuestUser } from '@/features/guest/useGuest';
import { DevFixtureContext } from '@/dev/DevFixtureContext';
import { usePublishAdapter } from '@/features/care/usePublishAdapter';
import { canAskRelays, poolProfileRelays } from '@/features/companion/pool-relays';
import { profileDelivery } from '@/features/companion/profile-delivery';
import { useCompanionChoice } from '@/features/companion/useCompanionChoice';
import type { SyncEnv, SyncStatus } from '@/features/companion/companion-sync';

/**
 * Where the home stands, as one word the page switches on.
 *
 * - `signed-out`: no user; nothing is read.
 * - `loading`: the collection (or the profile that decides the default pick)
 *   is still in flight.
 * - `empty`: the read completed and the player owns no modern Blobbi.
 * - `ready`: at least one modern Blobbi, and `current` is set.
 * - `error`: the collection read failed, or no relay can be reached from
 *   this page at all (`RelayHealth.blocked`); `error` is set.
 */
export type HomeBlobbiStatus = 'signed-out' | 'loading' | 'empty' | 'ready' | 'error';

export interface HomeBlobbi {
  status: HomeBlobbiStatus;
  pubkey: string | undefined;
  companions: readonly BlobbiCompanion[];
  current: BlobbiCompanion | undefined;
  profile: BlobbonautProfile | null | undefined;
  error: unknown;
  /**
   * Make `d` the current Blobbi: on this device at once, and on the profile's
   * `current_companion` (kind 11125) when the player has a profile.
   */
  select: (d: string) => void;
  /** The last profile publish for a selection, for feedback (a guest's or a dev fixture's local profile). */
  selection: { isPending: boolean; result: SetCurrentCompanionResult | undefined; error: Error | null };
  /**
   * A signed-in player's choice and the other Blobbi apps (`src/features/companion`): whether it is shared yet,
   * Try again, and the question when this device's choice and another app's cannot be put in order.
   * Absent for a guest and a dev fixture (their choice never leaves the device).
   */
  companion?: {
    status: SyncStatus;
    retry: () => void;
    ambiguity: { local: string; global: string } | null;
    resolve: (which: 'local' | 'global') => void;
  };
  /** Re-read the collection from relays. */
  refresh: () => void;
  /** Put a just-published kind 31124 into the collection cache. */
  updateCompanionEvent: (event: NostrEvent) => void;
}

function readLocalSelection(pubkey: string | undefined): string | undefined {
  if (!pubkey) return undefined;
  try {
    return window.localStorage.getItem(getSelectedBlobbiKey(pubkey)) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeLocalSelection(pubkey: string, d: string): void {
  try {
    window.localStorage.setItem(getSelectedBlobbiKey(pubkey), d);
  } catch {
    /* selection still applies for this session */
  }
}

/**
 * The current user's modern Blobbi collection plus the one the home shows.
 *
 * Reads go through the shared kit: `useBlobbisCollection` (kind 31124, modern
 * events only, legacy identified and dropped at the source) and the kit's
 * profile fetch (kind 11125, watched while the home is open). Which Blobbi:
 *
 *  - a signed-in player: this device's choice and the player's global one
 *    (`current_companion`, shared by every Blobbi app) put in order by
 *    `useCompanionChoice` (src/features/companion): a choice made here shows
 *    at once and is shared in the background; a newer one made elsewhere is
 *    shown once no moment is on screen; two that cannot be ordered are put to
 *    the player;
 *  - a guest or a dev fixture: the device pick (the kit's
 *    `getSelectedBlobbiKey`), then the profile's `current_companion`, as
 *    before (their world never leaves the device).
 *
 * Then `selectCurrentBlobbi` (the only Blobbi, else the most recently cared
 * for, when no choice names an owned one). Opening the home publishes
 * nothing; only a deliberate selection or care action does. The cached
 * collection only moves forward: per Blobbi, the newest version stands
 * (`keepCollectionCanonical`).
 */
export function useHomeBlobbi(): HomeBlobbi {
  const { user } = useCurrentUser();
  const pubkey = user?.pubkey;
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const fixture = useContext(DevFixtureContext);

  // Before the collection's first read: a relay a moment behind never undoes a write that landed (canonical-cache.ts)
  keepCollectionCanonical(queryClient);
  const collection = useBlobbisCollection(undefined, pubkey);
  const setCurrentCompanion = useSetCurrentCompanion(pubkey);
  // Decided before any read: a page that cannot open a relay subscription says so instead of looking forever.
  // A guest's world is on this device (M14): no relay is needed for it, so a page that cannot reach one still plays.
  const guest = useGuestUser() !== null;
  const blocked = useRelayHealth().health.blocked;
  const blockedError = useMemo(() => (blocked && !guest ? new RelayTransportError(blocked) : null), [blocked, guest]);
  // A signed-in player on the real relays: their choice is shared with the other Blobbi apps. A guest's world and a
  // dev fixture stay on this device, as before.
  const networked = !!pubkey && !guest && !fixture && !blocked && canAskRelays(nostr);
  const profile = useBlobbonautProfile(pubkey, { watch: networked });

  const ownedDs = useMemo(() => collection.companions.map((c) => c.d), [collection.companions]);

  // ─── A signed-in player: this device's choice and the global one, in order (src/features/companion) ───
  const publisher = usePublishAdapter();
  const accountRef = useRef(pubkey);
  accountRef.current = pubkey;
  const env = useMemo<SyncEnv | null>(() => {
    if (!networked || !canAskRelays(nostr)) return null;
    return {
      account: () => accountRef.current,
      relays: poolProfileRelays(nostr),
      sign: (template) => publisher.sign(template),
      refreshProfile: () => void queryClient.invalidateQueries({ queryKey: ['blobbonaut-profile', pubkey] }),
      onPublished: (event) => {
        const parsed = parseBlobbonautEvent(event);
        if (parsed && event.pubkey === pubkey) queryClient.setQueryData<BlobbonautProfile | null>(['blobbonaut-profile', pubkey], parsed);
      },
    };
  }, [networked, nostr, publisher, queryClient, pubkey]);
  const companion = useCompanionChoice({ pubkey: networked ? pubkey : undefined, ownedDs, profile: profile.data, env, ready: networked && collection.status === 'ready' && !profile.isPending });
  // Profile writes saved while a relay was down: that relay is sent the same signed events later (only when owed)
  useEffect(() => {
    if (env) profileDelivery.start(env.relays);
  }, [env]);

  // ─── A guest or a dev fixture: the device pick, as before ───
  const [localSelection, setLocalSelection] = useState<string | undefined>(() => readLocalSelection(pubkey));
  useEffect(() => {
    setLocalSelection(readLocalSelection(pubkey));
  }, [pubkey]);
  const { mutate: publishSelection } = setCurrentCompanion;
  const localSelect = useCallback(
    (d: string) => {
      if (!pubkey || !ownedDs.includes(d)) return;
      writeLocalSelection(pubkey, d);
      setLocalSelection(d);
      publishSelection({ d, ownedDs });
    },
    [pubkey, ownedDs, publishSelection],
  );

  const select = networked ? companion.select : localSelect;

  // A write this app just published goes into the cache as it is (the canonical rule is for relay answers)
  const { updateCompanionEvent: putInCache } = collection;
  const updateCompanionEvent = useCallback(
    (event: NostrEvent) => {
      markLocalWrite(event);
      putInCache(event);
    },
    [putInCache],
  );

  // Signed in: the choice in order with the other apps'. A guest or a fixture: the device pick, then the profile's.
  const firstPick = networked ? companion.shownD : localSelection;
  const secondPick = networked ? undefined : profile.data?.currentCompanion;
  const current = useMemo(() => selectCurrentBlobbi(collection.companions, [firstPick, secondPick]), [collection.companions, firstPick, secondPick]);

  const status: HomeBlobbiStatus = (() => {
    if (!pubkey) return 'signed-out';
    if (blockedError) return 'error';
    switch (collection.status) {
      case 'error':
        return 'error';
      case 'empty':
        return 'empty';
      case 'ready':
        // Wait for the profile to settle so the default pick does not flip
        // from "newest" to `current_companion` a moment after first paint.
        return profile.isPending ? 'loading' : 'ready';
      default:
        return 'loading';
    }
  })();

  return {
    status,
    pubkey,
    companions: collection.companions,
    current: status === 'ready' ? current : undefined,
    profile: profile.data,
    error: blockedError ?? collection.error,
    select,
    selection: { isPending: setCurrentCompanion.isPending, result: setCurrentCompanion.data, error: setCurrentCompanion.error },
    companion: networked ? { status: companion.status, retry: companion.retry, ambiguity: companion.ambiguity, resolve: companion.resolve } : undefined,
    refresh: collection.invalidate,
    updateCompanionEvent,
  };
}
