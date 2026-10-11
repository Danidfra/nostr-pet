import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBlobbisCollection } from '@blobbi-kit/react';
import { getSelectedBlobbiKey, type BlobbiCompanion, type BlobbonautProfile, type NostrEvent } from '@blobbi-kit/core';

import { useCurrentUser } from './useCurrentUser';
import { useBlobbonautProfile } from './useBlobbonautProfile';
import { selectCurrentBlobbi } from '@/lib/select-current-blobbi';
import { useSetCurrentCompanion, type SetCurrentCompanionResult } from '@/features/care/useSetCurrentCompanion';
import { useRelayHealth } from './useRelayHealth';
import { RelayTransportError } from '@/lib/relay-transport';

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
  /** The last profile publish for a selection, for feedback. */
  selection: { isPending: boolean; result: SetCurrentCompanionResult | undefined; error: Error | null };
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
 * profile fetch (kind 11125). Selection is `selectCurrentBlobbi` over a local
 * per-device pick (stored under the kit's own `getSelectedBlobbiKey`) and the
 * profile's `current_companion`. Opening the home publishes nothing; only a
 * deliberate selection or care action does.
 */
export function useHomeBlobbi(): HomeBlobbi {
  const { user } = useCurrentUser();
  const pubkey = user?.pubkey;

  const collection = useBlobbisCollection(undefined, pubkey);
  const profile = useBlobbonautProfile(pubkey);
  const setCurrentCompanion = useSetCurrentCompanion(pubkey);
  // Decided before any read: a page that cannot open a relay subscription says so instead of looking forever.
  const blocked = useRelayHealth().health.blocked;
  const blockedError = useMemo(() => (blocked ? new RelayTransportError(blocked) : null), [blocked]);

  const [localSelection, setLocalSelection] = useState<string | undefined>(() => readLocalSelection(pubkey));
  useEffect(() => {
    setLocalSelection(readLocalSelection(pubkey));
  }, [pubkey]);

  const ownedDs = useMemo(() => collection.companions.map((c) => c.d), [collection.companions]);
  const { mutate: publishSelection } = setCurrentCompanion;

  const select = useCallback(
    (d: string) => {
      if (!pubkey || !ownedDs.includes(d)) return;
      writeLocalSelection(pubkey, d);
      setLocalSelection(d);
      publishSelection({ d, ownedDs });
    },
    [pubkey, ownedDs, publishSelection],
  );

  const current = useMemo(
    () => selectCurrentBlobbi(collection.companions, [localSelection, profile.data?.currentCompanion]),
    [collection.companions, localSelection, profile.data?.currentCompanion],
  );

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
    refresh: collection.invalidate,
    updateCompanionEvent: collection.updateCompanionEvent,
  };
}
