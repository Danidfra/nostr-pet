import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FloorPoint } from './geometry';
import { arriveAt, beginWalk, standingAt, stepLocomotion, stopWalking, DEFAULT_WALK_SPEED, type LocomotionState, type WalkPace, type WalkSource } from './locomotion';

/**
 * How a walk ended. `arrived` is the only outcome after which an action
 * that was waiting for the walk may run. `replaced` means another walk took
 * over (a tap elsewhere, or a user walk over an idle one); `stopped` means
 * `stop()` or unmount; `refused` means the request was not accepted at all
 * (an idle walk during a user walk).
 */
export type WalkOutcome = 'arrived' | 'replaced' | 'stopped' | 'refused';

export interface WalkOptions {
  source?: WalkSource;
}

export interface UseBlobbiLocomotionOptions {
  initialPosition: FloorPoint;
  /**
   * The pace of a walk: one number (floor units per second, every way), or
   * the pace where it stands (a gait: its stride covers less floor at the
   * back of the room, where it is drawn smaller). Read live, so a Blobbi
   * that changes gait (it hatched, it evolved) walks at its new pace.
   */
  speed?: number | ((position: FloorPoint) => WalkPace);
  /** Reduced motion: destinations are reached at once, with no loop. */
  reducedMotion: boolean;
  /** Largest step the loop will take (guards against a tab that was in the background). */
  maxFrameSeconds?: number;
}

export interface BlobbiLocomotion extends LocomotionState {
  /**
   * Walk to a floor point. Resolves when the walk ends, with how it ended.
   * A user walk replaces anything in progress (the replaced walk resolves
   * `replaced`); an idle walk never interrupts a user walk (`refused`).
   * Never rejects: a walk that ends is not an error.
   */
  walkTo: (destination: FloorPoint, options?: WalkOptions) => Promise<WalkOutcome>;
  /** Stop where it stands; a pending walk resolves `stopped`. */
  stop: () => void;
  /**
   * Put the Blobbi somewhere at once, no walk: coming into another room.
   * A pending walk resolves `stopped`. The new position is committed to the
   * live ref immediately, so a walk started in the same tick begins there.
   * It stands there facing the viewer, as anything that is not walking does.
   */
  placeAt: (position: FloorPoint) => void;
}

type Settle = (outcome: WalkOutcome) => void;

/**
 * The one animation loop of the home. Position, destination, facing and
 * motion live here and nowhere else; the renderer only ever sees the result.
 * The loop runs while a walk is in progress and stops on arrival, so an idle
 * Blobbi costs nothing per frame.
 *
 * A walk is a promise, not a callback: whoever wants to act on arrival
 * awaits it and then decides with LIVE state, instead of handing over a
 * closure that would remember the state of the moment the walk began.
 */
export function useBlobbiLocomotion({
  initialPosition,
  speed = DEFAULT_WALK_SPEED,
  reducedMotion,
  maxFrameSeconds = 0.05,
}: UseBlobbiLocomotionOptions): BlobbiLocomotion {
  const [state, setState] = useState<LocomotionState>(() => standingAt(initialPosition));
  const stateRef = useRef(state);
  stateRef.current = state;

  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  /** The settle function of the walk in progress, if any. Exactly one walk can be pending. */
  const pendingRef = useRef<Settle | null>(null);

  const settle = useCallback((outcome: WalkOutcome) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    pending?.(outcome);
  }, []);

  const stopLoop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    lastTimeRef.current = null;
  }, []);

  const commit = useCallback((next: LocomotionState) => {
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const tick = useCallback(
    (time: number) => {
      frameRef.current = null;
      const last = lastTimeRef.current ?? time;
      lastTimeRef.current = time;
      const dt = Math.min(maxFrameSeconds, Math.max(0, (time - last) / 1000));
      const { state: next, arrived } = stepLocomotion(stateRef.current, dt, typeof speed === 'function' ? speed(stateRef.current.position) : speed);
      commit(next);
      if (arrived) {
        stopLoop();
        settle('arrived');
        return;
      }
      if (next.motion === 'walking') frameRef.current = requestAnimationFrame(tick);
      else stopLoop();
    },
    [maxFrameSeconds, speed, stopLoop, commit, settle],
  );

  const walkTo = useCallback(
    (destination: FloorPoint, { source = 'user' }: WalkOptions = {}): Promise<WalkOutcome> => {
      const current = stateRef.current;

      if (reducedMotion) {
        if (source === 'idle' && current.source === 'user' && current.motion === 'walking') return Promise.resolve('refused');
        settle('replaced');
        stopLoop();
        commit(arriveAt(current, destination));
        return Promise.resolve('arrived');
      }

      const next = beginWalk(current, destination, source);
      if (next === current) {
        // Already there (resolve at once), or an idle walk that may not interrupt the user.
        return Promise.resolve(current.motion === 'walking' ? 'refused' : 'arrived');
      }

      settle('replaced');
      commit(next);
      if (next.motion !== 'walking') {
        // beginWalk stopped a walk that was heading elsewhere because the tap landed under the Blobbi.
        stopLoop();
        return Promise.resolve('arrived');
      }
      return new Promise<WalkOutcome>((resolve) => {
        pendingRef.current = resolve;
        lastTimeRef.current = null;
        if (frameRef.current === null) frameRef.current = requestAnimationFrame(tick);
      });
    },
    [reducedMotion, settle, stopLoop, commit, tick],
  );

  const stop = useCallback(() => {
    stopLoop();
    settle('stopped');
    commit(stopWalking(stateRef.current));
  }, [stopLoop, settle, commit]);

  const placeAt = useCallback(
    (position: FloorPoint) => {
      stopLoop();
      settle('stopped');
      commit(standingAt(position));
    },
    [stopLoop, settle, commit],
  );

  useEffect(
    () => () => {
      stopLoop();
      settle('stopped');
    },
    [stopLoop, settle],
  );

  return useMemo(() => ({ ...state, walkTo, stop, placeAt }), [state, walkTo, stop, placeAt]);
}
