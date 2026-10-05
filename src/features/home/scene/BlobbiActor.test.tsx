import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import { blobbiEvent } from '@/test/fixtures';
import { describeBlobbiArtwork } from '@blobbi-kit/renderer';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { BlobbiActor } from './BlobbiActor';
import { shadowFor } from './shadow';
import { placeOnFloor } from './geometry';
import type { BlobbiPresentation } from './presentation';

function companion(extra: string[][] = [], stage: 'egg' | 'baby' | 'adult' = 'baby', state: 'active' | 'sleeping' = 'active'): BlobbiCompanion {
  const parsed = parseModernBlobbiEvent(blobbiEvent('0000000042', { name: 'Brook', stage, state, extra }));
  if (!parsed) throw new Error('fixture must be modern');
  return parsed;
}

const standing: BlobbiPresentation = {
  position: { x: 0.3, y: 0.7 },
  facing: 'left',
  motion: 'idle',
  eyeOffset: { x: 0.5, y: -0.25 },
  expression: 'happy',
  isSleeping: false,
  gesture: null,
};

const renderer = () => document.querySelector('[data-blobbi-renderer]') as HTMLElement | null;
const bodyBox = () => document.querySelector('[data-blobbi-body-box]') as HTMLElement | null;

describe('BlobbiActor', () => {
  it('draws through the canonical renderer and hands it the whole presentation', () => {
    render(<BlobbiActor blobbi={companion()} presentation={standing} />);
    const el = renderer();
    expect(el).not.toBeNull();
    expect(el).toHaveAttribute('data-blobbi-generation', 'v1');
    expect(el).toHaveAttribute('data-blobbi-facing', 'left');
    expect(bodyBox()).toHaveAttribute('data-blobbi-motion', 'idle');
    expect(bodyBox()?.style.getPropertyValue('--blobbi-eye-x')).toBe('0.5');
    expect(bodyBox()?.style.getPropertyValue('--blobbi-eye-y')).toBe('-0.25');
    expect(screen.getByRole('img', { name: 'Brook' })).toBeInTheDocument();
  });

  it('stands where the presentation says, anchored by percentages with a depth scale', () => {
    render(<BlobbiActor blobbi={companion()} presentation={standing} />);
    const actor = screen.getByTestId('blobbi-actor');
    const placement = placeOnFloor(standing.position);
    // jsdom normalizes "30.000%" to "30%": compare numerically.
    expect(parseFloat(actor.style.left)).toBeCloseTo(parseFloat(placement.left));
    expect(parseFloat(actor.style.top)).toBeCloseTo(parseFloat(placement.top));
    expect(actor.style.getPropertyValue('--actor-scale')).toBe(String(placement.scale));
    expect(actor).toHaveAttribute('data-facing', 'left');
    expect(actor).toHaveAttribute('data-motion', 'idle');
    expect(actor).toHaveAttribute('data-expression', 'happy');
  });

  it('renders a V2 event as V2 and a V2 face changes with the expression', () => {
    const v2 = companion([['adult_type', 'catti'], ['visual_generation', 'v2']], 'adult');
    const { rerender } = render(<BlobbiActor blobbi={v2} presentation={{ ...standing, facing: 'front', expression: 'neutral' }} />);
    expect(renderer()).toHaveAttribute('data-blobbi-generation', 'v2');
    const neutral = bodyBox()?.innerHTML;
    rerender(<BlobbiActor blobbi={v2} presentation={{ ...standing, facing: 'front', expression: 'excited' }} />);
    expect(bodyBox()?.innerHTML).not.toBe(neutral);
  });

  it('a V1 adult degrades gracefully: expression changes nothing in its markup', () => {
    const adult = companion([['adult_type', 'catti']], 'adult');
    const { rerender } = render(<BlobbiActor blobbi={adult} presentation={{ ...standing, expression: 'neutral' }} />);
    const neutral = bodyBox()?.innerHTML;
    rerender(<BlobbiActor blobbi={adult} presentation={{ ...standing, expression: 'excited' }} />);
    expect(bodyBox()?.innerHTML).toBe(neutral);
    expect(renderer()).not.toHaveAttribute('data-blobbi-expression-support');
  });

  it('renders an event with an invalid visual_generation as V1', () => {
    render(<BlobbiActor blobbi={companion([['visual_generation', 'nope']])} presentation={standing} />);
    expect(renderer()).toHaveAttribute('data-blobbi-generation', 'v1');
  });

  it('sleeping: still, eyes closed, a zzz, and no gaze variables', () => {
    const asleep: BlobbiPresentation = { ...standing, motion: 'still', eyeOffset: undefined, expression: 'neutral', isSleeping: true };
    const { rerender } = render(<BlobbiActor blobbi={companion()} presentation={standing} />);
    const awake = renderer()?.innerHTML;
    rerender(<BlobbiActor blobbi={companion([], 'baby', 'sleeping')} presentation={asleep} />);
    expect(renderer()?.innerHTML).not.toBe(awake);
    expect(bodyBox()).not.toHaveAttribute('data-blobbi-motion');
    expect(bodyBox()?.style.getPropertyValue('--blobbi-eye-x')).toBe('');
    expect(screen.getByTestId('blobbi-actor')).toHaveAttribute('data-sleeping', 'true');
  });

  it('a poke on the Blobbi reaches the host', async () => {
    const onPoke = vi.fn();
    render(<BlobbiActor blobbi={companion()} presentation={standing} onPoke={onPoke} />);
    await userEvent.click(screen.getByRole('img', { name: 'Brook' }));
    expect(onPoke).toHaveBeenCalledTimes(1);
  });

  it('the poke is a real button: focusable, keyboard operable, disabled when there is nothing to poke', async () => {
    const onPoke = vi.fn();
    const { rerender } = render(<BlobbiActor blobbi={companion()} presentation={standing} onPoke={onPoke} />);
    const poke = screen.getByRole('button', { name: 'Poke Brook' });
    poke.focus();
    expect(poke).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onPoke).toHaveBeenCalledTimes(1);
    // The drawing itself carries no click of its own any more.
    expect(screen.getByRole('img', { name: 'Brook' })).not.toHaveAttribute('onclick');
    rerender(<BlobbiActor blobbi={companion()} presentation={standing} />);
    expect(screen.getByRole('button', { name: 'Poke Brook' })).toBeDisabled();
  });
});

