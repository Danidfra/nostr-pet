import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { fetchFreshBlobbonautProfile, type BlobbonautProfile } from '@blobbi-kit/core';

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
 */
export function useBlobbonautProfile(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<BlobbonautProfile | null>({
    queryKey: ['blobbonaut-profile', pubkey ?? ''],
    queryFn: () => fetchFreshBlobbonautProfile(nostr, pubkey!),
    enabled: !!pubkey,
    staleTime: 30_000,
    retry: 1,
  });
}
