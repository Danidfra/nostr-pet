import { describe, expect, it } from 'vitest';
import { BALL, ballAt, ballRestPoint, ballResting, kickBall, kickDirection, stepBall, type BallState } from './ball-physics';
import { ROOM_GRID } from './room-geometry';

/** Roll a ball on until it rests (or `maxSeconds` pass), in small steps, counting bounces. */
function roll(start: BallState, isFree?: (x: number, z: number) => boolean, maxSeconds = 12) {
  let s = start;
  let bounces = 0;
  let steps = 0;
  const trail: { x: number; z: number; elev: number }[] = [];
  for (let t = 0; t < maxSeconds && !ballResting(s); t += 1 / 60) {
    const step = stepBall(s, 1 / 60, isFree);
    s = step.state;
    if (step.bounced) bounces += 1;
    steps += 1;
    trail.push({ x: s.x, z: s.z, elev: s.elev });
  }
  return { state: s, bounces, steps, trail };
}

describe('a kicked ball', () => {
  it('rolls the way it was kicked, slows with friction and comes to rest well inside the room', () => {
    const { state, bounces, trail } = roll(kickBall(ballAt(2, 2), { x: 1, z: 0 }, 3));
    expect(bounces).toBe(0);
    expect(ballResting(state)).toBe(true);
    expect(state.x).toBeGreaterThan(4);
    expect(state.x).toBeLessThan(ROOM_GRID - BALL.radius);
    expect(state.z).toBeCloseTo(2, 5);
    // The roll is monotonic along x and stops moving
    for (let i = 1; i < trail.length; i++) expect(trail[i].x).toBeGreaterThanOrEqual(trail[i - 1].x - 1e-9);
    expect(state.rolled).toBeGreaterThan(2);
  });

  it('hops a little when struck and lands again, never below the floor', () => {
    const { trail } = roll(kickBall(ballAt(3, 3), { x: 0, z: 1 }, 4));
    expect(Math.max(...trail.map((p) => p.elev))).toBeGreaterThan(0.05);
    for (const p of trail) expect(p.elev).toBeGreaterThanOrEqual(0);
    expect(trail[trail.length - 1].elev).toBe(0);
  });

  it('bounces off the back walls and the open edges, losing speed, and stays on the floor', () => {
    const atWall = roll(kickBall(ballAt(1, 4), { x: -1, z: 0 }, 5));
    expect(atWall.bounces).toBeGreaterThanOrEqual(1);
    expect(atWall.state.x).toBeGreaterThanOrEqual(BALL.radius - 1e-9);
    for (const p of atWall.trail) {
      expect(p.x).toBeGreaterThanOrEqual(BALL.radius - 1e-9);
      expect(p.x).toBeLessThanOrEqual(ROOM_GRID - BALL.radius + 1e-9);
    }
    const atEdge = roll(kickBall(ballAt(7, 4), { x: 1, z: 0 }, 5));
    expect(atEdge.bounces).toBeGreaterThanOrEqual(1);
    for (const p of atEdge.trail) expect(p.x).toBeLessThanOrEqual(ROOM_GRID - BALL.radius + 1e-9);
    // After the bounce it comes back the other way
    expect(atEdge.state.x).toBeLessThan(7);
  });

  it('bounces off furniture: a blocked tile turns it back on the side it tried to cross', () => {
    const blocked = (x: number, z: number) => Math.floor(x) === 5 && Math.floor(z) === 2; // a piece on tile (5, 2)
    const isFree = (x: number, z: number) => !blocked(x, z);
    const { state, bounces, trail } = roll(kickBall(ballAt(2, 2.5), { x: 1, z: 0 }, 5), isFree);
    expect(bounces).toBeGreaterThanOrEqual(1);
    // Its edge never enters the piece's tile
    for (const p of trail) expect(blocked(p.x + BALL.radius, p.z)).toBe(false);
    expect(state.x).toBeLessThan(5 - BALL.radius + 1e-6);
    expect(state.z).toBeCloseTo(2.5, 5);
  });

  it('a kick caps the speed, a bounce that leaves it barely moving ends the roll, and time standing still changes nothing', () => {
    const fast = kickBall(ballAt(4, 4), { x: 1, z: 1 }, 40);
    expect(Math.hypot(fast.vx, fast.vz)).toBeCloseTo(BALL.maxSpeed, 5);
    const still = ballAt(4, 4);
    expect(stepBall(still, 0).state).toBe(still);
    expect(stepBall(still, 1 / 60).state).toMatchObject({ x: 4, z: 4, vx: 0, vz: 0 });
    expect(ballResting(stepBall(still, 1 / 60).state)).toBe(true);
    const creeping: BallState = { ...ballAt(BALL.radius + 0.001, 4), vx: -0.05 };
    expect(stepBall(creeping, 1 / 60).state.vx).toBe(0);
  });

  it('is kicked away from the Blobbi, aimed a little to one side; a ball under its feet goes toward the open corner', () => {
    const away = kickDirection({ x: 5, z: 4 }, { x: 4, z: 4 });
    expect(away.x).toBeCloseTo(1, 5);
    expect(away.z).toBeCloseTo(0, 5);
    const aimed = kickDirection({ x: 5, z: 4 }, { x: 4, z: 4 }, 1);
    expect(aimed.z).toBeGreaterThan(0.3);
    const under = kickDirection({ x: 4, z: 4 }, { x: 4.05, z: 4 });
    expect(under.x).toBeCloseTo(Math.SQRT1_2, 5);
    expect(under.z).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it('says roughly where a roll will end, on the floor', () => {
    const kicked = kickBall(ballAt(2, 2), { x: 1, z: 0 }, 3);
    const guess = ballRestPoint(kicked);
    const { state } = roll(kicked);
    expect(Math.abs(guess.x - state.x)).toBeLessThan(0.6);
    expect(guess.z).toBeCloseTo(2, 5);
    const far = ballRestPoint(kickBall(ballAt(7, 7), { x: 1, z: 1 }, 6));
    expect(far.x).toBeLessThanOrEqual(ROOM_GRID - BALL.radius);
    expect(far.z).toBeLessThanOrEqual(ROOM_GRID - BALL.radius);
  });
});
