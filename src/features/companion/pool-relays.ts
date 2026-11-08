/**
 * The app's relay pool as `ProfileRelays`: the primary relay and each
 * application relay asked and written to on its own (the pool's own query
 * merges answers and cannot say which relays answered, which is what a
 * complete read needs). A read hint never becomes a write target.
 *
 * The primary (`wss://relay.blobbi.pet`) is asked and written FIRST, and is
 * NOT one of `required`: a primary that is down must not turn every profile
 * write into `unsafe`. It is one of `absence`: "this player has no profile
 * at all" (the only case in which one is created from nothing) is believed
 * only when it answered too. Each relay's verdict on a write is told to the
 * pool's observer (`relay-sync.ts`), so a primary that missed a profile shows
 * as pending; `profile-delivery.ts` sends it that very event later.
 */
import type { NPool, NostrFilter } from '@nostrify/nostrify';
import type { NostrEvent } from '@blobbi-kit/core';
import { ABSENCE_REQUIRED_RELAYS, BASE_RELAYS, PRIMARY_RELAY, PROFILE_REQUIRED_RELAYS, PROFILE_WRITE_QUORUM } from '@/config/relays';
import { verdictOf } from '@/lib/relay-sync';
import type { ProfileRelays } from './profile-write';

/** The relays of a profile: the primary first, then the application relays. */
export const PROFILE_RELAYS: readonly string[] = [PRIMARY_RELAY, ...BASE_RELAYS.filter((url) => url !== PRIMARY_RELAY)];

/** The pool's way of hearing what one relay did with a write made relay by relay (`HomePool.noteDelivery`). */
interface DeliveryListener {
  noteDelivery?: (event: NostrEvent, result: { relay: string; verdict: ReturnType<typeof verdictOf>['verdict']; message?: string }) => void;
}

/** Whether this transport can be asked relay by relay (the real pool; not a guest's world or a dev fixture). */
export function canAskRelays(nostr: unknown): nostr is NPool {
  return !!nostr && typeof (nostr as NPool).relay === 'function';
}

export function poolProfileRelays(nostr: NPool, urls: readonly string[] = PROFILE_RELAYS): ProfileRelays {
  // Never an empty requirement: without the shared relays in the set, every relay must answer
  const shared = PROFILE_REQUIRED_RELAYS.filter((u) => urls.includes(u));
  const required = shared.length ? shared : urls;
  const note = (nostr as NPool & DeliveryListener).noteDelivery?.bind(nostr);
  return {
    urls,
    required,
    absence: [...new Set([...required, ...ABSENCE_REQUIRED_RELAYS.filter((u) => urls.includes(u))])],
    quorum: PROFILE_WRITE_QUORUM,
    async query(url, filter, signal) {
      return (await nostr.relay(url).query([{ ...filter } as NostrFilter], { signal })) as NostrEvent[];
    },
    async publish(url, event, signal) {
      try {
        await nostr.relay(url).event(event, { signal });
      } catch (error) {
        const { verdict, message } = verdictOf(error);
        note?.(event, { relay: url, verdict, message });
        // NIP-01: the relay already holds this very event
        if (verdict === 'accepted') return;
        throw error;
      }
      note?.(event, { relay: url, verdict: 'accepted' });
    },
  };
}
