/**
 * The room's movement contract for the rest of the app: send the Blobbi
 * somewhere and learn how the walk ended, the way the 2D home's locomotion
 * does (`useBlobbiLocomotion.walkTo`), so a care flow written for one works
 * over the other.
 *
 *   const nav = useRoomNavigation({ blobbi });
 *   <RoomShell {...nav.shellProps} … />
 *   const outcome = await nav.approach(x, z);   // 'arrived' | 'replaced' | 'stopped' | 'refused'
 *   if (outcome === 'arrived') feed();
 *
 * The scene owns the walk (pathfinding, stepping, facing); this hook owns
 * the React side: the control handle the shell hands over once the room is
 * 3D, and the presentation the shell reports (facing, walking or idle),
 * which is state so the Blobbi re-renders when it turns or stops, never per
 * frame. Without a 3D room (no WebGL) nobody walks: `canWalk` is false and
 * a request is `refused`, which is what the home's callers already handle.
 */

import { useCallback, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import type { BlobbiFacing } from '@blobbi-kit/renderer';

import type { WalkOutcome } from '@/features/home/scene/useBlobbiLocomotion';
import type { RoomControl } from '../components/RoomShell';
import type { RoomSceneStatus } from './useRoomScene';
import { MAIN_BLOBBI } from '../lib/room-geometry';

export type RoomMotion = 'idle' | 'walking';

/** What the shell reports about a Blobbi standing in the room. */
export interface RoomActorState {
  facing: BlobbiFacing;
  motion: RoomMotion;
}

export interface RoomNavigation {
  facing: BlobbiFacing;
  motion: RoomMotion;
  /** The room is 3D and this Blobbi may be sent walking (not an egg, not asleep, not decorating). */
  canWalk: boolean;
  /** Walk to the free tile nearest a floor point (tiles). Replaces a walk in progress. */
  walkTo: (x: number, z: number) => Promise<WalkOutcome>;
  /** Walk up to something on the floor and stand by it (`clear`: the thing's size, kept clear of). Replaces a walk in progress. */
  approach: (x: number, z: number, clear?: number) => Promise<WalkOutcome>;
  /** Stop where it stands; a walk in progress resolves `stopped`. */
  stop: () => void;
  /** Hand these to the shell. */
  shellProps: {
    controlRef: MutableRefObject<RoomControl | null>;
    onActorChange: (id: string, state: RoomActorState) => void;
    onStatusChange: (status: RoomSceneStatus) => void;
  };
}

export interface UseRoomNavigationOptions {
  blobbi: Pick<BlobbiCompanion, 'stage' | 'state'>;
  /** The player is decorating: the Blobbi stands and watches. */
  editing?: boolean;
}

const AT_REST: RoomActorState = { facing: 'front', motion: 'idle' };

export function useRoomNavigation({ blobbi, editing = false }: UseRoomNavigationOptions): RoomNavigation {
  const controlRef = useRef<RoomControl | null>(null);
  const [status, setStatus] = useState<RoomSceneStatus>('loading');
  const [actor, setActor] = useState<RoomActorState>(AT_REST);

  const onActorChange = useCallback((id: string, state: RoomActorState) => {
    if (id !== MAIN_BLOBBI) return;
    setActor((prev) => (prev.facing === state.facing && prev.motion === state.motion ? prev : state));
  }, []);

  const walkTo = useCallback((x: number, z: number): Promise<WalkOutcome> => {
    const control = controlRef.current;
    return control ? control.walkTo(x, z) : Promise.resolve('refused');
  }, []);
  const approach = useCallback((x: number, z: number, clear?: number): Promise<WalkOutcome> => {
    const control = controlRef.current;
    return control ? control.approach(x, z, clear) : Promise.resolve('refused');
  }, []);
  const stop = useCallback(() => {
    controlRef.current?.stop();
  }, []);

  const canWalk = status === 'ready' && blobbi.stage !== 'egg' && blobbi.state === 'active' && !editing;
  const shellProps = useMemo(() => ({ controlRef, onActorChange, onStatusChange: setStatus }), [onActorChange]);

  return useMemo(
    () => ({ facing: actor.facing, motion: actor.motion, canWalk, walkTo, approach, stop, shellProps }),
    [actor, canWalk, walkTo, approach, stop, shellProps],
  );
}
