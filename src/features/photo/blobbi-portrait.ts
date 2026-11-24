/**
 * The Blobbi as it sits for its photo: the kit's own drawing, as a string.
 *
 * The picture is `renderBlobbiSvg` over the same plain visual data every
 * screen draws from (`toBlobbiVisual`), so a Polaroid can never disagree
 * with the home about what a Blobbi looks like: its stage, its generation
 * (V1, V2, V3), its colours and, for a V3, its own identity. What the
 * moment adds is small and stated here:
 *
 *   facing     the front, always: it is looking at the camera
 *   sleeping   eyes shut (and the V1 drawings keep their own "Zzz")
 *   an egg     its shell as cracked as it is now
 *   the face   the one it wears at home (`baselineExpression`: sleepy or
 *              sad when a stat is critical); a Blobbi that is simply fine
 *              smiles for the photo instead of standing neutral
 *   motion     still: a photo is one frame, and a still drawing carries no
 *              stylesheet, so the string is plain shapes and nothing else
 *
 * Nothing here reads a relay or writes anything.
 */
import { describeBlobbiArtwork, renderBlobbiSvg, type BlobbiEggCrack, type BlobbiEmotion, type BlobbiVisual, type RenderBlobbiSvgOptions } from '@blobbi-kit/renderer';
import type { BlobbiCompanion, BlobbiStats } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { baselineExpression } from '@/features/home/scene/reactions';

/** The face a Blobbi with nothing wrong wears for its photo. */
export const PHOTO_SMILE: BlobbiEmotion = 'happy';

/** The SVG id namespace of a portrait: its own, so it never collides with a Blobbi drawn on the page. */
export const PORTRAIT_INSTANCE_ID = 'polaroid';

export interface PortraitInput {
  visual: BlobbiVisual;
  sleeping?: boolean;
  /** The face it wears at home; neutral (or absent) becomes the photo smile. */
  baseline?: BlobbiEmotion;
  eggCrack?: BlobbiEggCrack;
}

/** The options the kit's string API is called with. Pure. */
export function portraitOptions({ visual, sleeping = false, baseline, eggCrack }: PortraitInput): RenderBlobbiSvgOptions {
  const stage = visual.stage === 'egg' || visual.stage === 'adult' ? visual.stage : 'baby';
  const isEgg = stage === 'egg';
  const asleep = sleeping && !isEgg;
  const options: RenderBlobbiSvgOptions = {
    stage,
    visualGeneration: visual.visualGeneration,
    adultType: visual.adultType,
    baseColor: visual.baseColor,
    secondaryColor: visual.secondaryColor,
    eyeColor: visual.eyeColor,
    v3: visual.v3,
    facing: 'front',
    motion: 'still',
    instanceId: PORTRAIT_INSTANCE_ID,
  };
  if (isEgg) {
    if (eggCrack && eggCrack !== 'none') options.eggCrack = eggCrack;
    return options;
  }
  if (asleep) {
    options.eyesClosed = true;
    return options;
  }
  options.expression = !baseline || baseline === 'neutral' ? PHOTO_SMILE : baseline;
  return options;
}

/** What the page knows about the Blobbi right now. */
export interface PortraitMoment {
  stats?: BlobbiStats;
  eggCrack?: BlobbiEggCrack;
}

/** The portrait options for a Blobbi as it is at this moment. */
export function portraitOf(blobbi: BlobbiCompanion, moment: PortraitMoment = {}): RenderBlobbiSvgOptions {
  return portraitOptions({
    visual: toBlobbiVisual(blobbi),
    sleeping: blobbi.state === 'sleeping',
    baseline: baselineExpression(blobbi, moment.stats),
    eggCrack: moment.eggCrack,
  });
}

export interface Portrait {
  /** The finished drawing. */
  svg: string;
  /** Where its ground line and footprint are, as fractions of the square art box (for the shadow under it). */
  ground: { y: number; centerX: number; width: number };
}

/** Draw the portrait. Pure and synchronous: the kit's string API. */
export function renderPortrait(options: RenderBlobbiSvgOptions): Portrait {
  const { svg } = renderBlobbiSvg(options);
  const { boxAnchors } = describeBlobbiArtwork(options);
  const finite = (value: number | undefined, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
  return {
    svg,
    ground: {
      y: Math.min(1, Math.max(0.5, finite(boxAnchors.groundY, 0.92))),
      centerX: finite(boxAnchors.footprint?.centerX ?? boxAnchors.centerX, 0.5),
      width: Math.min(0.9, Math.max(0.25, finite(boxAnchors.footprint?.width, 0.5))),
    },
  };
}
