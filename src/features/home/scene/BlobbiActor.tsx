import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react';
import { BlobbiRenderer, blobbiMotionPhase, BLOBBI_MOTION_PHASES, type BlobbiEggCrack, type BlobbiVisualEffect, type NormalizedAccessoryPlacement } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { placeOnFloor } from './geometry';
import { walkCycleFor } from './motion-contract';
import { GESTURES, hatchRock } from './gestures';
import { useReducedMotion } from './SceneSettings';
import type { BlobbiPresentation } from './presentation';

/** A hatch ceremony's beat, as the actor draws it (the ceremony decides it; see `useLifecycleCeremony`). */
export interface ActorHatch {
  beat: 'stirring' | 'cracking' | 'breaking' | 'hatching' | 'hatched';
  /** How hard the shell rocks, 0 to 4. */
  rock: 0 | 1 | 2 | 3 | 4;
  /** The burst of light: gathering over the shell, or clearing off the newborn. */
  burst: 'none' | 'in' | 'out';
}

interface BlobbiActorProps {
  blobbi: BlobbiCompanion;
  presentation: BlobbiPresentation;
  /** Bumps the "happy" hop; plays once per change. */
  happyKey?: number;
  onPoke?: () => void;
  /** What tapping the Blobbi does right now, when it is not a poke ("Give Brook the Apple"). */
  tapLabel?: string;
  /** The player holds something for it: invite the tap. */
  invite?: boolean;
  /** Egg shell state (eggs only). Lifecycle progress and ceremonies decide it. */
  eggCrack?: BlobbiEggCrack;
  /** A hatch ceremony is running: the shell rocks and, at the end, light bursts out of it. */
  hatch?: ActorHatch | null;
  /** Renderer effects around the Blobbi (a ceremony glow, sparkles, worn effect items). */
  effects?: readonly BlobbiVisualEffect[];
  /** What it wears (normalized for the current facing by the caller). */
  accessories?: readonly NormalizedAccessoryPlacement[];
  /** Feedback drawn above the actor (floating stat chips). */
  children?: ReactNode;
  /** On the nest or in the bed: the bed is the ground, so the actor casts no shadow of its own. */
  inBed?: boolean;
}

/**
 * The Blobbi as something standing in its home. The actor is anchored at
 * its feet on a floor point, drawn a little smaller towards the back, over
 * its one ground shadow, which follows the renderer's walk: the generation
 * is on the actor (`data-generation`) because the two gaits cast different
 * shadows (V1 and the baby hop, so their shadow breathes with the bob; the
 * V2 adult walks on its legs and keeps the floor, so its shadow only
 * settles a little at each step; a V3 adult walks on its legs too, on its
 * own cycle, and a V3 baby hops, which is why the stage is on the actor as
 * well), and the renderer draws no ground shadow of its own. It hands the composed presentation (facing, motion, gaze,
 * expression, sleeping) to the canonical renderer and decides nothing
 * about how the Blobbi looks. It never touches Nostr.
 */
