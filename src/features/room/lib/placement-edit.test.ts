/** The toolbar's edits, pure: turning, sizing in steps, nudging within the room. */
import { describe, expect, it } from 'vitest';

import { SCALE_STEPS, nextScale, nudged, resized, rotated } from './placement-edit';
import { ROOM_GRID, WALL_HEIGHT } from './room-geometry';
import type { FurniturePlacement } from './room-furniture';

const floor: FurniturePlacement = { id: 'official:table-side', at: 'floor', x: 4, y: 4 };
const wall: FurniturePlacement = { id: 'official:clock-wall', at: 'left', x: 4, y: 3 };

describe('placement edits', () => {
  it('a floor piece turns a quarter at a time and comes round; a wall piece never turns', () => {
    let p = floor;
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      p = rotated(p);
      seen.push(p.rot ?? 0);
    }
    expect(seen).toEqual([1, 2, 3, 0, 1]);
    expect(rotated(wall)).toBe(wall);
  });

  it('sizes step through the fixed steps, stop at the ends, and store 1 as absent', () => {
    expect(nextScale(undefined, 1)).toBe(1.25);
    expect(nextScale(1.25, -1)).toBe(1);
    expect(nextScale(2, 1)).toBe(2);
    expect(nextScale(0.5, -1)).toBe(0.5);
    expect(nextScale(1.1, 1)).toBe(1.25); // the nearest step first
    expect(resized(floor, 1)).toEqual({ ...floor, scale: 1.25 });
    expect(resized({ ...floor, scale: 1.25 }, -1)).toEqual(floor);
    expect(resized({ ...floor, scale: 1.25 }, -1)).not.toHaveProperty('scale');
    expect(SCALE_STEPS).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2]);
  });

  it('nudges a tile on the floor and half a tile on a wall, the left wall the other way, clamped to the room', () => {
    expect(nudged(floor, 1, 0)).toEqual({ ...floor, x: 5 });
    expect(nudged(floor, 0, 1)).toEqual({ ...floor, y: 5 });
    expect(nudged({ ...floor, x: ROOM_GRID }, 1, 0).x).toBe(ROOM_GRID);
    expect(nudged({ ...floor, y: 0 }, 0, -1).y).toBe(0);
    expect(nudged(wall, 1, 0)).toEqual({ ...wall, x: 3.5 });
    expect(nudged({ ...wall, at: 'right' }, 1, 0)).toEqual({ ...wall, at: 'right', x: 4.5 });
    expect(nudged(wall, 0, -1)).toEqual({ ...wall, y: 3.5 });
    expect(nudged({ ...wall, y: WALL_HEIGHT }, 0, -1).y).toBe(WALL_HEIGHT);
  });
});
