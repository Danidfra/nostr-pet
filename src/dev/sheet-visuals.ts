import { useMemo } from 'react';
import { VISUAL_GENERATION_TAG, parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';

export type SheetRow = 'baby v1' | 'adult v1' | 'adult v2' | 'baby v3' | 'adult v3';
export const SHEET_ROWS: readonly SheetRow[] = ['baby v1', 'adult v1', 'adult v2', 'baby v3', 'adult v3'];

/**
 * The fixture's own event with only the stage and the generation swapped, so
 * the seed (colours, adult form) is the one on screen, drawn as the five
 * drawings that have a face. Isolated renderer previews: no world, no
 * shadow, no walk, just the artwork under the same inputs.
 *
 * Swapping the generation means restating the identity the way that
 * generation states it. A V3 row needs nothing: it is the Blobbi at this
 * address, whatever its other tags say. A V1 or V2 row from a V3 fixture
 * states the Blobbi's seed, which those generations read.
 */
export function useSheetVisuals(blobbi: BlobbiCompanion) {
  return useMemo(() => {
    const own = blobbi.event.tags;
    const fixtureIsV3 = blobbi.visualGeneration === 'v3';
    const make = (stage: 'baby' | 'adult', generation: 'v1' | 'v2' | 'v3') => {
      let tags = own.filter((t) => t[0] !== 'stage' && t[0] !== VISUAL_GENERATION_TAG && t[0] !== 'state');
      if (generation !== 'v3' && fixtureIsV3 && blobbi.seed) tags = [...tags.filter((t) => t[0] !== 'seed'), ['seed', blobbi.seed]];
      tags.push(['stage', stage], ['state', 'active']);
      if (generation !== 'v1') tags.push([VISUAL_GENERATION_TAG, generation]);
      const parsed = parseModernBlobbiEvent({ ...blobbi.event, tags });
      return parsed ? toBlobbiVisual(parsed) : null;
    };
    return { 'baby v1': make('baby', 'v1'), 'adult v1': make('adult', 'v1'), 'adult v2': make('adult', 'v2'), 'baby v3': make('baby', 'v3'), 'adult v3': make('adult', 'v3') };
  }, [blobbi.event, blobbi.seed, blobbi.visualGeneration]);
}
