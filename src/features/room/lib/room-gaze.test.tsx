/**
 * The eyes have one decider and one pair. `pickGaze` puts a choreographed
 * look first, then (walking) the way it goes, then the pointer, then what it
 * is attending to, then its own glance, and rests the eyes when nothing is
 * wanted. And the room's 2D Blobbi draws exactly one white, one pupil and
 * one moving inner eye per eye, for adult and baby, from the front and the
 * side, at rest and looking, under every expression the room uses.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { pickGaze } from './room-gaze';
import { labBlobbi } from './blobbi3d/identity';
import { RoomBlobbi } from '../components/RoomBlobbi';

const A = { x: 0.5, y: 0 };
const B = { x: -0.5, y: 0.2 };
const C = { x: 0, y: -0.4 };
const D = { x: 0.9, y: 0.9 };

describe('where the eyes go', () => {
  it('a script first, then walking, the pointer, attention, its own glance; nothing wanted rests them', () => {
    expect(pickGaze({ scripted: D, pointer: A, attention: B, glance: C, walking: { facing: 'left' } })).toBe(D);
    expect(pickGaze({ pointer: A, attention: B, glance: C, walking: { facing: 'left' } })?.x).toBeLessThan(0);
    expect(pickGaze({ pointer: A, attention: B, glance: C })).toBe(A);
    expect(pickGaze({ attention: B, glance: C })).toBe(B);
    expect(pickGaze({ glance: C })).toBe(C);
    expect(pickGaze({})).toBeUndefined();
    expect(pickGaze({ walking: { facing: 'back' } })).toBeUndefined();
  });
});

describe('one pair of eyes', () => {
  const EXPRESSIONS = ['neutral', 'happy', 'surprised', 'sad', 'sleepy', { eyes: 'wide', mouth: 'open', brows: 'raised', blush: 'soft' }] as const;
  it.each(['adult', 'baby'] as const)('the %s: one white, one pupil, one moving inner eye per eye, every view and face', (stage) => {
    const blobbi = labBlobbi('d'.repeat(64), '0000000003', 'x', stage);
    for (const facing of ['front', 'left', 'right'] as const) {
      const eyes = facing === 'front' ? 2 : 1;
      for (const expression of EXPRESSIONS) {
        for (const eyeOffset of [undefined, { x: 1, y: 0.4 }]) {
          const { container, unmount } = render(<RoomBlobbi blobbi={blobbi} facing={facing} expression={expression as never} eyeOffset={eyeOffset} />);
          const svgs = container.querySelectorAll('svg');
          expect(svgs).toHaveLength(1);
          expect(container.querySelectorAll('[data-part$="eye-white"]')).toHaveLength(eyes);
          expect(container.querySelectorAll('[data-part$="pupil"]')).toHaveLength(eyes);
          expect(container.querySelectorAll('[data-part$="eye-inner"]')).toHaveLength(eyes);
          // Looking: the moving part is the inner eye (pupil and highlights together), nothing else
          expect(container.querySelectorAll('.blobbi-pupil')).toHaveLength(eyeOffset ? eyes : 0);
          unmount();
        }
      }
    }
  });
});
