/**
 * A ball rolling on the room's floor, as arithmetic. Not a physics engine:
 * one body, a flat floor, straight walls, square obstacles (the tiles under
 * furniture), friction, and a little hop when it is kicked. Enough for a
 * ball that rolls where it is sent, bounces off what it meets, and comes
 * to rest, so the Blobbi has something to chase.
 *
 * Everything is in tiles and seconds. `stepBall` is pure: it takes a state
 * and gives the next, so a test can roll a ball across the room without a
 * renderer, and the scene integrates it only while it moves (a ball at
 * rest costs nothing per frame).
 */
import { ROOM_GRID } from './room-geometry';

const G = ROOM_GRID;

export const BALL = {
  /** Radius, tiles: a ball an adult Blobbi (about three tiles tall) can plainly kick, a baby can hide behind. */
  radius: 0.36,
  /** Rolling friction: how much speed is lost per second (tiles/s²). */
  friction: 1.35,
  /** How much of its speed a bounce off a wall or a piece of furniture keeps. */
  restitution: 0.58,
  /** Gravity for the hop (tiles/s²), and how much of a fall a bounce keeps. */
  gravity: 16,
  bounce: 0.42,
  /** Below this speed (tiles/s) it is at rest. */
  rest: 0.06,
  /** Fastest it rolls, whatever the kick (tiles/s). */
  maxSpeed: 6.5,
} as const;

export interface BallState {
  x: number;
  z: number;
  /** Height of the bottom above the floor (a hop); 0 on the floor. */
  elev: number;
  vx: number;
  vz: number;
  vy: number;
  /** Rolled so far (tiles), for the rolling rotation. */
  rolled: number;
}

export function ballAt(x: number, z: number, elev = 0): BallState {
  return { x, z, elev, vx: 0, vz: 0, vy: 0, rolled: 0 };
}

export function ballSpeed(s: Pick<BallState, 'vx' | 'vz'>): number {
  return Math.hypot(s.vx, s.vz);
}

/** At rest: on the floor and (as good as) not moving. */
export function ballResting(s: BallState): boolean {
  return s.elev <= 0 && Math.abs(s.vy) < 1e-6 && ballSpeed(s) < BALL.rest;
}

/**
 * A kick: the ball goes off in `dir` (any length; the direction is what
 * counts) at `power` tiles/s, with a little hop so it is plainly struck,
 * not slid.
 */
export function kickBall(s: BallState, dir: { x: number; z: number }, power: number): BallState {
  const len = Math.hypot(dir.x, dir.z);
  if (len < 1e-6 || power <= 0) return s;
  const speed = Math.min(BALL.maxSpeed, power);
  return { ...s, vx: (dir.x / len) * speed, vz: (dir.z / len) * speed, vy: Math.max(s.vy, 0.9 + speed * 0.28) };
}

export interface BallStep {
  state: BallState;
  /** It hit a wall, a piece of furniture or the edge this step. */
  bounced: boolean;
  /** It landed from a hop this step. */
  landed: boolean;
  /** It came to rest this step. */
  rested: boolean;
}

/**
 * The ball `dt` seconds on. Friction slows the roll; the two back walls (x
 * and z below the radius) and the floor's open edges (above `G` less the
 * radius) bounce it; a blocked tile bounces it off whichever side it tried to
 * cross; a hop falls and bounces, smaller each time, until it rolls.
 */
