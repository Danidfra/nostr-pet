import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import type { PublishAdapter, PublishEventTemplate } from '@blobbi-kit/react';
import type { NostrEvent } from '@blobbi-kit/core';
import { useCurrentUser } from '@/hooks/useCurrentUser';

/** NIP-89 client name stamped on every event this app publishes. */
export const CLIENT_NAME = 'Blobbi';

/** Replaceable (10000–19999, 0, 3) or addressable (30000–39999) kinds carry `published_at`. */
export function isReplaceableKind(kind: number): boolean {
  if (kind === 0 || kind === 3) return true;
  return (kind >= 10000 && kind < 20000) || (kind >= 30000 && kind < 40000);
}

/**
 * Finish a kit event template into what the signer receives: the `client`
 * tag, and `published_at` preserved from `prev` (or set to `created_at` on a
 * first publish) for replaceable kinds. Pure, so the invariants are testable
 * without a signer.
 */
export function finalizeTemplate(template: PublishEventTemplate, now: number = Math.floor(Date.now() / 1000)) {
  const { prev, ...rest } = template;
  const tags = [...(rest.tags ?? [])];
  if (!tags.some(([name]) => name === 'client')) tags.push(['client', CLIENT_NAME]);
  const created_at = rest.created_at ?? now;
  if (isReplaceableKind(rest.kind) && !tags.some(([name]) => name === 'published_at')) {
    const previous = prev?.tags.find(([name]) => name === 'published_at');
    tags.push(['published_at', previous ? previous[1] : String(created_at)]);
  }
  return { kind: rest.kind, content: rest.content ?? '', tags, created_at };
}

/** The publish adapter plus the two halves apart, for a write that must be recorded between signing and sending. */
export interface HomePublisher extends PublishAdapter {
  /** Sign only; nothing is sent. */
  sign(template: PublishEventTemplate): Promise<NostrEvent>;
  /** Send an already-signed event to the pool; resolves when one relay accepts it. */
  broadcast(event: NostrEvent): Promise<void>;
}

/** How long a relay gets to answer a publish before it counts as silent. */
export const PUBLISH_TIMEOUT_MS = 8_000;

/**
 * The thinnest `PublishAdapter` over the app's Nostr transport: sign with the
 * current signer (NIP-07 or NIP-46; the key never lives here), verify the
 * signer answered for the signed-in pubkey, fan out to the relay pool.
 *
 * Nostr transport and signing stay here; what an event MEANS stays in the
 * kit and in `care-plan.ts`.
 */
export function usePublishAdapter(): HomePublisher {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMemo<HomePublisher>(() => {
    const sign = async (template: PublishEventTemplate): Promise<NostrEvent> => {
      if (!user) throw new Error('Sign in to do that.');
      const unsigned = finalizeTemplate(template);
      const event = await user.signer.signEvent(unsigned);
      if (event.pubkey !== user.pubkey) {
        throw new Error('The signer answered for a different account.');
      }
      return event;
    };
    const broadcast = async (event: NostrEvent): Promise<void> => {
      await nostr.event(event, { signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS) });
    };
    return {
      sign,
      broadcast,
      async publish(template) {
        const event = await sign(template);
        await broadcast(event);
        return event;
      },
    };
  }, [nostr, user]);
}
