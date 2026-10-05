/**
 * The first Blobbi of an account: an onboarding rule, decided from what the
 * account owns and from nothing else.
 *
 * A newcomer's first egg hatches right away, without the hatch missions that
 * stand between every later egg and its baby. Ditto and Blobbi Island both
 * hold this (Ditto's `decideFirstHatch`: no Blobbi or only eggs means the
 * hatching ceremony; any baby or adult means the normal rules), and so does
 * the home:
 *
 *   an egg qualifies   while the account owns no hatched Blobbi (no baby,
 *                      no adult), whatever else it owns
 *
 * So the rule limits itself: the moment the first egg hatches, the account
 * owns a baby and no other egg qualifies again. Nothing is remembered on the
 * device and no tag marks a "first" Blobbi; the answer is recomputed from the
 * collection every time. It is a lifecycle rule, not a visual one: it reads
 * stages only, and holds for every visual generation alike.
 *
 * Pure. The relay read that confirms the answer lives in
 * `useFirstBlobbiHatch`; the hatch itself is the kit's (`useBlobbiHatch`).
 */
import { KIND_BLOBBI_STATE, type NostrEvent } from '@blobbi-kit/core';

/** The slice of a parsed Blobbi the rule reads. */
export interface OwnedBlobbi {
  d: string;
  stage: 'egg' | 'baby' | 'adult';
}

export type FirstBlobbiDecision =
  /** This egg is the account's first Blobbi: it hatches without missions. */
  | { first: true }
  /** `not-an-egg`: nothing to hatch. `has-hatched-blobbi`: the account already raised one; normal rules. */
  | { first: false; reason: 'not-an-egg' | 'has-hatched-blobbi' };

const isHatched = (stage: string | undefined) => stage === 'baby' || stage === 'adult';

/** Whether `blobbi` is the account's first Blobbi, over the account's parsed collection. */
export function decideFirstBlobbi(blobbi: OwnedBlobbi, owned: readonly OwnedBlobbi[]): FirstBlobbiDecision {
  if (blobbi.stage !== 'egg') return { first: false, reason: 'not-an-egg' };
  if (owned.some((other) => other.d !== blobbi.d && isHatched(other.stage))) return { first: false, reason: 'has-hatched-blobbi' };
  return { first: true };
}

/**
 * The same question over RAW kind 31124 events, leniently: any event of the
 * kind with a `d` and a hatched stage counts, modern or legacy, namespaced or
 * not. This is the read that confirms the rule against the relays, so it must
 * see Blobbis the home's modern-only collection drops.
 */
export function hasHatchedBlobbi(events: readonly NostrEvent[], exceptD?: string): boolean {
  return events.some((event) => {
    if (event.kind !== KIND_BLOBBI_STATE) return false;
    const d = event.tags.find(([name]) => name === 'd')?.[1];
    const stage = event.tags.find(([name]) => name === 'stage')?.[1];
    return !!d && d !== exceptD && isHatched(stage);
  });
}

/** Whether a raw read holds the Blobbi `d` itself: proof the relays answered about this account at all. */
export function holdsBlobbi(events: readonly NostrEvent[], d: string): boolean {
  return events.some((event) => event.kind === KIND_BLOBBI_STATE && event.tags.some(([name, value]) => name === 'd' && value === d));
}
