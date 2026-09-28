import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import { blobbiEvent } from '@/test/fixtures';
import { BlobbiActor } from './BlobbiActor';
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
