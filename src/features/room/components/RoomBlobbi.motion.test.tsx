/**
 * The room tells the canonical renderer when the Blobbi walks, and the
 * renderer draws the gait the artwork has: the V3 adult on its legs, a V3
 * baby with its own hop, V1 and V2 through the kit's wrapper walk. The room
 * adds no bob of its own, restarts nothing per frame, and the eyes follow
 * only where there is a face.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import type { BlobbiFacing, BlobbiMotion } from '@blobbi-kit/renderer';

import { blobbiEvent } from '@/test/fixtures';
import { RoomBlobbi } from './RoomBlobbi';

function blobbi(generation: 'v1' | 'v2' | 'v3', stage: 'egg' | 'baby' | 'adult' = 'adult', state: 'active' | 'sleeping' = 'active'): BlobbiCompanion {
  return parseModernBlobbiEvent(blobbiEvent('00000000a7', { name: 'Umber', stage, state, visualGeneration: generation }))!;
}

function draw(companion: BlobbiCompanion, props: { facing?: BlobbiFacing; motion?: BlobbiMotion; eyeOffset?: { x: number; y: number } } = {}) {
  const { container, rerender } = render(<RoomBlobbi blobbi={companion} {...props} />);
  return {
    container,
    rerender: (next: typeof props) => rerender(<RoomBlobbi blobbi={companion} {...next} />),
    svg: () => container.querySelector<SVGSVGElement>('[data-blobbi-renderer] svg')!,
    box: () => container.querySelector<HTMLElement>('[data-room-blobbi]')!,
  };
}

describe('the room Blobbi walks with the renderer\'s own gait', () => {
  it('a V3 adult walks on its legs when the room says walking, and breathes when it stands', () => {
    const d = draw(blobbi('v3'), { motion: 'walking' });
    expect(d.box()).toHaveAttribute('data-motion', 'walking');
    expect(d.svg()).toHaveAttribute('data-blobbi-gait', 'legs');
    expect(d.svg()).toHaveAttribute('data-blobbi-rig-motion', 'walking');
    expect(d.svg().querySelector('[data-rig="near-leg"], [data-rig="left-leg"]')).not.toBeNull();
    d.rerender({ motion: 'idle' });
    expect(d.box()).toHaveAttribute('data-motion', 'idle');
    expect(d.svg()).toHaveAttribute('data-blobbi-rig-motion', 'idle');
    d.rerender({});
    expect(d.svg()).toHaveAttribute('data-blobbi-rig-motion', 'idle');
  });

  it('a V3 baby keeps its hop: the same walking signal, the kit\'s hop gait', () => {
    const d = draw(blobbi('v3', 'baby'), { motion: 'walking' });
    expect(d.svg()).toHaveAttribute('data-blobbi-gait', 'hop');
    expect(d.svg()).toHaveAttribute('data-blobbi-rig-motion', 'walking');
    expect(d.svg().querySelector('[data-rig="near-leg"], [data-rig="left-leg"]')).toBeNull();
  });

  it('the walk is drawn for the side it faces: side legs in profile, front legs facing or turned away; the same instance throughout', () => {
    const d = draw(blobbi('v3'), { motion: 'walking', facing: 'right' });
    expect(d.svg()).toHaveAttribute('data-blobbi-view', 'side');
    const id = d.container.querySelector('[data-blobbi-renderer]')!.getAttribute('data-blobbi-instance') ?? d.svg().innerHTML.match(/id="([^"]+)"/)?.[1];
    d.rerender({ motion: 'walking', facing: 'back' });
    expect(d.svg()).toHaveAttribute('data-blobbi-view', 'back');
    expect(d.svg()).toHaveAttribute('data-blobbi-rig-motion', 'walking');
    d.rerender({ motion: 'walking', facing: 'left' });
    expect(d.svg()).toHaveAttribute('data-blobbi-view', 'side');
    expect(d.container.querySelector('[data-blobbi-renderer]')).toHaveAttribute('data-blobbi-facing', 'left');
    const idAfter = d.container.querySelector('[data-blobbi-renderer]')!.getAttribute('data-blobbi-instance') ?? d.svg().innerHTML.match(/id="([^"]+)"/)?.[1];
    expect(idAfter).toBe(id);
  });

  it('V1 and V2 walk through the kit\'s wrapper animation: the room adds no transform or animation of its own', () => {
    for (const generation of ['v1', 'v2'] as const) {
      const d = draw(blobbi(generation), { motion: 'walking' });
      const body = d.container.querySelector<HTMLElement>('[data-blobbi-body-box]')!;
      expect(body, generation).toHaveAttribute('data-blobbi-motion', 'walking');
      expect(d.box().style.animation, generation).toBe('');
      expect(d.box().style.transform, generation).toBe('');
      expect(d.box().className, generation).not.toMatch(/animate|bob|sway|hop/);
    }
  });

  it('an egg and a sleeper never walk, whatever the room says', () => {
    const egg = draw(blobbi('v3', 'egg'), { motion: 'walking' });
    expect(egg.box()).toHaveAttribute('data-motion', 'still');
    const asleep = draw(blobbi('v3', 'adult', 'sleeping'), { motion: 'walking' });
    expect(asleep.box()).toHaveAttribute('data-motion', 'still');
  });

  it('the eyes follow an offset on a face, and the back view has no eyes to draw', () => {
    const front = draw(blobbi('v3'), { facing: 'front', eyeOffset: { x: 0.5, y: 0 } });
    const at = (c: HTMLElement) => c.querySelector('[data-blobbi-renderer]')!.outerHTML;
    const centred = draw(blobbi('v3'), { facing: 'front', eyeOffset: { x: 0, y: 0 } });
    expect(at(front.container)).not.toBe(at(centred.container));
    const back = draw(blobbi('v3'), { facing: 'back', eyeOffset: { x: 0.5, y: 0 } });
    expect(back.svg().querySelector('[data-part*="eye"], [data-rig*="eye"]')).toBeNull();
  });
});
