import { forwardRef, type MouseEvent, type ReactNode } from 'react';
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
  /** Layers, back to front. */
  topBar?: ReactNode;
  objects?: ReactNode;
  actor: ReactNode;
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
  { label, floorLabel, onFloorTap, pointerHandlers, topBar, objects, actor, foreground, className = '' },
  ref,
) {
  const onFloorClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!onFloorTap) return;
    const scene = event.currentTarget.parentElement;
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
      ref={ref}
      className={`home-scene scene ${className}`}
      aria-label={label}
      data-testid="home-scene"
      onPointerMove={pointerHandlers?.onPointerMove}
      onPointerLeave={pointerHandlers?.onPointerLeave}
      onPointerDown={pointerHandlers?.onPointerDown}
    >
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
