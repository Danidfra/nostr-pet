import { describeBlobbiArtwork, type BlobbiFacing } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';

import { toBlobbiVisual } from '@/lib/blobbi-visual';

/**
 * How much of the art box is empty below the body, as a percentage: the
 * renderer's own ground line for this drawing, from the side it is seen.
 * Standing a Blobbi on a floor means shifting its box down by this much.
 */
export function bodyBottomInset(blobbi: BlobbiCompanion, facing: BlobbiFacing): number {
  const visual = toBlobbiVisual(blobbi);
  return (1 - describeBlobbiArtwork({ ...visual, facing }).boxAnchors.groundY) * 100;
}
