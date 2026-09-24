import { forwardRef, useCallback, useRef, type ForwardedRef, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { FLOOR_BAND } from './geometry';
import type { ScenePointerHandlers } from './useBlobbiPresentation';

interface HomeSceneProps {
  /** The scene's accessible name, e.g. "Brook's home". */
  label: string;
  /** Name for the floor's tap target. */
  floorLabel: string;
  /** A tap or click on the floor, as fractions of the scene box. */
  onFloorTap?: (fraction: { x: number; y: number }) => void;
  pointerHandlers?: ScenePointerHandlers;
  /** A horizontal swipe across the scene (to the next room). The gesture never counts as a tap. */
  onSwipe?: (direction: 'left' | 'right') => void;
  /** Which room this is, for styling (`data-room`). */
  room?: string;
  /** The room behind everything (the backdrop layer). */
  children?: ReactNode;
  /** Layers, back to front. */
  topBar?: ReactNode;
  objects?: ReactNode;
  actor?: ReactNode;
  foreground?: ReactNode;
  className?: string;
}

/**
 * The place the Blobbi lives, as explicit layers:
 *
 *   sky and far environment   `.home-scene` background (theme-driven) + vignette
 *   floor                     `.scene-floor`, the tappable band
 *   objects                   things on the floor (the bed)
 *   actor                     the Blobbi
 *   foreground                feedback and UI that sits over the scene
 *
 * The scene box is `position: relative`; everything on the floor is placed
 * by normalized coordinates, so the layout is the same at every size.
 */
export const HomeScene = forwardRef<HTMLElement, HomeSceneProps>(function HomeScene(
  { label, floorLabel, onFloorTap, pointerHandlers, onSwipe, room, children, topBar, objects, actor, foreground, className = '' },
  ref,
) {
  // The scene box is measured through our own ref, merged with the forwarded
  // one, so the floor button need not sit anywhere in particular in the DOM.
  const sceneRef = useRef<HTMLElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      sceneRef.current = node;
      assignRef(ref, node);
    },
    [ref],
  );

  // A swipe: pointer down, a mostly horizontal move, pointer up, quickly.
  // The click the browser fires afterwards is swallowed in the capture
  // phase, so a swipe that ends over the floor, the bed or the Blobbi never
  // walks, sleeps or pokes.
  const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const swallowClickRef = useRef(false);
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    pointerHandlers?.onPointerDown(event);
    swipeRef.current = onSwipe ? { x: event.clientX, y: event.clientY, t: performance.now() } : null;
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start || !onSwipe) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dy) > SWIPE_MAX_DRIFT_PX || performance.now() - start.t > SWIPE_MAX_MS) return;
    swallowClickRef.current = true;
    setTimeout(() => {
      swallowClickRef.current = false;
    }, 400);
    onSwipe(dx < 0 ? 'left' : 'right');
  };
  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!swallowClickRef.current) return;
    swallowClickRef.current = false;
    event.stopPropagation();
    event.preventDefault();
  };

  const onFloorClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!onFloorTap) return;
    const scene = sceneRef.current;
    if (!scene) return;
    const rect = scene.getBoundingClientRect();
    if (event.detail === 0 || rect.width === 0 || rect.height === 0) {
      // Keyboard activation: come to the middle of the floor.
      onFloorTap({ x: 0.5, y: (FLOOR_BAND.top + FLOOR_BAND.bottom) / 2 });
      return;
    }
    onFloorTap({ x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height });
  };

  return (
    <section
      ref={setRefs}
      className={`scene ${className}`}
      aria-label={label}
      data-testid="home-scene"
      data-room={room}
      onPointerMove={pointerHandlers?.onPointerMove}
      onPointerLeave={pointerHandlers?.onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        swipeRef.current = null;
      }}
      onClickCapture={onClickCapture}
    >
      {children}
      <button
        type="button"
        className="scene-floor"
        data-testid="scene-floor"
        aria-label={floorLabel}
        onClick={onFloorClick}
        disabled={!onFloorTap}
        style={{ top: `${FLOOR_BAND.top * 100}%`, bottom: `${(1 - FLOOR_BAND.bottom) * 100 - 4}%` }}
      />
      {/* Objects and the actor share one layer so depth (z by floor y) can interleave them. */}
      <div className="scene-layer scene-stage">
        {objects}
        {actor}
      </div>
      {topBar && <div className="scene-topbar">{topBar}</div>}
      {foreground && <div className="scene-layer scene-foreground">{foreground}</div>}
    </section>
  );
});

/** A swipe is at least this far sideways, no further than this up or down, and this quick. */
export const SWIPE_MIN_PX = 56;
export const SWIPE_MAX_DRIFT_PX = 48;
export const SWIPE_MAX_MS = 700;

function assignRef<T>(ref: ForwardedRef<T>, value: T | null): void {
  if (typeof ref === 'function') ref(value as T);
  else if (ref) ref.current = value as T;
}