describe('one ground shadow, whoever walks', () => {
  const walking: BlobbiPresentation = { ...standing, motion: 'walking', facing: 'right' };
  const v2 = (stage: 'baby' | 'adult' = 'adult', state: 'active' | 'sleeping' = 'active') => parseModernBlobbiEvent(blobbiEvent('0000000042', { name: 'Brook', stage, state, visualGeneration: 'v2' }))!;
  const groundShadows = () => document.querySelectorAll('.scene-actor__shadow').length + document.querySelectorAll('[data-blobbi-body-box] [data-part="ground-shadow"]').length;

  it('the actor names the generation of its Blobbi (from the event, not the drawing), so the shadow can follow the right gait', () => {
    render(<BlobbiActor blobbi={companion()} presentation={walking} />);
    expect(screen.getByTestId('blobbi-actor')).toHaveAttribute('data-generation', 'v1');
    document.body.innerHTML = '';
    render(<BlobbiActor blobbi={v2()} presentation={walking} />);
    expect(screen.getByTestId('blobbi-actor')).toHaveAttribute('data-generation', 'v2');
  });

  it('a walking V2 adult casts exactly one ground shadow, the home\'s: the drawing carries none', () => {
    render(<BlobbiActor blobbi={v2()} presentation={walking} />);
    expect(groundShadows()).toBe(1);
    expect(document.querySelector('.scene-actor__shadow')).not.toBeNull();
    // The creature's own contact shading is the renderer's and stays.
    expect(document.querySelector('[data-blobbi-body-box] [data-part="body-shadow"]')).not.toBeNull();
  });

  it('the V2 walk is the renderer\'s: the leg groups are in its markup, the body box carries the motion, and the home adds no animation of its own', () => {
    render(<BlobbiActor blobbi={v2()} presentation={walking} />);
    expect(bodyBox()).toHaveAttribute('data-blobbi-motion', 'walking');
    expect(document.querySelectorAll('[data-blobbi-body-box] [data-part="near-leg"], [data-blobbi-body-box] [data-part="far-leg"]')).toHaveLength(2);
    expect(renderer()).toHaveAttribute('data-blobbi-generation', 'v2');
    const actor = screen.getByTestId('blobbi-actor');
    expect(actor.querySelector('.scene-actor__box')?.getAttribute('style')).toBeNull();
    expect(actor.querySelectorAll('[style*="animation"]')).toHaveLength(0);
  });

  it('a walking V1 adult and baby keep their drawing and their one shadow; nothing in the markup names a leg', () => {
    for (const blobbi of [companion([['adult_type', 'catti']], 'adult'), companion()]) {
      document.body.innerHTML = '';
      render(<BlobbiActor blobbi={blobbi} presentation={walking} />);
      expect(groundShadows()).toBe(1);
      expect(document.querySelectorAll('[data-blobbi-body-box] [data-part$="-leg"]')).toHaveLength(0);
      expect(bodyBox()).toHaveAttribute('data-blobbi-motion', 'walking');
    }
  });

  it('asleep in the bed, and the egg on its nest: no ground shadow at all, on either generation', () => {
    const asleep: BlobbiPresentation = { ...standing, motion: 'still', isSleeping: true };
    render(<BlobbiActor blobbi={v2('adult', 'sleeping')} presentation={asleep} inBed />);
    expect(groundShadows()).toBe(0);
    document.body.innerHTML = '';
    render(<BlobbiActor blobbi={parseModernBlobbiEvent(blobbiEvent('0000000042', { name: 'Shell', stage: 'egg', visualGeneration: 'v2' }))!} presentation={{ ...standing, motion: 'still' }} inBed eggCrack="none" />);
    expect(groundShadows()).toBe(0);
    expect(screen.getByTestId('blobbi-actor')).toHaveAttribute('data-generation', 'v2');
  });
});

