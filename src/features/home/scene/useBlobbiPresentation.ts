import { useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { BlobbiCompanion, BlobbiStats } from '@blobbi-kit/core';
import type { BlobbiEmotion } from '@blobbi-kit/renderer';
import { policyFor, resolveBehaviorMode, type BehaviorMode } from './behavior-mode';
import { floorDirection, floorPointFromScene, type FloorPoint } from './geometry';
import { travelGlance } from './gaze';
import type { IdleAction } from './idle';
import { HOME_SPOT } from './objects';
import { composePresentation, type BlobbiPresentation } from './presentation';
import { baselineExpression, reactionForCare, type CareReaction } from './reactions';
import { POKE_PATIENCE, pokeReaction, type PokeReaction } from '../personality';
import type { EyeOffset } from './gaze';
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
  /** Where the Blobbi stands at first (the room's entry, or the bed for a sleeper). */
  initialPosition?: FloorPoint;
  /** The player is decorating: the Blobbi stands still and watches. */
  isEditing?: boolean;
  /** Pin the baseline face (a dev preview); null or absent means the condition decides. */
  baselineOverride?: BlobbiEmotion | null;
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
  /**
   * A tap on the Blobbi itself. The reaction is the personality's
   * (`pokeReaction`: stage, state, condition, how often lately); the mode
   * decides how much of it shows (a face, a gesture, both, nothing). Never a
   * write.
   */
  poke: () => PokeReaction;
  /** Look somewhere for a moment (an item in hand, a toy set down). */
  lookAt: (offset: EyeOffset, durationMs?: number) => void;
  /** A care result or an item use landed: react on the face. */
  reactToCare: (result: CareReaction) => void;
  /** A lifecycle moment landed: a bigger, longer face. */
  celebrate: (durationMs?: number) => void;
  /** Whether the user may send it walking right now (an egg or a sleeper cannot walk). */
  canWalk: boolean;
  /** Put it somewhere at once (coming into another room); any walk in progress ends `stopped`. */
  placeAt: (position: FloorPoint) => void;
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
export function useBlobbiPresentation({ blobbi, stats, sceneRef, actorRef, isInCeremony = false, initialPosition, isEditing = false, baselineOverride = null }: UseBlobbiPresentationOptions): BlobbiSceneController {
  const settings = useSceneSettings();
  const reducedMotion = useReducedMotion();
  const hoverCapable = useHoverCapable();
  const isSleeping = blobbi.state === 'sleeping';

  const locomotion = useBlobbiLocomotion({
    initialPosition: initialPosition ?? HOME_SPOT,
    reducedMotion,
    speed: settings.walkSpeed,
  });

  const isUserWalking = locomotion.motion === 'walking' && locomotion.source === 'user';
  const mode = resolveBehaviorMode({ isSleeping, isUserWalking, isInCeremony, isEgg: blobbi.stage === 'egg', isEditing });
  const policy = policyFor(mode);
  // The callbacks below are handed to memoized parts of the home and to
  // effects; they read the current policy through a ref so their identity
  // does not change with every step of a walk.
  const policyRef = useRef(policy);
  policyRef.current = policy;

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
        baseline: baselineOverride ?? baselineExpression(blobbi, stats),
        gesture: reactions.gesture,
      }),
    [mode, locomotion.position, locomotion.facing, locomotion.motion, gaze.eyeOffset, travelGaze, reactions.reaction, reactions.gesture, blobbi, stats, baselineOverride],
  );

  const markActivity = idle.markActivity;
  const locomotionWalkTo = locomotion.walkTo;
  const walkTo = useCallback(
    (destination: FloorPoint): Promise<WalkOutcome> => {
      markActivity();
      if (!policyRef.current.walks.includes('user')) return Promise.resolve('refused');
      return locomotionWalkTo(destination, { source: 'user' });
    },
    [markActivity, locomotionWalkTo],
  );

  const onFloorTap = useCallback(
    (fraction: { x: number; y: number }) => {
      if (!policyRef.current.floorTaps) return;
      void walkTo(floorPointFromScene(fraction));
    },
    [walkTo],
  );

  const react = reactions.react;
  const gesticulate = reactions.gesticulate;
  const glance = gaze.glance;
  const pokesRef = useRef<number[]>([]);
  const pokeInputRef = useRef({ stage: blobbi.stage, state: blobbi.state, stats });
  pokeInputRef.current = { stage: blobbi.stage, state: blobbi.state, stats };
  const poke = useCallback((): PokeReaction => {
    markActivity();
    const now = Date.now();
    pokesRef.current = [...pokesRef.current.filter((t) => now - t < POKE_PATIENCE.windowMs), now];
    const reaction = pokeReaction({ ...pokeInputRef.current, recentPokes: pokesRef.current.length });
    if (reaction.mood === 'annoyed') pokesRef.current = [];
    const allowed = policyRef.current.pokes;
    if (allowed === 'none') return { ...reaction, expression: null };
    if ((allowed === 'full' || allowed === 'face') && reaction.expression) react(reaction.expression, reaction.durationMs);
    if (allowed === 'full' || allowed === 'gesture') gesticulate(reaction.gesture, reaction.durationMs);
    return reaction;
  }, [markActivity, react, gesticulate]);

  const lookAt = useCallback(
    (offset: EyeOffset, durationMs = 1_500) => {
      if (!policyRef.current.gaze) return;
      glance(offset, durationMs);
    },
    [glance],
  );

  const reactToCare = useCallback(
    (result: CareReaction) => {
      markActivity();
      react(reactionForCare(result.action, result.nextState));
    },
    [markActivity, react],
  );

  const celebrate = useCallback(
    (durationMs = 2_400) => {
      markActivity();
      react('excited', durationMs);
    },
    [markActivity, react],
  );

  // Stable on purpose: effects that place the Blobbi (a room change, a
  // sleeper following its bed) depend on it, and a callback that changed
  // with every step would re-run them on every step.
  const locomotionPlaceAt = locomotion.placeAt;
  const placeAt = useCallback(
    (position: FloorPoint) => {
      markActivity();
      locomotionPlaceAt(position);
    },
    [markActivity, locomotionPlaceAt],
  );

  const gazeMove = gaze.onPointerMove;
  const gazeLeave = gaze.onPointerLeave;
  const gazeDown = gaze.onPointerDown;
  const scenePointerHandlers = useMemo<ScenePointerHandlers>(
    () => ({
      onPointerMove: gazeMove,
      onPointerLeave: gazeLeave,
      onPointerDown: (event) => {
        markActivity();
        gazeDown(event);
      },
    }),
    [gazeMove, gazeLeave, gazeDown, markActivity],
  );

  return { presentation, mode, walkTo, onFloorTap, poke, lookAt, reactToCare, celebrate, canWalk: policy.walks.includes('user'), placeAt, scenePointerHandlers, isUserWalking, reducedMotion };
}
