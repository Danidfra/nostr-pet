/**
 * Locomotion model: a Blobbi standing somewhere on the floor, possibly on its
 * way somewhere else. Pure state and transitions; the hook wraps these in one
 * animation loop. No pathfinding: a walk is a straight line to the
 * destination, at the pace of the Blobbi's gait.
 *
 * FACING HAS ONE RULE:
 *
 *   standing still        front (it faces the viewer)
 *   walking left / right  that profile
 *   walking up the floor  back
 *   walking down it       front
 *   the walk ends         front again, however it ended
 *
 * So a Blobbi is never left standing sideways or with its back turned. The
 * rule lives here, in the state, and not in whoever draws it: every way a
 * walk can end (arrival, a stop, an interruption, reduced motion) goes
 * through `standing`.
 */
import { clampToFloor, facingFromDirection, floorDirection, isAtPoint, type Facing, type FloorPoint } from './geometry';

/** Who asked for the current walk. User walks always win over idle ones. */
export type WalkSource = 'user' | 'idle';

export interface LocomotionState {
  position: FloorPoint;
  destination: FloorPoint | null;
  facing: Facing;
  motion: 'idle' | 'walking';
  source: WalkSource | null;
}

/** Floor units per second, the same in every direction: what a walk uses when it is given no gait (tests, a harness). */
export const DEFAULT_WALK_SPEED = 0.28;

/**
 * How fast a walk goes, in floor units per second: `side` along the floor's
 * width and `depth` along its depth. The two are a gait's own
 * (`motion-contract.ts`): across the room a Blobbi goes as fast as its feet
 * carry it, up and down the floor as fast as reads well. A plain number is
 * the same pace both ways.
 */
export interface WalkPace {
  side: number;
  depth: number;
}

const paceOf = (speed: number | WalkPace): WalkPace => (typeof speed === 'number' ? { side: speed, depth: speed } : speed);

/**
 * How long the straight walk from `a` to `b` takes at a pace, in seconds. A
 * diagonal takes as long as its two components together demand: it is never
 * faster than the slower way.
 */
export function walkSeconds(a: FloorPoint, b: FloorPoint, speed: number | WalkPace): number {
  const pace = paceOf(speed);
  const across = pace.side > 0 ? (b.x - a.x) / pace.side : b.x === a.x ? 0 : Infinity;
  const along = pace.depth > 0 ? (b.y - a.y) / pace.depth : b.y === a.y ? 0 : Infinity;
  return Math.hypot(across, along);
}

/** How a Blobbi that is not walking stands: facing the viewer. */
export const STANDING_FACING: Facing = 'front';

export function standingAt(position: FloorPoint): LocomotionState {
  return { position: clampToFloor(position), destination: null, facing: STANDING_FACING, motion: 'idle', source: null };
}

/**
 * Start walking to `destination`. Returns the same state when nothing
 * changes: the destination is where the Blobbi already stands, or an idle
 * walk tries to interrupt a user walk.
 */
export function beginWalk(state: LocomotionState, destination: FloorPoint, source: WalkSource): LocomotionState {
  if (source === 'idle' && state.source === 'user' && state.motion === 'walking') return state;
  const target = clampToFloor(destination);
  if (isAtPoint(state.position, target)) {
    return state.motion === 'walking' ? { ...state, destination: null, facing: STANDING_FACING, motion: 'idle', source: null } : state;
  }
  return {
    ...state,
    destination: target,
    facing: facingFromDirection(floorDirection(state.position, target), state.facing),
    motion: 'walking',
    source,
  };
}

/** Arrive at once: for reduced motion, or a destination reached in one step. It stands there, facing the viewer. */
export function arriveAt(_state: LocomotionState, destination: FloorPoint): LocomotionState {
  return standingAt(destination);
}

export function stopWalking(state: LocomotionState): LocomotionState {
  if (state.motion !== 'walking') return state;
  return { ...state, destination: null, facing: STANDING_FACING, motion: 'idle', source: null };
}

export interface StepResult {
  state: LocomotionState;
  arrived: boolean;
}

/**
 * Advance a walk by `dtSeconds`. A Blobbi that is not walking is returned
 * unchanged. On arrival it turns to face the viewer.
 */
export function stepLocomotion(state: LocomotionState, dtSeconds: number, speed: number | WalkPace = DEFAULT_WALK_SPEED): StepResult {
  if (state.motion !== 'walking' || !state.destination) return { state, arrived: false };
  const remaining = walkSeconds(state.position, state.destination, speed);
  const dt = Math.max(0, dtSeconds);
  if (dt >= remaining) {
    return { state: { ...state, position: state.destination, destination: null, facing: STANDING_FACING, motion: 'idle', source: null }, arrived: true };
  }
  // The same fraction of the way along both axes: a straight line, at the pace of the walk.
  const t = dt / remaining;
  const position = clampToFloor({ x: state.position.x + (state.destination.x - state.position.x) * t, y: state.position.y + (state.destination.y - state.position.y) * t });
  return { state: { ...state, position }, arrived: false };
}
