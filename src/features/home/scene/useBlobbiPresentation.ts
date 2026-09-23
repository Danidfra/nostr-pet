import { useCallback, useMemo, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { BlobbiCompanion, BlobbiStats } from '@blobbi-kit/core';
import type { CareResult } from '@/features/care';
import { floorDirection, floorPointFromScene, type FloorPoint } from './geometry';
import { travelGlance } from './gaze';
import type { IdleAction } from './idle';
import { BED_SLEEP_SPOT, HOME_SPOT } from './objects';
import { composePresentation, type BlobbiPresentation } from './presentation';
import { POKE_DURATION_MS, baselineExpression, reactionForCare } from './reactions';
import { useHoverCapable, useReducedMotion, useSceneSettings } from './SceneSettings';
import { useBlobbiLocomotion, type WalkOptions } from './useBlobbiLocomotion';
import { useGazePolicy } from './useGazePolicy';
import { useIdleBehavior } from './useIdleBehavior';
import { useReactionPolicy } from './useReactionPolicy';

export interface UseBlobbiPresentationOptions {
  blobbi: BlobbiCompanion;
  stats: BlobbiStats | undefined;
  sceneRef: RefObject<HTMLElement | null>;
  actorRef: RefObject<HTMLElement | null>;
}

export interface ScenePointerHandlers {
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

export interface BlobbiSceneController {
  presentation: BlobbiPresentation;
  /** A user walk: replaces any idle walk and resets the idle clock. */
  walkTo: (destination: FloorPoint, options?: Omit<WalkOptions, 'source'>) => boolean;
  /** A tap or click on the floor, as fractions of the scene box. */
  onFloorTap: (fraction: { x: number; y: number }) => void;
  /** A tap on the Blobbi itself. */
  poke: () => void;
  /** A care result landed: react on the face. */
  reactToCare: (result: CareResult) => void;
  scenePointerHandlers: ScenePointerHandlers;
  /** True while a user-directed walk is in progress. */
  isUserWalking: boolean;
  reducedMotion: boolean;
}

/**
 * The behaviour layer composed: locomotion, gaze, reactions and idle, folded
 * into the one presentation the renderer receives. Every input is local
 * presentation state; nothing here reads or writes Nostr.
 */
export function useBlobbiPresentation({ blobbi, stats, sceneRef, actorRef }: UseBlobbiPresentationOptions): BlobbiSceneController {
  const settings = useSceneSettings();
  const reducedMotion = useReducedMotion();
  const hoverCapable = useHoverCapable();
  const isSleeping = blobbi.state === 'sleeping';

  const locomotion = useBlobbiLocomotion({
    initialPosition: isSleeping ? BED_SLEEP_SPOT : HOME_SPOT,
    reducedMotion,
    speed: settings.walkSpeed,
  });

  const actorKey = `${locomotion.position.x.toFixed(3)}:${locomotion.position.y.toFixed(3)}:${locomotion.facing}`;
  const gaze = useGazePolicy({ actorRef, sceneRef, hoverCapable, actorKey, enabled: !isSleeping });
  const reactions = useReactionPolicy();

  const isUserWalking = locomotion.motion === 'walking' && locomotion.source === 'user';

  const performIdle = useCallback(
    (action: IdleAction) => {
      switch (action.type) {
        case 'glance':
          gaze.glance(action.offset, action.durationMs);
          break;
        case 'turn':
          locomotion.turn(action.facing);
          break;
        case 'walk':
          locomotion.walkTo(action.destination, { source: 'idle' });
          break;
        case 'rest':
          break;
      }
    },
    [gaze, locomotion],
  );

  const idle = useIdleBehavior({
    enabled: settings.idleEnabled && !isSleeping && !isUserWalking,
    timing: settings.idle,
    random: settings.random,
    position: locomotion.position,
    facing: locomotion.facing,
    perform: performIdle,
  });

  const travelGaze = useMemo(
    () => (locomotion.motion === 'walking' && locomotion.destination ? travelGlance(floorDirection(locomotion.position, locomotion.destination)) : undefined),
    [locomotion.motion, locomotion.destination, locomotion.position],
  );

  const presentation = useMemo(
    () =>
      composePresentation({
        position: locomotion.position,
        facing: locomotion.facing,
        motion: locomotion.motion,
        gaze: gaze.eyeOffset,
        travelGaze,
        reaction: reactions.reaction,
        baseline: baselineExpression(blobbi, stats),
        isSleeping,
      }),
    [locomotion.position, locomotion.facing, locomotion.motion, gaze.eyeOffset, travelGaze, reactions.reaction, blobbi, stats, isSleeping],
  );

  const walkTo = useCallback(
    (destination: FloorPoint, options: Omit<WalkOptions, 'source'> = {}) => {
      idle.markActivity();
      return locomotion.walkTo(destination, { ...options, source: 'user' });
    },
    [idle, locomotion],
  );

  const onFloorTap = useCallback(
    (fraction: { x: number; y: number }) => {
      if (isSleeping) return;
      walkTo(floorPointFromScene(fraction));
    },
    [isSleeping, walkTo],
  );

  const poke = useCallback(() => {
    idle.markActivity();
    if (isSleeping) return;
    reactions.react('happy', POKE_DURATION_MS);
  }, [idle, isSleeping, reactions]);

  const reactToCare = useCallback(
    (result: CareResult) => {
      idle.markActivity();
      reactions.react(reactionForCare(result.action, result.nextState));
    },
    [idle, reactions],
  );

  const scenePointerHandlers = useMemo<ScenePointerHandlers>(
    () => ({
      onPointerMove: gaze.onPointerMove,
      onPointerLeave: gaze.onPointerLeave,
      onPointerDown: (event) => {
        idle.markActivity();
        gaze.onPointerDown(event);
      },
    }),
    [gaze, idle],
  );

  return { presentation, walkTo, onFloorTap, poke, reactToCare, scenePointerHandlers, isUserWalking, reducedMotion };
}