describe('the ground shadow is where the drawing stands', () => {
  const born = (stage: 'egg' | 'baby' | 'adult', generation: 'v1' | 'v2' | 'v3', petId = '0000000042') => parseModernBlobbiEvent(blobbiEvent(petId, { name: 'Brook', stage, visualGeneration: generation }))!;
  const shadow = () => document.querySelector('.scene-actor__shadow') as HTMLElement | null;
  const at = (name: string) => parseFloat(shadow()!.style.getPropertyValue(name));
  const facing = (f: BlobbiPresentation['facing']): BlobbiPresentation => ({ ...standing, facing: f });
  const FACINGS = ['front', 'left', 'right', 'back'] as const;

  it('a V3 adult\'s shadow is under its feet, on its ground line, as wide as what stands there, from every side', () => {
    for (const f of FACINGS) {
      const blobbi = born('adult', 'v3');
      const { unmount } = render(<BlobbiActor blobbi={blobbi} presentation={facing(f)} />);
      const measured = describeBlobbiArtwork({ ...toBlobbiVisual(blobbi), facing: f }).boxAnchors;
      expect(shadow()).toHaveAttribute('data-measured', 'true');
      // Centred under the footprint, vertically centred on the ground line.
      expect(at('--shadow-left')).toBeCloseTo(measured.footprint!.centerX * 100, 1);
      expect(at('--shadow-top') + at('--shadow-height') / 2).toBeCloseTo(measured.groundY * 100, 1);
      expect(at('--shadow-width')).toBeCloseTo(measured.footprint!.width * 100, 1);
      // Under the feet: the ground of this drawing is well above the bottom of its box, where the
      // stylesheet's own shadow sits (its middle is at 98.5%), which is what left a gap under the Blobbi.
      expect(measured.groundY).toBeLessThan(0.92);
      expect(measured.groundY).toBeGreaterThan(0.86);
      expect(Math.abs(at('--shadow-left') - 50)).toBeLessThan(6);
      expect(at('--shadow-width')).toBeGreaterThan(38);
      expect(at('--shadow-width')).toBeLessThan(54);
      // Flat on the floor.
      expect(at('--shadow-height')).toBeLessThan(at('--shadow-width') * 0.25);
      unmount();
    }
  });

  it('a V3 baby\'s shadow is a small one, under a small floating body: narrower than the baby and than any adult\'s', () => {
    const widths = { baby: [] as number[], adult: [] as number[] };
    for (const petId of ['0000000042', '0000000043', '0000000044', '0000000045', '0000000046', '0000000047']) {
      for (const stage of ['baby', 'adult'] as const) {
        for (const f of FACINGS) {
          const blobbi = born(stage, 'v3', petId);
          const { unmount } = render(<BlobbiActor blobbi={blobbi} presentation={facing(f)} />);
          widths[stage].push(at('--shadow-width'));
          if (stage === 'baby') {
            // The baby's body is half its box wide; its shadow is narrower than it, and floats a little below it.
            const body = document.querySelector('[data-blobbi-body-box] svg [data-part="body-base"]');
            expect(body).not.toBeNull();
            expect(at('--shadow-width')).toBeLessThan(42);
            expect(at('--shadow-width')).toBeGreaterThan(24);
            expect(Math.abs(at('--shadow-left') - 50)).toBeLessThan(6);
          }
          unmount();
        }
      }
    }
    expect(Math.max(...widths.baby)).toBeLessThan(Math.min(...widths.adult));
  });

  it('an egg on the floor has its own, and anything in bed has none: the bed is the ground', () => {
    const egg = born('egg', 'v3');
    const { unmount } = render(<BlobbiActor blobbi={egg} presentation={facing('front')} eggCrack="none" />);
    expect(shadow()).toHaveAttribute('data-measured', 'true');
    expect(at('--shadow-width')).toBeGreaterThan(36);
    expect(at('--shadow-width')).toBeLessThan(64);
    expect(at('--shadow-left')).toBeCloseTo(50, 1);
    unmount();
    render(<BlobbiActor blobbi={egg} presentation={facing('front')} eggCrack="none" inBed />);
    expect(shadow()).toBeNull();
  });

  it('V1 and V2 keep the shadow they always had: the stylesheet\'s, with nothing measured put on it', () => {
    for (const generation of ['v1', 'v2'] as const) {
      for (const stage of ['baby', 'adult'] as const) {
        const { unmount } = render(<BlobbiActor blobbi={born(stage, generation)} presentation={facing('front')} />);
        expect(shadow()).not.toBeNull();
        expect(shadow()).not.toHaveAttribute('data-measured');
        expect(shadow()!.getAttribute('style')).toBeNull();
        unmount();
      }
    }
  });

  it('shadowFor turns a footprint into the shadow\'s box, and has nothing to say without one', () => {
    expect(shadowFor({ groundY: 0.9 })).toBeNull();
    expect(shadowFor({ groundY: 0.9, footprint: { centerX: 0.48, width: 0.4 } })).toEqual({ '--shadow-left': '48.00%', '--shadow-top': '86.60%', '--shadow-width': '40.00%', '--shadow-height': '6.80%' });
  });
});
