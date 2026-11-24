import { describe, expect, it } from 'vitest';
import { parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import { renderBlobbiSvg } from '@blobbi-kit/renderer';
import { blobbiEvent, type BlobbiFixtureOptions } from '@/test/fixtures';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { PHOTO_SMILE, PORTRAIT_INSTANCE_ID, portraitOf, portraitOptions, renderPortrait } from './blobbi-portrait';

function companion(options: BlobbiFixtureOptions): BlobbiCompanion {
  const parsed = parseModernBlobbiEvent(blobbiEvent('00000000f0', options));
  if (!parsed) throw new Error('the fixture did not parse');
  return parsed;
}

const HEALTHY = { hunger: 90, happiness: 90, hygiene: 90, energy: 90, health: 90 };

describe('the portrait options', () => {
  it('carry the Blobbi’s own identity, exactly as every screen draws it', () => {
    for (const visualGeneration of ['v1', 'v2', 'v3'] as const) {
      for (const stage of ['egg', 'baby', 'adult'] as const) {
        const blobbi = companion({ stage, visualGeneration });
        const visual = toBlobbiVisual(blobbi);
        const options = portraitOf(blobbi);
        expect(options.stage).toBe(stage);
        expect(options.visualGeneration).toBe(visualGeneration);
        expect(options.baseColor).toBe(visual.baseColor);
        expect(options.secondaryColor).toBe(visual.secondaryColor);
        expect(options.eyeColor).toBe(visual.eyeColor);
        expect(options.adultType).toBe(visual.adultType);
        expect(options.v3).toEqual(visual.v3);
      }
    }
  });

  it('always face the camera, still, in an id space of their own', () => {
    const options = portraitOf(companion({ stage: 'adult' }));
    expect(options.facing).toBe('front');
    expect(options.motion).toBe('still');
    expect(options.instanceId).toBe(PORTRAIT_INSTANCE_ID);
  });

  it('a Blobbi that is fine smiles for the photo', () => {
    const options = portraitOf(companion({ stage: 'baby' }), { stats: HEALTHY });
    expect(options.expression).toBe(PHOTO_SMILE);
    expect(options.eyesClosed).toBeUndefined();
  });

  it('a Blobbi in need keeps the face it wears at home', () => {
    expect(portraitOf(companion({ stage: 'adult' }), { stats: { ...HEALTHY, hunger: 1 } }).expression).toBe('sad');
    expect(portraitOf(companion({ stage: 'adult' }), { stats: { ...HEALTHY, energy: 1 } }).expression).toBe('sleepy');
    expect(portraitOptions({ visual: { stage: 'adult' }, baseline: 'sad' }).expression).toBe('sad');
    expect(portraitOptions({ visual: { stage: 'adult' }, baseline: 'neutral' }).expression).toBe(PHOTO_SMILE);
  });

  it('a sleeper has its eyes shut and no posed face', () => {
    const options = portraitOf(companion({ stage: 'adult', state: 'sleeping' }), { stats: HEALTHY });
    expect(options.eyesClosed).toBe(true);
    expect(options.expression).toBeUndefined();
  });

  it('an egg has no face and no sleep, and shows its shell as cracked as it is', () => {
    const whole = portraitOf(companion({ stage: 'egg' }));
    expect(whole.expression).toBeUndefined();
    expect(whole.eyesClosed).toBeUndefined();
    expect(whole.eggCrack).toBeUndefined();
    expect(portraitOf(companion({ stage: 'egg' }), { eggCrack: 'medium' }).eggCrack).toBe('medium');
    expect(portraitOptions({ visual: { stage: 'egg' }, sleeping: true }).eyesClosed).toBeUndefined();
    // A crack is the egg's alone
    expect(portraitOf(companion({ stage: 'baby' }), { eggCrack: 'heavy' }).eggCrack).toBeUndefined();
  });

  it('an unknown stage is drawn as the kit draws it: a baby', () => {
    expect(portraitOptions({ visual: {} }).stage).toBe('baby');
  });
});

describe('the portrait drawn', () => {
  const cases = (['v1', 'v2', 'v3'] as const).flatMap((visualGeneration) => (['egg', 'baby', 'adult'] as const).map((stage) => ({ stage, visualGeneration })));

  it.each(cases)('$stage $visualGeneration is the kit’s own drawing, and nothing a canvas cannot take', ({ stage, visualGeneration }) => {
    const options = portraitOf(companion({ stage, visualGeneration }), { stats: HEALTHY });
    const { svg, ground } = renderPortrait(options);
    expect(svg).toBe(renderBlobbiSvg(options).svg);
    expect(svg).toContain('<svg');
    // Self-contained: no stylesheet, no outside image, nothing that taints or needs the page's CSS
    expect(svg).not.toMatch(/<style|<image|foreignObject|<script|href=["']https?:|url\(["']?https?:|var\(--/i);
    expect(ground.y).toBeGreaterThanOrEqual(0.5);
    expect(ground.y).toBeLessThanOrEqual(1);
    expect(ground.centerX).toBeGreaterThan(0.2);
    expect(ground.centerX).toBeLessThan(0.8);
    expect(ground.width).toBeGreaterThan(0);
    expect(ground.width).toBeLessThanOrEqual(0.9);
  });

  it('sleeping changes the drawing; so does a cracked shell', () => {
    const awake = renderPortrait(portraitOf(companion({ stage: 'adult', visualGeneration: 'v3' }), { stats: HEALTHY })).svg;
    const asleep = renderPortrait(portraitOf(companion({ stage: 'adult', visualGeneration: 'v3', state: 'sleeping' }), { stats: HEALTHY })).svg;
    expect(asleep).not.toBe(awake);
    const whole = renderPortrait(portraitOf(companion({ stage: 'egg' }))).svg;
    const cracked = renderPortrait(portraitOf(companion({ stage: 'egg' }), { eggCrack: 'heavy' })).svg;
    expect(cracked).not.toBe(whole);
  });

  it('is the same picture every time', () => {
    const options = portraitOf(companion({ stage: 'adult', visualGeneration: 'v3' }), { stats: HEALTHY });
    expect(renderPortrait(options).svg).toBe(renderPortrait(options).svg);
  });
});
