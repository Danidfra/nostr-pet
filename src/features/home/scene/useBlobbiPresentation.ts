import { useCallback, useMemo, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { BlobbiCompanion, BlobbiStats } from '@blobbi-kit/core';
import { policyFor, resolveBehaviorMode, type BehaviorMode } from './behavior-mode';
import { floorDirection, floorPointFromScene, type FloorPoint } from './geometry';
import { travelGlance } from './gaze';
import type { IdleAction } from './idle';
import { BED_SLEEP_SPOT, HOME_SPOT } from './objects';
import { composePresentation, type BlobbiPresentation } from './presentation';
import { POKE_DURATION_MS, baselineExpression, reactionForCare, type CareReaction } from './reactions';
import { useHoverCapable, useReducedMotion, useSceneSettings } from './SceneSettings';
import { useBlobbiLocomotion, type WalkOutcome } from './useBlobbiLocomotion';
import { useGazePolicy } from './useGazePolicy';
import { useIdleBehavior } from './useIdleBehavior';
import { useReactionPolicy } from './useReactionPolicy';

export interface UseBlobbiPresentationOptions {
  blobbi: BlobbiCompanion;
  stats: BlobbiStats | undefined;
  sceneRef: RefObject<HTMLElement | null>;
  actorRef: RefObject<HTMLElement | null>;
  /** A lifecycle ceremony is building or publishing: the exclusive mode. */
  isInCeremony?: boolean;
}

export interface ScenePointerHandlers {
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

export interface BlobbiSceneController {
  presentation: BlobbiPresentation;
  /** Who is in charge right now (see behavior-mode.ts). */
  mode: BehaviorMode;
  /**
   * A user walk: replaces any idle walk, resets the idle clock, resolves
   * with how the walk ended. Only `'arrived'` means the Blobbi is there.
   */
  walkTo: (destination: FloorPoint) => Promise<WalkOutcome>;
  /** A tap or click on the floor, as fractions of the scene box. */
  onFloorTap: (fraction: { x: number; y: number }) => void;
  /** A tap on the Blobbi itself. */
  poke: () => void;
  /** A care result or an item use landed: react on the face. */
  reactToCare: (result: CareReaction) => void;
  /** A lifecycle moment landed: a bigger, longer face. */
  celebrate: (durationMs?: number) => void;
  /** Whether the user may send it walking right now (an egg or a sleeper cannot walk). */
  canWalk: boolean;
  scenePointerHandlers: ScenePointerHandlers;
  /** True while a user-directed walk is in progress. */
  isUserWalking: boolean;
  reducedMotion: boolean;
}

/**
 * The behaviour layer composed: locomotion, gaze, reactions and idle, folded
 * into the one presentation the renderer receives. Every input is local
 * presentation state; nothing here reads or writes Nostr.
 *
 * The behaviour mode is resolved once per render and every gate below reads
 * its policy, so the precedence lives in `behavior-mode.ts` and not in the
 * conditions scattered here.
 */
export function useBlobbiPresentation({ blobbi, stats, sceneRef, actorRef, isInCeremony = false }: UseBlobbiPresentationOptions): BlobbiSceneController {
  const settings = useSceneSettings();
  const reducedMotion = useReducedMotion();
  const hoverCapable = useHoverCapable();
  const isSleeping = blobbi.state === 'sleeping';

  const locomotion = useBlobbiLocomotion({
    initialPosition: isSleeping ? BED_SLEEP_SPOT : HOME_SPOT,
    reducedMotion,
    speed: settings.walkSpeed,
  });

  const isUserWalking = locomotion.motion === 'walking' && locomotion.source === 'user';
  const mode = resolveBehaviorMode({ isSleeping, isUserWalking, isInCeremony, isEgg: blobbi.stage === 'egg' });
  const policy = policyFor(mode);

  const actorKey = `${locomotion.position.x.toFixed(3)}:${locomotion.position.y.toFixed(3)}:${locomotion.facing}`;
  const gaze = useGazePolicy({ actorRef, sceneRef, hoverCapable, actorKey, enabled: policy.gaze });
  const reactions = useReactionPolicy();

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
          void locomotion.walkTo(action.destination, { source: 'idle' });
          break;
        case 'rest':
          break;
      }
    },
    [gaze, locomotion],
  );

  const idle = useIdleBehavior({
    enabled: settings.idleEnabled && policy.idle,
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
        mode,
        position: locomotion.position,
        facing: locomotion.facing,
        motion: locomotion.motion,
        gaze: gaze.eyeOffset,
        travelGaze,
        reaction: reactions.reaction,
        baseline: baselineExpression(blobbi, stats),
      }),
    [mode, locomotion.position, locomotion.facing, locomotion.motion, gaze.eyeOffset, travelGaze, reactions.reaction, blobbi, stats],
  );

  const walkTo = useCallback(
    (destination: FloorPoint): Promise<WalkOutcome> => {
      idle.markActivity();
      if (!policy.walks.includes('user')) return Promise.resolve('refused');
      return locomotion.walkTo(destination, { source: 'user' });
    },
    [idle, locomotion, policy],
  );

  const onFloorTap = useCallback(
    (fraction: { x: number; y: number }) => {
      if (!policy.floorTaps) return;
      void walkTo(floorPointFromScene(fraction));
    },
    [policy, walkTo],
  );

  const poke = useCallback(() => {
    idle.markActivity();
    if (!policy.reactions) return;
    reactions.react('happy', POKE_DURATION_MS);
  }, [idle, policy, reactions]);

  const reactToCare = useCallback(
    (result: CareReaction) => {
      idle.markActivity();
      reactions.react(reactionForCare(result.action, result.nextState));
    },
    [idle, reactions],
  );

  const celebrate = useCallback(
    (durationMs = 2_400) => {
      idle.markActivity();
      reactions.react('excited', durationMs);
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

  return { presentation, mode, walkTo, onFloorTap, poke, reactToCare, celebrate, canWalk: policy.walks.includes('user'), scenePointerHandlers, isUserWalking, reducedMotion };
}
