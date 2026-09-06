import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import {
  KIND_BLOBBONAUT_PROFILE,
  fetchFreshBlobbonautProfile,
  parseBlobbonautEvent,
  updateBlobbonautTags,
  type BlobbonautProfile,
  type NostrEvent,
} from '@blobbi-kit/core';
import { usePublishAdapter } from './usePublishAdapter';

export type SetCurrentCompanionResult =
  | { published: true; event: NostrEvent }
  | { published: false; reason: 'no-profile' | 'unchanged' };

/**
 * Make a Blobbi the profile's `current_companion` (kind 11125), the way the
 * rest of the ecosystem does it: fresh read of the profile, the kit's
 * `updateBlobbonautTags` over the profile's full tag list (so `has`, `xp`,
 * onboarding and every unknown tag survive), publish with `prev`.
 *
 * Refuses a `d` the player does not own. With no profile on relays nothing is
 * created here (adoption owns profile creation); the device pick still applies.
 */
export function useSetCurrentCompanion(pubkey: string | undefined) {
  const { nostr } = useNostr();
  const publisher = usePublishAdapter();
  const queryClient = useQueryClient();

  return useMutation<SetCurrentCompanionResult, Error, { d: string; ownedDs: readonly string[] }>({
    mutationFn: async ({ d, ownedDs }) => {
      if (!pubkey) throw new Error('Sign in first.');
      if (!ownedDs.includes(d)) throw new Error('That Blobbi is not yours.');

      const profile = await fetchFreshBlobbonautProfile(nostr, pubkey);
      if (!profile) return { published: false, reason: 'no-profile' };
      if (profile.currentCompanion === d) return { published: false, reason: 'unchanged' };

      const withoutCurrent = profile.allTags.filter((tag) => tag[0] !== 'current_companion');
      const tags = updateBlobbonautTags(withoutCurrent, { current_companion: d });
      const event = await publisher.publish({
        kind: KIND_BLOBBONAUT_PROFILE,
        content: profile.content,
        tags,
        prev: profile.event,
      });

      const parsed = parseBlobbonautEvent(event);
      if (parsed) queryClient.setQueryData<BlobbonautProfile | null>(['blobbonaut-profile', pubkey], parsed);
      queryClient.invalidateQueries({ queryKey: ['blobbonaut-profile', pubkey] });
      return { published: true, event };
    },
  });
}
