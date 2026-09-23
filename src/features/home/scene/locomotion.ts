/**
 * Locomotion model: a Blobbi standing somewhere on the floor, possibly on its
 * way somewhere else. Pure state and transitions; the hook wraps these in one
 * animation loop. No pathfinding: a walk is a straight line to the
 * destination at a constant screen-weighted speed.
 */
import { clampToFloor, facingFromDirection, floorDirection, floorDistance, isAtPoint, type Facing, type FloorPoint } from './geometry';

/** Who asked for the current walk. User walks always win over idle ones. */
export type WalkSource = 'user' | 'idle';

export interface LocomotionState {
  position: FloorPoint;
  destination: FloorPoint | null;
  facing: Facing;
  motion: 'idle' | 'walking';
  source: WalkSource | null;
}

/** Floor units per second in screen-weighted space; crosses the floor in about three seconds. */
export const DEFAULT_WALK_SPEED = 0.28;

export function standingAt(position: FloorPoint, facing: Facing = 'front'): LocomotionState {
  return { position: clampToFloor(position), destination: null, facing, motion: 'idle', source: null };
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
    return state.motion === 'walking' ? { ...state, destination: null, motion: 'idle', source: null } : state;
  }
  return {
    ...state,
    destination: target,
    facing: facingFromDirection(floorDirection(state.position, target), state.facing),
    motion: 'walking',
    source,
  };
}

/** Arrive at once: for reduced motion, or a destination reached in one step. */
export function arriveAt(state: LocomotionState, destination: FloorPoint): LocomotionState {
  const target = clampToFloor(destination);
  const facing = facingFromDirection(floorDirection(state.position, target), state.facing);
  return { position: target, destination: null, facing, motion: 'idle', source: null };
}

export function stopWalking(state: LocomotionState): LocomotionState {
  if (state.motion !== 'walking') return state;
  return { ...state, destination: null, motion: 'idle', source: null };
}

export interface StepResult {
  state: LocomotionState;
  arrived: boolean;
}

/**
 * Advance a walk by `dtSeconds`. A Blobbi that is not walking is returned
 * unchanged. Arrival keeps the facing it arrived with; nothing turns it to
 * the front.
 */
export function stepLocomotion(state: LocomotionState, dtSeconds: number, speed: number = DEFAULT_WALK_SPEED): StepResult {
  if (state.motion !== 'walking' || !state.destination) return { state, arrived: false };
  const remaining = floorDistance(state.position, state.destination);
  const travel = Math.max(0, dtSeconds) * speed;
  if (travel >= remaining) {
    return { state: { ...state, position: state.destination, destination: null, motion: 'idle', source: null }, arrived: true };
  }
  const dir = floorDirection(state.position, state.destination);
  const position = clampToFloor({ x: state.position.x + dir.x * travel, y: state.position.y + dir.y * travel });
  return { state: { ...state, position }, arrived: false };
}

/** Turn in place without moving. */
export function turnTo(state: LocomotionState, facing: Facing): LocomotionState {
  if (state.motion === 'walking' || state.facing === facing) return state;
  return { ...state, facing };
}
