import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FLOOR_BAND, FLOOR_BOUNDS, placeOnFloor, type BlobbiSceneController } from '@/features/home/scene';
import { approachSpot } from '@/features/home/rooms';
import { STAGE_OBJECTS } from '@/features/home/space/home-space';

interface DebugOverlayProps {
  /** The scene controller of the Blobbi on screen; null while none is mounted. */
  scene: BlobbiSceneController | null;
  /** The root the game is mounted under, so the overlay finds the room canvas it belongs in. */
  stageRoot: HTMLElement | null;
}

interface Measured {
  actor: DOMRect | null;
  shadow: DOMRect | null;
  canvas: DOMRect;
}

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

/**
 * Engineering overlays drawn INTO the real room canvas (a portal), in the
 * canvas's own percentage coordinates, so what is drawn is exactly where the
 * game puts things: the floor band, the floor bounds, the actor's floor
 * point and feet anchor, its destination, the bed and nest use points, and
 * the measured boxes of the actor and its ground shadow. Read-only; dev only.
 */
export function DebugOverlay({ scene, stageRoot }: DebugOverlayProps) {
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const [measured, setMeasured] = useState<Measured | null>(null);

  // The canvas is the game's; find it whenever the stage re-renders.
  useEffect(() => {
    if (!stageRoot) return;
    const find = () => setCanvas(stageRoot.querySelector<HTMLElement>('[data-testid="room-canvas"]'));
    find();
    const observer = new MutationObserver(find);
    observer.observe(stageRoot, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [stageRoot]);

  // Measured boxes follow the animation frame, since the walk and the shadow move between renders.
  useEffect(() => {
    if (!canvas) return;
    let frame = 0;
    const tick = () => {
      const actor = canvas.querySelector<HTMLElement>('[data-testid="blobbi-actor"]');
      setMeasured({
        canvas: canvas.getBoundingClientRect(),
        actor: actor?.querySelector<HTMLElement>('[data-blobbi-body-box]')?.getBoundingClientRect() ?? null,
        shadow: actor?.querySelector<HTMLElement>('.scene-actor__shadow')?.getBoundingClientRect() ?? null,
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [canvas]);

  if (!canvas) return null;
  const position = scene?.presentation.position ?? null;
  const feet = position ? placeOnFloor(position) : null;
  const destination = scene?.destination ? placeOnFloor(scene.destination) : null;
  const bed = placeOnFloor(approachSpot(STAGE_OBJECTS.bed));
  const nest = placeOnFloor(approachSpot(STAGE_OBJECTS.nest));
  const box = (r: DOMRect | null) =>
    r && measured
      ? { left: `${((r.left - measured.canvas.left) / measured.canvas.width) * 100}%`, top: `${((r.top - measured.canvas.top) / measured.canvas.height) * 100}%`, width: `${(r.width / measured.canvas.width) * 100}%`, height: `${(r.height / measured.canvas.height) * 100}%` }
      : null;
  const actorBox = box(measured?.actor ?? null);
  const shadowBox = box(measured?.shadow ?? null);
  const boundsTop = FLOOR_BAND.top + FLOOR_BOUNDS.minY * (FLOOR_BAND.bottom - FLOOR_BAND.top);
  const boundsBottom = FLOOR_BAND.top + FLOOR_BOUNDS.maxY * (FLOOR_BAND.bottom - FLOOR_BAND.top);

  return createPortal(
    <div className="dev-overlay" aria-hidden data-testid="dev-overlay">
      <div className="dev-overlay__band" style={{ top: pct(FLOOR_BAND.top), height: pct(FLOOR_BAND.bottom - FLOOR_BAND.top) }} title="floor band (horizon to front edge)" />
      <div className="dev-overlay__bounds" style={{ left: pct(FLOOR_BOUNDS.minX), width: pct(FLOOR_BOUNDS.maxX - FLOOR_BOUNDS.minX), top: pct(boundsTop), height: pct(boundsBottom - boundsTop) }} title="walkable floor bounds" />
      <div className="dev-overlay__use dev-overlay__use--bed" style={{ left: bed.left, top: bed.top }} title="bed use point" />
      <div className="dev-overlay__use dev-overlay__use--nest" style={{ left: nest.left, top: nest.top }} title="nest use point" />
      {actorBox && <div className="dev-overlay__actor" style={actorBox} title="actor body box" />}
      {shadowBox && <div className="dev-overlay__shadow" style={shadowBox} title="ground shadow box" />}
      {destination && <div className="dev-overlay__dest" style={{ left: destination.left, top: destination.top }} title="destination" />}
      {feet && (
        <div className="dev-overlay__feet" style={{ left: feet.left, top: feet.top }} title="feet anchor (floor point)">
          <span className="dev-overlay__label">
            {position!.x.toFixed(2)},{position!.y.toFixed(2)} · {scene?.presentation.facing} · {scene?.presentation.motion}
          </span>
        </div>
      )}
    </div>,
    canvas,
  );
}
