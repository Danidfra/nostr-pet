import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBlobbisCollection } from '@blobbi-kit/react';
import { getSelectedBlobbiKey, type BlobbiCompanion, type BlobbonautProfile } from '@blobbi-kit/core';

import { useCurrentUser } from './useCurrentUser';
import { useBlobbonautProfile } from './useBlobbonautProfile';
import { selectCurrentBlobbi } from '@/lib/select-current-blobbi';

/**
 * Where the home stands, as one word the page switches on.
 *
 * - `signed-out`: no user; nothing is read.
 * - `loading`: the collection (or the profile that decides the default pick)
 *   is still in flight.
 * - `empty`: the read completed and the player owns no modern Blobbi.
 * - `ready`: at least one modern Blobbi, and `current` is set.
 * - `error`: the collection read failed; `error` is set.
 */
export type HomeBlobbiStatus = 'signed-out' | 'loading' | 'empty' | 'ready' | 'error';

export interface HomeBlobbi {
  status: HomeBlobbiStatus;
  pubkey: string | undefined;
  companions: readonly BlobbiCompanion[];
  current: BlobbiCompanion | undefined;
  profile: BlobbonautProfile | null | undefined;
  error: unknown;
  /** Make `d` the current Blobbi on this device. */
  select: (d: string) => void;
  /** Re-read the collection from relays. */
  refresh: () => void;
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
 * profile's `current_companion`. No event is ever published from here.
 */
export function useHomeBlobbi(): HomeBlobbi {
  const { user } = useCurrentUser();
  const pubkey = user?.pubkey;

  const collection = useBlobbisCollection(undefined, pubkey);
  const profile = useBlobbonautProfile(pubkey);

  const [localSelection, setLocalSelection] = useState<string | undefined>(() => readLocalSelection(pubkey));
  useEffect(() => {
    setLocalSelection(readLocalSelection(pubkey));
  }, [pubkey]);

  const select = useCallback(
    (d: string) => {
      if (!pubkey) return;
      writeLocalSelection(pubkey, d);
      setLocalSelection(d);
    },
    [pubkey],
  );

  const current = useMemo(
    () => selectCurrentBlobbi(collection.companions, [localSelection, profile.data?.currentCompanion]),
    [collection.companions, localSelection, profile.data?.currentCompanion],
  );

  const status: HomeBlobbiStatus = (() => {
    if (!pubkey) return 'signed-out';
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
    error: collection.error,
    select,
    refresh: collection.invalidate,
  };
}
