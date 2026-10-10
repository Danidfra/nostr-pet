/**
 * The room draws the same Blobbi from the side it walks toward, through
 * the canonical renderer: a V3 Blobbi from every side, a V1 Blobbi with its
 * front drawing whatever the facing (the kit has no V1 profile), and nothing
 * about the Blobbi moves for it: not its event, not its identity.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { getBlobbiVisualIdentity, parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import type { BlobbiFacing } from '@blobbi-kit/renderer';

import { blobbiEvent } from '@/test/fixtures';
import { RoomBlobbi } from './RoomBlobbi';
import { bodyBottomInset } from '../lib/body-inset';

function blobbi(generation: 'v1' | 'v2' | 'v3', stage: 'egg' | 'baby' | 'adult' = 'adult', state: 'active' | 'sleeping' = 'active'): BlobbiCompanion {
  return parseModernBlobbiEvent(blobbiEvent('00000000a7', { name: 'Umber', stage, state, visualGeneration: generation }))!;
}

function stage(companion: BlobbiCompanion, facing?: BlobbiFacing) {
  return render(<RoomBlobbi blobbi={companion} facing={facing} />).container;
}
const renderer = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-blobbi-renderer]');
const facingOf = (container: HTMLElement) => renderer(container)?.getAttribute('data-blobbi-facing') ?? null;

describe('the room Blobbi faces where it walks', () => {
  it('is the canonical renderer, told the facing: front by default, each side on request', () => {
    const c = blobbi('v3');
    expect(facingOf(stage(c))).toBe('front');
    for (const facing of ['front', 'left', 'right', 'back'] as const) {
      const container = stage(c, facing);
      expect(facingOf(container)).toBe(facing);
      expect(container.querySelector('[data-room-blobbi]')).toHaveAttribute('data-facing', facing);
    }
    // Left and right are different drawings of the same Blobbi.
    const left = renderer(stage(c, 'left'))!.innerHTML.replace(/room-main-[^"'\s]+/g, 'ID');
    const right = renderer(stage(c, 'right'))!.innerHTML.replace(/room-main-[^"'\s]+/g, 'ID');
    expect(left).not.toBe(right);
  });

  it('a V3 baby and an egg come through the same renderer', () => {
    expect(facingOf(stage(blobbi('v3', 'baby'), 'right'))).toBe('right');
    const egg = stage(blobbi('v3', 'egg'));
    expect(renderer(egg)).not.toBeNull();
    expect(egg.querySelector('.room-name-tag')).toBeNull();
  });

  it('a V1 Blobbi keeps its front drawing for left and right: the kit draws no V1 profile', () => {
    const c = blobbi('v1');
    const svgOf = (facing?: BlobbiFacing) => renderer(stage(c, facing))!.querySelector('svg')!.innerHTML;
    const front = svgOf();
    expect(svgOf('left')).toBe(front);
    expect(svgOf('right')).toBe(front);
  });

  it('stands on the renderer\'s own ground line, and the sleeping cue is the home\'s', () => {
    const c = blobbi('v3');
    const inset = bodyBottomInset(c, 'front');
    expect(inset).toBeGreaterThanOrEqual(0);
    expect(inset).toBeLessThan(50);
    const box = stage(c).querySelector<HTMLElement>('[data-room-blobbi]')!.parentElement!;
    expect(box.style.transform).toContain(`translate(-50%, ${inset}%)`);
    expect(box.style.transform).toContain('var(--anchor-px, 100) * var(--blobbi-tiles, 2) / 200');
    const asleep = stage(blobbi('v3', 'adult', 'sleeping'));
    expect(asleep.querySelector('.room-blobbi__zzz')).not.toBeNull();
    expect(stage(c).querySelector('.room-blobbi__zzz')).toBeNull();
  });

  it('turning changes nothing about the Blobbi: event, tags and identity are untouched', () => {
    const c = blobbi('v3');
    const snapshot = () => JSON.stringify({ event: c.event, tags: c.allTags, identity: getBlobbiVisualIdentity(c), seed: c.seed });
    const before = snapshot();
    for (const facing of ['left', 'right', 'back', 'front'] as const) stage(c, facing);
    expect(snapshot()).toBe(before);
    expect(getBlobbiVisualIdentity(c).v3?.seed).toBe(c.seed);
  });
});
