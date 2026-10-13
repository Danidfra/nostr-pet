/**
 * A newborn's first needs (M14.1).
 *
 * The kit's hatch plan writes every stat at its maximum, which leaves a
 * baby with nothing to do for its player for hours. A newly hatched Blobbi
 * here starts healthy but not full: a little hungry, a little dusty, a
 * little sleepy, glad to be out, so the first minutes invite the first
 * care without ever showing a need in warning (the kit's baby warning
 * line is 65; critical far below). Health stays full: a newborn is well.
 *
 * Applied by this app to the hatch event it is about to publish, after the
 * kit planned it: the same tags the schema allows (every stat within 1 to
 * 100), the same kinds, the same canonical shape. The kit is untouched, and
 * a hatch written by another Blobbi app is simply what it is.
 */
import { getTagValue, updateBlobbiTags, type BlobbiStats } from '@blobbi-kit/core';

export const NEWBORN_STATS: Readonly<BlobbiStats> = { hunger: 80, happiness: 86, health: 100, hygiene: 88, energy: 84 };

/** A hatch template (egg → baby) with the newborn's needs instead of full ones; anything else untouched. */
export function withNewbornStats<T extends { tags?: string[][] }>(template: T, stats: Readonly<BlobbiStats> = NEWBORN_STATS): T {
  if (!template.tags || getTagValue(template.tags, 'stage') !== 'baby') return template;
  return {
    ...template,
    tags: updateBlobbiTags(template.tags, {
      hunger: String(stats.hunger),
      happiness: String(stats.happiness),
      health: String(stats.health),
      hygiene: String(stats.hygiene),
      energy: String(stats.energy),
    }),
  };
}
