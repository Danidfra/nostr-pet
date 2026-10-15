/**
 * The app's relay pool as `ProfileRelays`: each application relay asked and
 * written to on its own (the pool's own query merges answers and cannot say
 * which relays answered, which is what a complete read needs). Only the
 * application relays: a read hint never becomes a write target.
 */
import type { NPool, NostrFilter } from '@nostrify/nostrify';
import type { NostrEvent } from '@blobbi-kit/core';
import { BASE_RELAYS, PROFILE_ANCHOR_RELAY, PROFILE_REQUIRED_RELAYS, PROFILE_WRITE_QUORUM } from '@/config/relays';
import type { ProfileRelays } from './profile-write';

/** Whether this transport can be asked relay by relay (the real pool; not a guest's world or a dev fixture). */
export function canAskRelays(nostr: unknown): nostr is NPool {
  return !!nostr && typeof (nostr as NPool).relay === 'function';
}

export function poolProfileRelays(nostr: NPool, urls: readonly string[] = BASE_RELAYS): ProfileRelays {
  // Never an empty requirement: without the shared relays in the set, every relay must answer
  const shared = PROFILE_REQUIRED_RELAYS.filter((u) => urls.includes(u));
  return {
    urls,
    required: shared.length ? shared : urls,
    anchor: PROFILE_ANCHOR_RELAY,
    quorum: PROFILE_WRITE_QUORUM,
    async query(url, filter, signal) {
      return (await nostr.relay(url).query([{ ...filter } as NostrFilter], { signal })) as NostrEvent[];
    },
    async publish(url, event, signal) {
      try {
        await nostr.relay(url).event(event, { signal });
      } catch (error) {
        // NIP-01: the relay already holds this very event
        if (error instanceof Error && /^duplicate:/i.test(error.message)) return;
        throw error;
      }
    },
  };
}
