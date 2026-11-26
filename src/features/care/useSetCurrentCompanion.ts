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
import { canAskRelays } from '@/features/companion/pool-relays';
import { t } from '@/i18n';

export type SetCurrentCompanionResult =
  | { published: true; event: NostrEvent }
  | { published: false; reason: 'no-profile' | 'unchanged' | 'networked' };

/**
 * Make a Blobbi the profile's `current_companion` (kind 11125) in a world
 * that lives on this device: a guest's (the guest pool) or a dev fixture's.
 * Fresh read of the profile, the kit's `updateBlobbonautTags` over its full
 * tag list (so `has`, `xp`, onboarding and every unknown tag survive),
 * publish with `prev`.
 *
 * NEVER on the real relays: a signed-in player's choice is written by the
 * companion sync (`src/features/companion`), whose profile write reads every
 * required relay to the end and never restores an older profile. Over a real
 * pool this publishes nothing (`networked`); the device pick still applies.
 *
 * Refuses a `d` the player does not own. With no profile nothing is created
 * here (adoption owns profile creation).
 */
export function useSetCurrentCompanion(pubkey: string | undefined) {
  const { nostr } = useNostr();
  const publisher = usePublishAdapter();
  const queryClient = useQueryClient();

  return useMutation<SetCurrentCompanionResult, Error, { d: string; ownedDs: readonly string[] }>({
    mutationFn: async ({ d, ownedDs }) => {
      if (!pubkey) throw new Error(t('home.care.error.signInFirst'));
      if (!ownedDs.includes(d)) throw new Error(t('home.care.error.notYours'));
      if (canAskRelays(nostr)) return { published: false, reason: 'networked' };

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
