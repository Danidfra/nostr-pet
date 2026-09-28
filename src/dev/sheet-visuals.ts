import { useMemo } from 'react';
import { VISUAL_GENERATION_TAG, parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';

export type SheetRow = 'baby v1' | 'adult v1' | 'adult v2';
export const SHEET_ROWS: readonly SheetRow[] = ['baby v1', 'adult v1', 'adult v2'];

/**
 * The fixture's own event with only the stage and the generation swapped, so
 * the seed (colours, adult form) is the one on screen, drawn as the three
 * drawings that have a face. Isolated renderer previews: no world, no
 * shadow, no walk, just the artwork under the same inputs.
 */
export function useSheetVisuals(blobbi: BlobbiCompanion) {
  return useMemo(() => {
    const make = (stage: 'baby' | 'adult', generation: 'v1' | 'v2') => {
      const tags = blobbi.event.tags.filter((t) => t[0] !== 'stage' && t[0] !== VISUAL_GENERATION_TAG && t[0] !== 'state');
      tags.push(['stage', stage], ['state', 'active']);
      if (generation === 'v2') tags.push([VISUAL_GENERATION_TAG, 'v2']);
      const parsed = parseModernBlobbiEvent({ ...blobbi.event, tags });
      return parsed ? toBlobbiVisual(parsed) : null;
    };
    return { 'baby v1': make('baby', 'v1'), 'adult v1': make('adult', 'v1'), 'adult v2': make('adult', 'v2') };
  }, [blobbi.event]);
}