export function stepBall(s: BallState, dt: number, isFree: (x: number, z: number) => boolean = () => true): BallStep {
  if (dt <= 0) return { state: s, bounced: false, landed: false, rested: false };
  const wasResting = ballResting(s);
  let { x, z, elev, vx, vz, vy, rolled } = s;
  let bounced = false;
  let landed = false;

  // The hop
  if (elev > 0 || vy !== 0) {
    vy -= BALL.gravity * dt;
    elev += vy * dt;
    if (elev <= 0) {
      elev = 0;
      if (vy < -0.9) {
        vy = -vy * BALL.bounce;
        landed = true;
      } else vy = 0;
    }
  }

  // The roll: slowed by friction, more when it is on the floor than in the air
  const speed = Math.hypot(vx, vz);
  if (speed > 0) {
    const drag = elev > 0 ? BALL.friction * 0.25 : BALL.friction;
    const next = Math.max(0, speed - drag * dt);
    const k = speed > 1e-9 ? next / speed : 0;
    vx *= k;
    vz *= k;
    rolled += next * dt;
  }

  const r = BALL.radius;
  const lo = r;
  const hi = G - r;
  let nx = x + vx * dt;
  let nz = z + vz * dt;

  // Walls (the back ones) and the floor's open edges
  if (nx < lo) { nx = lo + (lo - nx); vx = Math.abs(vx) * BALL.restitution; bounced = true; }
  else if (nx > hi) { nx = hi - (nx - hi); vx = -Math.abs(vx) * BALL.restitution; bounced = true; }
  if (nz < lo) { nz = lo + (lo - nz); vz = Math.abs(vz) * BALL.restitution; bounced = true; }
  else if (nz > hi) { nz = hi - (nz - hi); vz = -Math.abs(vz) * BALL.restitution; bounced = true; }

  // Furniture: the tile it would roll into, tested by the edge of the ball on the side it moves toward
  const edgeX = nx + Math.sign(vx) * r;
  const edgeZ = nz + Math.sign(vz) * r;
  const blockedX = vx !== 0 && !isFree(edgeX, z);
  const blockedZ = vz !== 0 && !isFree(x, edgeZ);
  if (blockedX) { nx = x; vx = -vx * BALL.restitution; bounced = true; }
  if (blockedZ) { nz = z; vz = -vz * BALL.restitution; bounced = true; }
  if (!blockedX && !blockedZ && (vx !== 0 || vz !== 0) && !isFree(edgeX, edgeZ)) {
    // A corner: it came at the piece diagonally; back off and reverse both
    nx = x; nz = z; vx = -vx * BALL.restitution; vz = -vz * BALL.restitution; bounced = true;
  }
  // A bounce that leaves it barely moving ends the roll
  if (bounced && Math.hypot(vx, vz) < BALL.rest) { vx = 0; vz = 0; }

  x = Math.min(hi, Math.max(lo, nx));
  z = Math.min(hi, Math.max(lo, nz));
  if (elev <= 0 && vy === 0 && Math.hypot(vx, vz) < BALL.rest) { vx = 0; vz = 0; }
  const state = { x, z, elev, vx, vz, vy, rolled };
  return { state, bounced, landed, rested: !wasResting && ballResting(state) };
}

/**
 * Which way to kick a ball lying near a Blobbi so it goes away from it,
 * turned by `aim` (-1..1) a little to one side, so it never goes the same
 * way twice; a ball under its feet is sent toward the room's open corner.
 */
export function kickDirection(ball: { x: number; z: number }, from: { x: number; z: number }, aim = 0): { x: number; z: number } {
  let dx = ball.x - from.x;
  let dz = ball.z - from.z;
  if (Math.hypot(dx, dz) < 0.2) { dx = 1; dz = 1; }
  const angle = Math.atan2(dz, dx) + aim * 0.45;
  return { x: Math.cos(angle), z: Math.sin(angle) };
}

/**
 * Where the ball is heading to rest, roughly, from where it is and how
 * fast it goes (friction alone, no bounces): where the Blobbi should head
 * to meet it. Clamped to the floor.
 */
export function ballRestPoint(s: BallState): { x: number; z: number } {
  const speed = ballSpeed(s);
  if (speed < 1e-6) return { x: s.x, z: s.z };
  const distance = (speed * speed) / (2 * BALL.friction);
  const clamp = (v: number) => Math.min(G - BALL.radius, Math.max(BALL.radius, v));
  return { x: clamp(s.x + (s.vx / speed) * distance), z: clamp(s.z + (s.vz / speed) * distance) };
}
