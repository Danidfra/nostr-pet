import { getBlobbiVisualIdentity, type BlobbiVisualIdentitySource } from '@blobbi-kit/core';
import type { BlobbiVisual } from '@blobbi-kit/renderer';

/**
 * The renderer's plain visual input for a parsed Blobbi.
 *
 * The projection itself is the kit's `getBlobbiVisualIdentity`, the same one
 * Ditto and Blobbi Island render from, so the standalone can never disagree
 * with them about what a Blobbi looks like. Persistent visual identity rides
 * along untouched: `visual_generation` missing or invalid resolves to `v1`,
 * `v1` stays `v1`, `v2` stays `v2`, all decided in core.
 *
 * This function adds nothing; it only names the seam where domain data meets
 * the renderer so it can be pinned by tests.
 */
export function toBlobbiVisual(source: BlobbiVisualIdentitySource): BlobbiVisual {
  const identity = getBlobbiVisualIdentity(source);
  return {
    stage: identity.stage,
    visualGeneration: identity.visualGeneration,
    adultType: identity.adultType,
    baseColor: identity.baseColor,
    secondaryColor: identity.secondaryColor,
    eyeColor: identity.eyeColor,
    pattern: identity.pattern,
    specialMark: identity.specialMark,
    name: identity.name,
  };
}
