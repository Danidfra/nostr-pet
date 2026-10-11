/**
 * A Blobbi's own life, the plan: mostly glances, sometimes a short stroll
 * (only when it may walk, never far, never off the floor), a stretch now and
 * then, often nothing; and long, jittered pauses between.
 */
import { describe, expect, it } from 'vitest';
import { ROOM_GRID } from './room-geometry';
import { ROOM_LIFE_TIMING, STROLL_RANGE, nextBeatDelay, planLifeBeat } from './room-life';

const scripted = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('a Blobbi left to itself', () => {
  it('glances most often, its eyes only, for a moment', () => {
    const beat = planLifeBeat(scripted(0.1, 0.9, 0.2, 0.5), { at: { x: 4, z: 4 }, canWalk: true });
    expect(beat.type).toBe('glance');
    if (beat.type !== 'glance') return;
    expect(Math.abs(beat.offset.x)).toBeLessThanOrEqual(0.75);
    expect(Math.abs(beat.offset.y)).toBeLessThanOrEqual(0.4);
    expect(beat.durationMs).toBeGreaterThanOrEqual(1_300);
    expect(beat.durationMs).toBeLessThanOrEqual(2_600);
  });

  it('strolls a short way and stays on the floor; never strolls when it may not walk', () => {
    for (const angle of [0, 0.25, 0.5, 0.75, 0.99]) {
      for (const at of [{ x: 4, z: 4 }, { x: 1, z: 1 }, { x: 7, z: 7 }]) {
        const beat = planLifeBeat(scripted(0.6, angle, 0.5), { at, canWalk: true });
        expect(beat.type).toBe('stroll');
        if (beat.type !== 'stroll') continue;
        expect(beat.x).toBeGreaterThanOrEqual(1);
        expect(beat.x).toBeLessThanOrEqual(ROOM_GRID - 1);
        expect(Math.hypot(beat.x - at.x, beat.z - at.z)).toBeLessThanOrEqual(STROLL_RANGE.max + 1e-6);
      }
    }
    expect(planLifeBeat(scripted(0.6, 0.3, 0.3, 0.3), { at: { x: 4, z: 4 }, canWalk: false }).type).toBe('glance');
  });

  it('stretches now and then, and often does nothing at all', () => {
    expect(planLifeBeat(scripted(0.8), { at: { x: 4, z: 4 }, canWalk: true }).type).toBe('stretch');
    expect(planLifeBeat(scripted(0.95), { at: { x: 4, z: 4 }, canWalk: true }).type).toBe('rest');
  });

  it('waits between half and one and a half intervals', () => {
    expect(nextBeatDelay(() => 0)).toBe(ROOM_LIFE_TIMING.intervalMs * 0.5);
    expect(nextBeatDelay(() => 0.999)).toBeLessThanOrEqual(ROOM_LIFE_TIMING.intervalMs * 1.5);
  });
});
