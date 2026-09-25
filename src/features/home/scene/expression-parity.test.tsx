/**
 * One expression prop, every stage. The home hands the same composed
 * `expression` to the renderer whatever the stage; which drawings can show
 * it is the renderer's to say (`data-blobbi-expression-support`), never a
 * stage branch in the home. And one sleep cue: the renderer draws the
 * creature asleep, the home draws the "Zzz", and there is never two, with
 * the renderer installed today or with the next one.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BLOBBI_EMOTIONS, type BlobbiEmotion } from '@blobbi-kit/renderer';
import { parseModernBlobbiEvent, VISUAL_GENERATION_TAG, type BlobbiCompanion } from '@blobbi-kit/core';
import { blobbiEvent } from '@/test/fixtures';
import { BlobbiActor } from './BlobbiActor';
import type { BlobbiPresentation } from './presentation';
import { RENDERER_OWNS_SLEEP_INDICATOR } from '@/lib/renderer-capabilities';

function companion(stage: 'baby' | 'adult', extra: string[][] = [], state: 'active' | 'sleeping' = 'active'): BlobbiCompanion {
  const parsed = parseModernBlobbiEvent(blobbiEvent('0000000042', { name: 'Brook', stage, state, extra }));
  if (!parsed) throw new Error('fixture must be modern');
  return parsed;
}

const BABY = companion('baby');
const ADULT_V1 = companion('adult', [['adult_type', 'catti']]);
const ADULT_V2 = companion('adult', [['adult_type', 'catti'], [VISUAL_GENERATION_TAG, 'v2']]);

const facing = (expression: BlobbiEmotion): BlobbiPresentation => ({ position: { x: 0.5, y: 0.7 }, facing: 'front', motion: 'idle', eyeOffset: undefined, expression, isSleeping: false, gesture: null });
const asleep: BlobbiPresentation = { ...facing('neutral'), motion: 'still', isSleeping: true };

const root = (c: HTMLElement) => c.querySelector('[data-blobbi-renderer]') as HTMLElement;
const svgMarkup = (c: HTMLElement) => c.querySelector('[data-blobbi-body-box] svg')?.outerHTML ?? '';

describe('the same expression prop reaches every stage', () => {
  it.each(BLOBBI_EMOTIONS)('%s: the actor hands it to the renderer for the baby and both adults alike', (emotion) => {
    for (const blobbi of [BABY, ADULT_V1, ADULT_V2]) {
      const { container } = render(<BlobbiActor blobbi={blobbi} presentation={facing(emotion)} />);
      expect(container.querySelector('[data-testid="blobbi-actor"]')).toHaveAttribute('data-expression', emotion);
      // The renderer says whether this drawing can show it; when it can, the
      // face changes; when it cannot, the drawing is the neutral one. Either
      // way the home did not branch on the stage.
      const neutral = svgMarkup(render(<BlobbiActor blobbi={blobbi} presentation={facing('neutral')} />).container);
      const supported = root(container).hasAttribute('data-blobbi-expression-support');
      if (emotion === 'neutral') expect(svgMarkup(container)).toBe(neutral);
      else expect(svgMarkup(container) !== neutral).toBe(supported);
    }
  });

  it('the V2 adult always shows it; the V1 adult never; the baby whenever the installed renderer can', () => {
    const shows = (blobbi: BlobbiCompanion) => svgMarkup(render(<BlobbiActor blobbi={blobbi} presentation={facing('excited')} />).container) !== svgMarkup(render(<BlobbiActor blobbi={blobbi} presentation={facing('neutral')} />).container);
    expect(shows(ADULT_V2)).toBe(true);
    expect(shows(ADULT_V1)).toBe(false);
    const babyRoot = root(render(<BlobbiActor blobbi={BABY} presentation={facing('excited')} />).container);
    expect(shows(BABY)).toBe(babyRoot.hasAttribute('data-blobbi-expression-support'));
  });
});

describe('one sleep cue', () => {
  /** Sleep cues on screen: the home's Zzz, plus one if the drawing bakes its own (several "Z" texts make one cue). */
  const indicators = (c: HTMLElement) => c.querySelectorAll('.scene-actor__zzz').length + ([...c.querySelectorAll('[data-blobbi-body-box] svg text')].some((t) => /^z+$/i.test(t.textContent?.trim() ?? '')) ? 1 : 0);

  it.each([
    ['baby', BABY],
    ['V1 adult', ADULT_V1],
    ['V2 adult', ADULT_V2],
  ])('%s asleep never shows two indicators, and exactly one once the renderer can leave the cue to the home', (_label, blobbi) => {
    const { container } = render(<BlobbiActor blobbi={{ ...blobbi, state: 'sleeping' }} presentation={asleep} inBed />);
    const n = indicators(container);
    expect(n).toBeLessThanOrEqual(1);
    if (!RENDERER_OWNS_SLEEP_INDICATOR) {
      expect(n).toBe(1);
      expect(container.querySelectorAll('.scene-actor__zzz').length).toBe(1);
    }
    // Whoever draws the Zzz, the actor is asleep and the drawing is not the awake one.
    expect(container.querySelector('[data-testid="blobbi-actor"]')).toHaveAttribute('data-sleeping', 'true');
    expect(svgMarkup(container)).not.toBe(svgMarkup(render(<BlobbiActor blobbi={blobbi} presentation={facing('neutral')} />).container));
  });

  it('awake shows none', () => {
    for (const blobbi of [BABY, ADULT_V1, ADULT_V2]) expect(indicators(render(<BlobbiActor blobbi={blobbi} presentation={facing('happy')} />).container)).toBe(0);
  });

  it('the egg on its nest shows no sleep decoration', () => {
    const egg = parseModernBlobbiEvent(blobbiEvent('0000000042', { name: 'Shell', stage: 'egg', state: 'active' }));
    if (!egg) throw new Error('fixture must be modern');
    const { container } = render(<BlobbiActor blobbi={egg} presentation={{ ...facing('neutral'), motion: 'still' }} inBed eggCrack="none" />);
    expect(indicators(container)).toBe(0);
    expect(container.querySelector('[data-testid="blobbi-actor"]')).toHaveAttribute('data-sleeping', 'false');
  });
});
