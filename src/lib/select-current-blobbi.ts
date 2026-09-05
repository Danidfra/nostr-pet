import type { BlobbiCompanion } from '@blobbi-kit/core';

/**
 * Which of the player's modern Blobbis the home shows.
 *
 * Pure. Given the collection and an ordered list of preferred d-tags (the
 * player's own pick on this device first, then the profile's
 * `current_companion`), the first preference that names a Blobbi in the
 * collection wins. With no usable preference: the only Blobbi when there is
 * one, otherwise the most recently interacted with (ties broken by d-tag so
 * the answer is stable across renders). Nothing when the collection is empty.
 *
 * This is presentation-side selection only. It never writes the profile;
 * publishing a new `current_companion` stays a shared-kit concern.
 */
export function selectCurrentBlobbi(
  companions: readonly BlobbiCompanion[],
  preferredDs: readonly (string | undefined)[] = [],
): BlobbiCompanion | undefined {
  if (companions.length === 0) return undefined;

  for (const d of preferredDs) {
    if (!d) continue;
    const match = companions.find((c) => c.d === d);
    if (match) return match;
  }

  if (companions.length === 1) return companions[0];

  return [...companions].sort(
    (a, b) => b.lastInteraction - a.lastInteraction || a.d.localeCompare(b.d),
  )[0];
}
