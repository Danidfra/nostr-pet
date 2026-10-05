import { useCallback, useMemo, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { KIND_BLOBBI_STATE } from '@blobbi-kit/core';
import { timeoutSignal } from '@/lib/abort';
import { decideFirstBlobbi, hasHatchedBlobbi, holdsBlobbi, type OwnedBlobbi } from './first-blobbi';

export interface UseFirstBlobbiHatchOptions {
  blobbi: OwnedBlobbi;
  /** The account's parsed collection, as the home holds it. */
  companions: readonly OwnedBlobbi[];
  pubkey: string | undefined;
}

export interface FirstBlobbiHatch {
  /** This egg is the account's first Blobbi as far as the home knows: it may hatch without missions. */
  qualifies: boolean;
  /**
   * Ask the relays before acting: a FRESH, lenient read of the account's
   * kind 31124 events. Resolves true only when a read answered (it holds
   * this egg) and holds no hatched Blobbi. Reads that fail, time out or come
   * back without the egg are retried a little and then resolve false (the
   * rule fails closed: the egg keeps its normal progression), and a read that
   * found a hatched Blobbi the collection did not show ends the
   * qualification for good.
   */
  confirm: () => Promise<boolean>;
}

const CONFIRM_TIMEOUT_MS = 6_000;
/** A just-published egg may not be readable everywhere yet: a few reads, a moment apart. */
const CONFIRM_ATTEMPTS = 3;
const CONFIRM_RETRY_MS = 1_200;

/**
 * The first-Blobbi rule for one egg (`first-blobbi.ts`): the decision over
 * the collection the home already holds, and the relay read that confirms it
 * right before a hatch. The same two steps Ditto takes (its decision, then
 * its ownership preflight), so a collection that came back partial never
 * hands a second Blobbi the first one's shortcut.
 */
export function useFirstBlobbiHatch({ blobbi, companions, pubkey }: UseFirstBlobbiHatchOptions): FirstBlobbiHatch {
  const { nostr } = useNostr();
  // Set only by a relay read that contradicted the collection; per Blobbi (the home is keyed on `d`).
  const [contradicted, setContradicted] = useState(false);
  const { d, stage } = blobbi;
  const decision = useMemo(() => decideFirstBlobbi({ d, stage }, companions), [d, stage, companions]);

  const confirm = useCallback(async (): Promise<boolean> => {
    if (!pubkey) return false;
    for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, CONFIRM_RETRY_MS));
      try {
        const events = await nostr.query([{ kinds: [KIND_BLOBBI_STATE], authors: [pubkey] }], { signal: timeoutSignal(CONFIRM_TIMEOUT_MS) });
        if (hasHatchedBlobbi(events, d)) {
          setContradicted(true);
          return false;
        }
        if (holdsBlobbi(events, d)) return true;
      } catch {
        /* a failed read proves nothing: try again, then fail closed */
      }
    }
    return false;
  }, [nostr, pubkey, d]);

  return { qualifies: decision.first && !contradicted, confirm };
}
