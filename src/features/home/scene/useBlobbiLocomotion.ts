import { useCallback, useEffect, useRef, useState } from 'react';
import type { Facing, FloorPoint } from './geometry';
import { arriveAt, beginWalk, standingAt, stepLocomotion, stopWalking, turnTo, DEFAULT_WALK_SPEED, type LocomotionState, type WalkSource } from './locomotion';

export interface WalkOptions {
  source?: WalkSource;
  /** Called once when the Blobbi reaches this destination. Dropped when the walk is replaced. */
  onArrive?: () => void;
}

export interface UseBlobbiLocomotionOptions {
  initialPosition: FloorPoint;
  initialFacing?: Facing;
  speed?: number;
  /** Reduced motion: destinations are reached at once, with no loop. */
  reducedMotion: boolean;
  /** Largest step the loop will take (guards against a tab that was in the background). */
  maxFrameSeconds?: number;
}

export interface BlobbiLocomotion extends LocomotionState {
  /** Walk to a floor point. A user walk replaces anything in progress; an idle walk never interrupts a user walk. */
  walkTo: (destination: FloorPoint, options?: WalkOptions) => boolean;
  /** Turn in place (ignored while walking). */
  turn: (facing: Facing) => void;
  /** Stop where it stands. */
  stop: () => void;
}

/**
 * The one animation loop of the home. Position, destination, facing and
 * motion live here and nowhere else; the renderer only ever sees the result.
 * The loop runs while a walk is in progress and stops on arrival, so an idle
 * Blobbi costs nothing per frame.
 */
export function useBlobbiLocomotion({
  initialPosition,
  initialFacing = 'front',
  speed = DEFAULT_WALK_SPEED,
  reducedMotion,
  maxFrameSeconds = 0.05,
}: UseBlobbiLocomotionOptions): BlobbiLocomotion {
  const [state, setState] = useState<LocomotionState>(() => standingAt(initialPosition, initialFacing));
  const stateRef = useRef(state);
  stateRef.current = state;

  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const onArriveRef = useRef<(() => void) | undefined>(undefined);

  const stopLoop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    lastTimeRef.current = null;
  }, []);

  const tick = useCallback(
    (time: number) => {
      frameRef.current = null;
      const last = lastTimeRef.current ?? time;
      lastTimeRef.current = time;
      const dt = Math.min(maxFrameSeconds, Math.max(0, (time - last) / 1000));
      const { state: next, arrived } = stepLocomotion(stateRef.current, dt, speed);
      if (next !== stateRef.current) {
        stateRef.current = next;
        setState(next);
      }
      if (arrived) {
        stopLoop();
        const onArrive = onArriveRef.current;
        onArriveRef.current = undefined;
        onArrive?.();
        return;
      }
      if (next.motion === 'walking') frameRef.current = requestAnimationFrame(tick);
      else stopLoop();
    },
    [maxFrameSeconds, speed, stopLoop],
  );

  const walkTo = useCallback(
    (destination: FloorPoint, { source = 'user', onArrive }: WalkOptions = {}): boolean => {
      const current = stateRef.current;
      if (reducedMotion) {
        if (source === 'idle' && current.source === 'user') return false;
        const next = arriveAt(current, destination);
        stateRef.current = next;
        setState(next);
        stopLoop();
        onArriveRef.current = undefined;
        onArrive?.();
        return true;
      }
      const next = beginWalk(current, destination, source);
      if (next === current) {
        // Already there, or an idle walk that may not interrupt the user.
        if (current.motion !== 'walking' && source === 'user') onArrive?.();
        return current.motion !== 'walking';
      }
      stateRef.current = next;
      setState(next);
      onArriveRef.current = onArrive;
      if (next.motion === 'walking') {
        lastTimeRef.current = null;
        if (frameRef.current === null) frameRef.current = requestAnimationFrame(tick);
      } else {
        stopLoop();
        onArriveRef.current = undefined;
        onArrive?.();
      }
      return true;
    },
    [reducedMotion, stopLoop, tick],
  );

  const turn = useCallback((facing: Facing) => {
    const next = turnTo(stateRef.current, facing);
    if (next !== stateRef.current) {
      stateRef.current = next;
      setState(next);
    }
  }, []);

  const stop = useCallback(() => {
    const next = stopWalking(stateRef.current);
    onArriveRef.current = undefined;
    stopLoop();
    if (next !== stateRef.current) {
      stateRef.current = next;
      setState(next);
    }
  }, [stopLoop]);

  useEffect(() => stopLoop, [stopLoop]);

  return { ...state, walkTo, turn, stop };
}
