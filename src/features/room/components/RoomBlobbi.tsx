/**
 * RoomBlobbi — the canonical Blobbi standing in the 3D room.
 *
 * Rendered inside a room anchor (see RoomShell): the shell moves the anchor
 * to the Blobbi's feet on screen each frame and sets `--anchor-px` (screen
 * px per tile there), which scales the BLOBBI_BOX_PX art box to the Blobbi's
 * size at that spot in the room. The body bottom is aligned to the anchor
 * using the renderer's own ground line, and the name floats above it at a
 * readable size (a visitor's; the user's Blobbi's name is shown by the room,
 * on demand). The 3D scene draws the Blobbi's shadow.
 *
 * The drawing is the kit's `BlobbiRenderer` over `toBlobbiVisual`, exactly
 * as the 2D home draws it: V1, V2 and V3 all come through here, and the
 * room decides only where it stands and which way it faces. Ditto's
 * `BlobbiRoomStage`, with Ditto's own V1/V2 artwork and status recipes
 * replaced by the canonical renderer and the home's baseline expression.
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { BlobbiRenderer, type BlobbiExpression, type BlobbiFacing, type BlobbiMotion } from '@blobbi-kit/renderer';
import { TeleportFrame2D } from '@/features/teleport/react/TeleportFrame2D';
import type { Journey } from '@/features/teleport/presence';
import type { JourneyKind } from '@/features/teleport/timeline';
import type { BlobbiCompanion } from '@blobbi-kit/core';

import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { gazeReachOfVisual, limitGaze } from '@/lib/gaze-reach';
import { bodyBottomInset } from '../lib/body-inset';
import { walkTempoFor } from '../lib/room-pace';
import { GESTURES } from '@/features/home/scene/gestures';
import { useReducedMotion } from '@/features/home/scene/SceneSettings';
import type { PokeGesture } from '@/features/home/personality';

interface RoomBlobbiProps {
  blobbi: BlobbiCompanion;
  /** Which way it faces, from where it walks in the room (the shell reports it). Default front. */
  facing?: BlobbiFacing;
  /** The face it wears (a preset, or the renderer's explicit parts); the home's baseline when nothing is happening. */
  expression?: BlobbiExpression;
  /**
   * Body motion: `walking` while the room moves it (the renderer walks the
   * V3 adult on its legs and hops a baby, its own gaits), else the idle
   * breath, or still for an egg and a sleeper.
   */
  motion?: BlobbiMotion;
  /** Where the eyes look (the renderer's normalized offset); undefined draws them at rest. */
  eyeOffset?: { x: number; y: number };
  /** A visiting Blobbi's smaller tag. */
  variant?: 'main' | 'guest';
  /** A body gesture to play (the home's): a new key plays it again. */
  gesture?: { kind: PokeGesture; key: number } | null;
  /** A journey under way (teleporting): drawn around the canonical drawing, never in it. */
  journey?: Journey | null;
  /** Away (gone somewhere else): nothing is drawn. */
  absent?: boolean;
  /** The share of a journey's motes drawn (the room's rendering quality); 1 by default. */
  moteDensity?: number;
  /** A fixed moment of a journey to show (the development scrubber). */
  journeyPreview?: { kind: JourneyKind; t: number; reduced?: boolean } | null;
}

/** Side of the Blobbi's art box before the room scales it. */
export const BLOBBI_BOX_PX = 200;

/**
 * Art box scale: the room's px-per-tile at the Blobbi's feet (`--anchor-px`)
 * times the box size in tiles (`--blobbi-tiles`), both set by the shell.
 */
const SCALE = `calc(var(--anchor-px, 100) * var(--blobbi-tiles, 2) / ${BLOBBI_BOX_PX})`;

/**
 * A Blobbi standing on its anchor point: a BLOBBI_BOX_PX art box scaled by
 * the room to its size at that spot, with the body bottom (not the art's
 * empty margin) on the floor, and its name tag, unscaled so it stays
 * readable, floating above.
 */
