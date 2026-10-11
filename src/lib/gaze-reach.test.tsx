/**
 * How far a Blobbi looks, in both drawings: never so far that a pupil slides
 * off its own white (which read as a second eye), whatever the identity; the
 * kit's full travel wherever that already stays on the white; V1/V2 art and
 * eggs untouched; and the room's and the home's 2D drawings pass the kit no
 * further a look than that.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { buildBlobbiGeometry } from '@blobbi-kit/renderer/procedural';
import { gazeReach, gazeReachOfVisual, limitGaze } from './gaze-reach';
import { toBlobbiVisual } from './blobbi-visual';
import { genomeOf, labBlobbi, morphologyOf } from '@/features/room/lib/blobbi3d/identity';
import { RoomBlobbi } from '@/features/room/components/RoomBlobbi';

const babies = Array.from({ length: 24 }, (_, i) => labBlobbi((i * 7919 + 13).toString(16).padStart(64, 'a'), String(i + 1).padStart(10, '0'), 'x', 'baby'));
const adults = Array.from({ length: 12 }, (_, i) => labBlobbi((i * 104729 + 7).toString(16).padStart(64, 'b'), String(i + 1).padStart(10, '0'), 'x', 'adult'));

describe('how far a Blobbi looks', () => {
  it('keeps every baby\'s and adult\'s pupils on their whites at a full look, every way, using the whole travel where it can', () => {
    let limited = 0;
    for (const blobbi of [...babies, ...adults]) {
      const visual = toBlobbiVisual(blobbi);
      const reach = gazeReachOfVisual(visual);
      expect(reach).toBeGreaterThan(0.5);
      expect(reach).toBeLessThanOrEqual(1);
      if (reach < 1) limited++;
      const stage = blobbi.stage as 'baby' | 'adult';
      const front = buildBlobbiGeometry(morphologyOf(genomeOf(visual)!, stage), { view: 'front' }) as unknown as { face: { eyes: { white: E; iris: E; pupil: E; travel: number }[] } };
      for (const eye of front.face.eyes) {
        const outer = stage === 'adult' ? eye.iris : eye.pupil;
        for (let a = 0; a < 16; a++) {
          const g = limitGaze({ x: 2 * Math.cos((a / 16) * Math.PI * 2), y: 2 * Math.sin((a / 16) * Math.PI * 2) }, reach);
          for (let b = 0; b < 16; b++) {
            const t = (b / 16) * Math.PI * 2;
            const x = outer.cx + g.x * eye.travel + outer.rx * Math.cos(t);
            const y = outer.cy + g.y * eye.travel + outer.ry * Math.sin(t);
            expect(Math.hypot((x - eye.white.cx) / eye.white.rx, (y - eye.white.cy) / eye.white.ry)).toBeLessThanOrEqual(0.98);
          }
        }
      }
    }
    // Some babies' pupils do overhang at the kit's full travel: the limit is doing something
    expect(limited).toBeGreaterThan(0);
  });

  it('is the whole travel when nothing overhangs, and leaves V1/V2 art and eggs alone', () => {
    expect(gazeReach({ cx: 0, cy: 0, rx: 10, ry: 10 }, { cx: 0, cy: 0, rx: 3, ry: 3 }, 2)).toBe(1);
    expect(gazeReach({ cx: 0, cy: 0, rx: 10, ry: 10 }, { cx: 0, cy: 0, rx: 8, ry: 8 }, 4)).toBeCloseTo((9.7 - 8) / 4, 2);
    expect(gazeReachOfVisual(toBlobbiVisual({ ...babies[0], visualGeneration: 'v1' }))).toBe(1);
    expect(limitGaze(undefined, 0.5)).toBeUndefined();
    expect(limitGaze({ x: 0.3, y: 0 }, 1)).toEqual({ x: 0.3, y: 0 });
    const limited = limitGaze({ x: 3, y: 4 }, 0.5);
    expect(limited.x).toBeCloseTo(0.3, 9);
    expect(limited.y).toBeCloseTo(0.4, 9);
  });

  it('the room\'s 2D drawing hands the kit no further a look than the reach', () => {
    const baby = babies.find((b) => gazeReachOfVisual(toBlobbiVisual(b)) < 0.98)!;
    const reach = gazeReachOfVisual(toBlobbiVisual(baby));
    const { container } = render(<RoomBlobbi blobbi={baby} eyeOffset={{ x: 1, y: 0 }} />);
    const holder = container.querySelector('[style*="--blobbi-eye-x"]') as HTMLElement;
    expect(Number(holder.style.getPropertyValue('--blobbi-eye-x'))).toBeCloseTo(reach, 3);
  });
});

type E = { cx: number; cy: number; rx: number; ry: number };
