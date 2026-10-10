/**
 * The path sampler reads exactly the path data the kit's geometry emits:
 * absolute M, L, C, Q, A and Z, nothing else.
 */
import { describe, expect, it } from 'vitest';
import { boundsOf, samplePath } from './svg-path';

describe('samplePath', () => {
  it('reads lines and closes a subpath', () => {
    const [square] = samplePath('M 0,0 L 10,0 L 10,10 L 0,10 Z');
    expect(square.closed).toBe(true);
    expect(square.points).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
    expect(boundsOf(square.points)).toEqual({ x1: 0, y1: 0, x2: 10, y2: 10 });
  });

  it('samples cubic and quadratic curves through their end points', () => {
    const [brow] = samplePath('M 264.966,329.725 Q 304.694,303.588 344.422,330.771', 4);
    expect(brow.closed).toBe(false);
    expect(brow.points).toHaveLength(5);
    expect(brow.points[0]).toEqual({ x: 264.966, y: 329.725 });
    expect(brow.points[4].x).toBeCloseTo(344.422);
    expect(brow.points[2].y).toBeLessThan(329); // the arch rises between its ends
    const [mouth] = samplePath('M 371.563,498 C 387.319,526.887 438.189,527.357 453.546,498', 10);
    expect(mouth.points).toHaveLength(11);
    expect(mouth.points[10].x).toBeCloseTo(453.546);
    expect(Math.max(...mouth.points.map((p) => p.y))).toBeGreaterThan(515);
  });

  it('samples an elliptical arc along the circle it lies on', () => {
    // A half circle of radius 1 from (1,0) over the top to (-1,0)
    const [half] = samplePath('M 1,0 A 1 1 0 0 0 -1,0', 8);
    expect(half.points).toHaveLength(9);
    for (const p of half.points) expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 5);
    expect(half.points[8]).toEqual({ x: -1, y: 0 });
    // The kit's crescent: one closed subpath of two arcs
    const [moon] = samplePath('M 0.66,-0.751 A 1 1 0 1 0 0.66,0.751 A 0.78 0.78 0 1 1 0.66,-0.751 Z', 8);
    expect(moon.closed).toBe(true);
    expect(moon.points).toHaveLength(17);
  });

  it('splits subpaths and refuses what the kit never writes', () => {
    const polys = samplePath('M 0,0 L 1,0 M 5,5 L 6,5 Z');
    expect(polys).toHaveLength(2);
    expect(polys[0].closed).toBe(false);
    expect(polys[1].closed).toBe(true);
    expect(() => samplePath('M 0,0 H 5')).toThrow(/Unsupported/);
  });
});