function Standing({ inset, nameTag, children }: { inset: number; nameTag?: ReactNode; children: ReactNode }) {
  return (
    <div className="absolute left-0 top-0 pointer-events-none">
      <div
        className="absolute bottom-0 left-0"
        style={{
          width: BLOBBI_BOX_PX,
          height: BLOBBI_BOX_PX,
          transformOrigin: 'bottom left',
          transform: `scale(${SCALE}) translate(-50%, ${inset}%)`,
        }}
      >
        {children}
      </div>
      {nameTag && (
        <div
          className="absolute left-0 bottom-0 pointer-events-none"
          style={{ transform: `translate(-50%, calc(${SCALE} * ${-(BLOBBI_BOX_PX * (1 - inset / 100))}px - 4px))` }}
        >
          {nameTag}
        </div>
      )}
    </div>
  );
}

export const RoomBlobbi = forwardRef<HTMLDivElement, RoomBlobbiProps>(function RoomBlobbi({ blobbi, facing = 'front', expression = 'neutral', motion, eyeOffset, variant = 'main', gesture, journey = null, absent = false, journeyPreview = null, moteDensity = 1 }, ref) {
  const boxRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => boxRef.current as HTMLDivElement);
  // A gesture: the home's keyframes on this box around the renderer, composited over whatever it is doing
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const box = boxRef.current;
    if (!gesture || !box || reducedMotion || typeof box.animate !== 'function') return;
    const spec = GESTURES[gesture.kind];
    const animation = box.animate(spec.keyframes, { duration: spec.durationMs, easing: spec.easing, composite: 'add' });
    return () => animation.cancel();
  }, [gesture, reducedMotion]);
  const isSleeping = blobbi.state === 'sleeping';
  const isEgg = blobbi.stage === 'egg';
  const visual = useMemo(() => toBlobbiVisual(blobbi), [blobbi]);
  // No further than keeps each pupil on its white (the 3D model's rig keeps the same reach)
  const gazeReach = useMemo(() => gazeReachOfVisual(visual), [visual]);
  const inset = useMemo(() => bodyBottomInset(blobbi, facing), [blobbi, facing]);
  // An egg rests; a sleeper lies still; anyone else breathes.
  const bodyMotion: BlobbiMotion = isEgg || isSleeping ? 'still' : (motion ?? 'idle');
  const instanceId = `room-${variant}-${blobbi.d}`;

  return (
    <Standing
      inset={inset}
      // The user's Blobbi's name is the room's to show, on demand (RoomShell); a visitor wears its own tag
      nameTag={
        !isEgg && variant === 'guest' && (
          <span className="room-name-tag room-name-tag--guest">
            <span className="room-name-tag__dot" style={{ background: visual.baseColor }} aria-hidden />
            <span>{blobbi.name}</span>
          </span>
        )
      }
    >
      <div
        ref={boxRef}
        className="room-blobbi relative size-full"
        data-room-blobbi={variant}
        data-facing={facing}
        data-motion={bodyMotion}
        data-stage={blobbi.stage}
        data-generation={blobbi.visualGeneration}
        data-sleeping={isSleeping ? 'true' : 'false'}
        data-expression={typeof expression === 'string' ? expression : JSON.stringify(expression)}
        // The room's walking tempo: the kit's walk cycle plays this many times faster here (index.css), and the
        // scene moves the Blobbi that much faster with it (room-pace.ts), so a planted foot keeps its spot.
        style={{ '--room-walk-tempo': walkTempoFor(blobbi.stage) } as CSSProperties}
      >
        {/* A journey is drawn around the kit's drawing (a mask, a glow, motes), never in it */}
        <TeleportFrame2D journey={journey} absent={absent} preview={journeyPreview} density={moteDensity} fallbackTint={visual.baseColor}>
          <BlobbiRenderer
            visual={visual}
            instanceId={instanceId}
            size="100%"
            facing={facing}
            motion={bodyMotion}
            eyeOffset={isEgg || isSleeping ? undefined : limitGaze(eyeOffset, gazeReach)}
            expression={expression}
            isSleeping={isSleeping}
            sleepIndicator="none"
            label={blobbi.name}
            transparent
            style={{ width: '100%', height: '100%' }}
          />
        </TeleportFrame2D>
        {/* The one sleep cue, the home's own, as on the 2D home. */}
        {isSleeping && (
          <span aria-hidden className="room-blobbi__zzz scene-text animate-sparkle">
            z<span className="text-lg">z</span>
          </span>
        )}
      </div>
    </Standing>
  );
});