export const BlobbiActor = forwardRef<HTMLDivElement, BlobbiActorProps>(function BlobbiActor(
  { blobbi, presentation, happyKey = 0, onPoke, tapLabel, invite = false, eggCrack, hatch = null, effects, accessories, children, inBed = false },
  ref,
) {
  const placement = placeOnFloor(presentation.position);
  const { isSleeping } = presentation;
  // The renderer's walk cycle and per-instance phase, so the shadow under the
  // Blobbi can follow the bob (see motion-contract.ts). Same instance id as
  // the renderer gets, so the phase is the one it uses.
  const instanceId = `home-${blobbi.d}`;
  const motionPhase = blobbiMotionPhase(instanceId) / BLOBBI_MOTION_PHASES;

  // A poke gesture: keyframes on the home's own box around the renderer,
  // played through the Web Animations API so a repeat restarts it without
  // remounting the drawing, and so nothing is added to the renderer's
  // element (its walk and idle transforms stay its own). The presentation
  // already withholds a gesture while walking. Reduced motion: no gesture.
  const rootRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLDivElement);
  const boxRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const { gesture } = presentation;
  useEffect(() => {
    const box = boxRef.current;
    if (!gesture || !box || reducedMotion || typeof box.animate !== 'function') return;
    const spec = GESTURES[gesture.kind];
    const animation = box.animate(spec.keyframes, { duration: spec.durationMs, easing: spec.easing, composite: 'add' });
    return () => animation.cancel();
  }, [gesture, reducedMotion]);

  // A hatching shell rocks on the point it rests on, harder as the cracks
  // grow: a loop on the same box as the gestures, so it is the same rocking
  // for every generation's egg and nothing is added to the renderer. Reduced
  // motion: the shell only cracks.
  const rock = blobbi.stage === 'egg' ? (hatch?.rock ?? 0) : 0;
  useEffect(() => {
    const box = boxRef.current;
    if (rock === 0 || !box || reducedMotion || typeof box.animate !== 'function') return;
    const spec = hatchRock(rock);
    const animation = box.animate(spec.keyframes, { duration: spec.durationMs, easing: spec.easing, iterations: Infinity, composite: 'add' });
    return () => animation.cancel();
  }, [rock, reducedMotion]);
  const burst = hatch && hatch.burst !== 'none' && !reducedMotion ? hatch.burst : null;

  return (
    <div
      ref={rootRef}
      className="scene-actor"
      data-testid="blobbi-actor"
      data-motion={presentation.motion}
      data-generation={blobbi.visualGeneration}
      data-stage={blobbi.stage}
      data-facing={presentation.facing}
      data-expression={presentation.expression}
      data-sleeping={isSleeping ? 'true' : 'false'}
      data-invite={invite ? 'true' : 'false'}
      data-gesture={gesture?.kind}
      data-gesture-key={gesture?.key}
      data-in-bed={inBed ? 'true' : 'false'}
      data-egg-crack={blobbi.stage === 'egg' ? (eggCrack ?? 'none') : undefined}
      data-hatch-beat={hatch?.beat}
      data-hatch-rock={hatch ? (reducedMotion ? 0 : rock) : undefined}
      data-x={presentation.position.x.toFixed(3)}
      data-y={presentation.position.y.toFixed(3)}
      style={{ left: placement.left, top: placement.top, zIndex: placement.zIndex, '--actor-scale': String(placement.scale), '--walk-cycle': `${walkCycleFor(blobbi.visualGeneration)}s`, '--blobbi-motion-phase': String(motionPhase) } as React.CSSProperties}
    >
      <div className="scene-actor__body">
        {!inBed && <div aria-hidden className="scene-actor__shadow" />}
        {children}
        {/* The one sleep cue. The renderer draws the creature asleep (closed
            eyes, `sleepIndicator="none"` below keeps its artwork's own Zzz
            off); the "Zzz" beside it is the home's, animated in the home's style. */}
        {isSleeping && (
          <span aria-hidden className="scene-actor__zzz scene-text animate-sparkle">
            z<span className="text-lg">z</span>
          </span>
        )}
        {/* The poke is a real button around the drawing, so it is focusable and
            keyboard operable; the renderer stays a plain image with no click of its own. */}
        <button
          key={happyKey}
          ref={boxRef}
          type="button"
          className={`scene-actor__box ${happyKey > 0 ? 'animate-blobbi-happy' : ''}`}
          onClick={onPoke}
          disabled={!onPoke}
          aria-label={tapLabel ?? `Poke ${blobbi.name}`}
          data-testid="blobbi-poke"
        >
          <BlobbiRenderer
            visual={toBlobbiVisual(blobbi)}
            instanceId={instanceId}
            size="100%"
            facing={presentation.facing}
            motion={presentation.motion}
            expression={presentation.expression}
            eyeOffset={presentation.eyeOffset}
            isSleeping={isSleeping}
            sleepIndicator="none"
            eggCrack={eggCrack}
            effects={effects}
            accessories={accessories}
            label={blobbi.name}
            transparent
            style={{ width: '100%', height: '100%' }}
          />
        </button>
        {/* The hatching moment: light gathers over the shell while the write is
            out and clears off the newborn once it landed. Decoration only. */}
        {burst && <span aria-hidden className="scene-actor__hatch-burst" data-burst={burst} data-testid="hatch-burst" />}
      </div>
    </div>
  );
});
