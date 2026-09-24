import { forwardRef, type ReactNode } from 'react';
import { BlobbiRenderer, type BlobbiEggCrack, type BlobbiVisualEffect, type NormalizedAccessoryPlacement } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { placeOnFloor } from './geometry';
import type { BlobbiPresentation } from './presentation';

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
  /** Renderer effects around the Blobbi (a ceremony glow, sparkles, worn effect items). */
  effects?: readonly BlobbiVisualEffect[];
  /** What it wears (normalized for the current facing by the caller). */
  accessories?: readonly NormalizedAccessoryPlacement[];
  /** Feedback drawn above the actor (floating stat chips). */
  children?: ReactNode;
}

/**
 * The Blobbi as something standing in its home. The actor is anchored at
 * its feet on a floor point, drawn a little smaller towards the back, over a
 * patch of light and its own shadow. It hands the composed presentation
 * (facing, motion, gaze, expression, sleeping) to the canonical renderer and
 * decides nothing about how the Blobbi looks. It never touches Nostr.
 */
export const BlobbiActor = forwardRef<HTMLDivElement, BlobbiActorProps>(function BlobbiActor(
  { blobbi, presentation, happyKey = 0, onPoke, tapLabel, invite = false, eggCrack, effects, accessories, children },
  ref,
) {
  const placement = placeOnFloor(presentation.position);
  const { isSleeping } = presentation;

  return (
    <div
      ref={ref}
      className="scene-actor"
      data-testid="blobbi-actor"
      data-motion={presentation.motion}
      data-facing={presentation.facing}
      data-expression={presentation.expression}
      data-sleeping={isSleeping ? 'true' : 'false'}
      data-invite={invite ? 'true' : 'false'}
      data-egg-crack={blobbi.stage === 'egg' ? (eggCrack ?? 'none') : undefined}
      data-x={presentation.position.x.toFixed(3)}
      data-y={presentation.position.y.toFixed(3)}
      style={{ left: placement.left, top: placement.top, zIndex: placement.zIndex, '--actor-scale': String(placement.scale) } as React.CSSProperties}
    >
      <div className="scene-actor__body">
        <div aria-hidden className="home-ground scene-actor__ground" />
        <div aria-hidden className="scene-actor__shadow" />
        {children}
        {isSleeping && (
          <span aria-hidden className="scene-actor__zzz scene-text animate-sparkle">
            z<span className="text-lg">z</span>
          </span>
        )}
        {/* The poke is a real button around the drawing, so it is focusable and
            keyboard operable; the renderer stays a plain image with no click of its own. */}
        <button
          key={happyKey}
          type="button"
          className={`scene-actor__box ${happyKey > 0 ? 'animate-blobbi-happy' : ''}`}
          onClick={onPoke}
          disabled={!onPoke}
          aria-label={tapLabel ?? `Poke ${blobbi.name}`}
          data-testid="blobbi-poke"
        >
          <BlobbiRenderer
            visual={toBlobbiVisual(blobbi)}
            instanceId={`home-${blobbi.d}`}
            size="100%"
            facing={presentation.facing}
            motion={presentation.motion}
            expression={presentation.expression}
            eyeOffset={presentation.eyeOffset}
            isSleeping={isSleeping}
            eggCrack={eggCrack}
            effects={effects}
            accessories={accessories}
            label={blobbi.name}
            transparent
            style={{ width: '100%', height: '100%' }}
          />
        </button>
      </div>
    </div>
  );
});
