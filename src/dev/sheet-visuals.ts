import { useMemo } from 'react';
import { BLOBBI_V3_TAG_NAMES, VISUAL_GENERATION_TAG, blobbiV3IdentityTags, getTagValue, parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import { createBlobbiV3Identity } from '@blobbi-kit/renderer';
import { toBlobbiVisual } from '@/lib/blobbi-visual';

export type SheetRow = 'baby v1' | 'adult v1' | 'adult v2' | 'baby v3' | 'adult v3';
export const SHEET_ROWS: readonly SheetRow[] = ['baby v1', 'adult v1', 'adult v2', 'baby v3', 'adult v3'];

/**
 * The fixture's own event with only the stage and the generation swapped, so
 * the seed (colours, adult form) is the one on screen, drawn as the five
 * drawings that have a face. Isolated renderer previews: no world, no
 * shadow, no walk, just the artwork under the same inputs.
 *
 * A V3 row needs a V3 identity. If the fixture already is V3 its own tags
 * are kept; otherwise the identity is what the kit's creation rule gives the
 * fixture's seed, written with the kit's own tag builder, exactly as a birth
 * would have written it.
 */
export function useSheetVisuals(blobbi: BlobbiCompanion) {
  return useMemo(() => {
    const make = (stage: 'baby' | 'adult', generation: 'v1' | 'v2' | 'v3') => {
      const own = blobbi.event.tags;
      const tags = own.filter((t) => t[0] !== 'stage' && t[0] !== VISUAL_GENERATION_TAG && t[0] !== 'state' && (generation === 'v3' || !BLOBBI_V3_TAG_NAMES.includes(t[0])));
      tags.push(['stage', stage], ['state', 'active']);
      if (generation !== 'v1') tags.push([VISUAL_GENERATION_TAG, generation]);
      const seed = getTagValue(own, 'seed');
      if (generation === 'v3' && seed && !own.some((t) => BLOBBI_V3_TAG_NAMES.includes(t[0]))) tags.push(...blobbiV3IdentityTags(createBlobbiV3Identity(seed)));
      const parsed = parseModernBlobbiEvent({ ...blobbi.event, tags });
      return parsed ? toBlobbiVisual(parsed) : null;
    };
    return { 'baby v1': make('baby', 'v1'), 'adult v1': make('adult', 'v1'), 'adult v2': make('adult', 'v2'), 'baby v3': make('baby', 'v3'), 'adult v3': make('adult', 'v3') };
  }, [blobbi.event]);
}
