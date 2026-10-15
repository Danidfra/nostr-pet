import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KIND_BLOBBONAUT_PROFILE, fetchFreshBlobbonautProfile, type BlobbonautProfile } from '@blobbi-kit/core';

/**
 * The player's global profile (kind 11125): `has` (owned Blobbi d-tags),
 * `current_companion`, player `xp`/`level`.
 *
 * Kind 11125 is a different event from the per-Blobbi kind 31124 state and is
 * never treated as one. The read itself is the kit's own
 * `fetchFreshBlobbonautProfile`, so profile semantics (which kinds, which
 * d-values, which event wins) stay in one place; this hook only caches it.
 * `null` means "no profile found", which is a normal state for a player who
 * has never adopted.
 *
 * The home watches it (`watch`): read again when the page comes back to the
 * front, when the connection returns, and every minute while visible, so a
 * companion chosen in another Blobbi app (Blobbi Pixel, Ditto, this home on
 * another device) is met without a reload. A read is only ever a read: what
 * it finds is put in order with this device's choice (`useCompanionChoice`).
 */
export const PROFILE_WATCH_INTERVAL_MS = 60_000;

export function useBlobbonautProfile(pubkey: string | undefined, { watch = false }: { watch?: boolean } = {}) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();

  return useQuery<BlobbonautProfile | null>({
    queryKey: ['blobbonaut-profile', pubkey ?? ''],
    queryFn: async () => {
      const fresh = await fetchFreshBlobbonautProfile(nostr, pubkey!);
      return newerProfile(queryClient.getQueryData<BlobbonautProfile | null>(['blobbonaut-profile', pubkey ?? '']) ?? null, fresh);
    },
    enabled: !!pubkey,
    staleTime: 30_000,
    retry: 1,
    // Coming back to the page is coming back from another Blobbi game: read again even if the last read is fresh
    ...(watch ? { refetchOnWindowFocus: 'always' as const, refetchOnReconnect: true, refetchInterval: PROFILE_WATCH_INTERVAL_MS, refetchIntervalInBackground: false } : {}),
  });
}

/**
 * A read never takes the profile backwards: a relay a moment behind (or a read cut short, which finds nothing)
 * keeps the newer profile already known. Profiles are never deleted, so "none" after "one" is a short read.
 * NIP-01 order: the newer `created_at`, then the lower id; an 11125 before a legacy 31125.
 */
export function newerProfile(known: BlobbonautProfile | null, fresh: BlobbonautProfile | null): BlobbonautProfile | null {
  if (!known || known.event.pubkey !== fresh?.event.pubkey) return fresh ?? known;
  const a = known.event;
  const b = fresh.event;
  if (a.kind !== b.kind) return a.kind === KIND_BLOBBONAUT_PROFILE ? known : fresh;
  return b.created_at > a.created_at || (b.created_at === a.created_at && b.id <= a.id) ? fresh : known;
}
