import { forwardRef, type ReactNode } from 'react';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { placeOnFloor } from './geometry';
import type { BlobbiPresentation } from './presentation';

interface BlobbiActorProps {
  blobbi: BlobbiCompanion;
  presentation: BlobbiPresentation;
  /** One line under the name: how it is doing. */
  mood?: string;
  /** Bumps the "happy" hop; plays once per change. */
  happyKey?: number;
  onPoke?: () => void;
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
  { blobbi, presentation, mood, happyKey = 0, onPoke, children },
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
        <div key={happyKey} className={`scene-actor__box ${happyKey > 0 ? 'animate-blobbi-happy' : ''}`}>
          <BlobbiRenderer
            visual={toBlobbiVisual(blobbi)}
            instanceId={`home-${blobbi.d}`}
            size="100%"
            facing={presentation.facing}
            motion={presentation.motion}
            expression={presentation.expression}
            eyeOffset={presentation.eyeOffset}
            isSleeping={isSleeping}
            label={blobbi.name}
            onClick={onPoke}
            interactive={!!onPoke}
            transparent
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
      <div className="scene-actor__caption">
        <span className="scene-text block text-2xl font-bold tracking-tight sm:text-3xl">{blobbi.name}</span>
        {mood && (
          <span className="scene-text mt-0.5 block text-sm font-medium text-foreground/80" data-testid="mood-line">
            {blobbi.name} {mood}
          </span>
        )}
      </div>
    </div>
  );
});
