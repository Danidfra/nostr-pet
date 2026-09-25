import type { ReactNode } from 'react';
import { placeOnFloor } from './geometry';
import type { SceneObjectDef } from './objects';

interface SceneObjectViewProps {
  def: SceneObjectDef;
  /** Tapping the object. Absent means the object is not interactive right now. */
  onTap?: () => void;
  /** A short state word for tests and styling (`occupied`, `open`). */
  state?: string;
  children: ReactNode;
  /** Something drawn beside the object (a prompt bubble). */
  aside?: ReactNode;
}

/**
 * One thing standing in the home. Placed by its floor point like the Blobbi,
 * so depth ordering interleaves them; a real button when it can be used.
 * What it looks like comes in as children (art per object), what tapping
 * does comes from the overview.
 */
export function SceneObjectView({ def, onTap, state, children, aside }: SceneObjectViewProps) {
  const placement = placeOnFloor(def.position);
  // A wall fixture keeps its size (depth is a floor thing) and sits behind anything on the floor.
  const scale = def.wall ? 1 : placement.scale;
  const zIndex = def.wall ? 3 : placement.zIndex;
  return (
    <div
      className="scene-object-anchor"
      style={{ left: placement.left, top: placement.top, zIndex, '--object-scale': String(scale), '--object-width': `${def.width * 100}%` } as React.CSSProperties}
      data-wall={def.wall ? 'true' : undefined}
      data-testid={def.testId ?? `scene-object-${def.id}`}
      data-state={state}
    >
      <button type="button" className="scene-object" aria-label={def.label} onClick={onTap} disabled={!onTap}>
        {children}
      </button>
      {aside}
    </div>
  );
}

/** The door to the Island: a simple painted door on the back wall. */
export function DoorArt({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 60 100" className="scene-object-art" aria-hidden data-open={open ? 'true' : 'false'}>
      <rect x="0" y="0" width="60" height="100" rx="3" fill="var(--wall-shade)" />
      <rect x="4" y="4" width="52" height="96" rx="2" fill={open ? 'var(--sky-bottom)' : 'hsl(24 45% 46%)'} />
      {!open && (
        <>
          <rect x="10" y="10" width="40" height="32" rx="2.5" fill="hsl(24 40% 40%)" />
          <rect x="10" y="50" width="40" height="42" rx="2.5" fill="hsl(24 40% 40%)" />
          <circle cx="45" cy="52" r="2.4" fill="hsl(42 90% 62%)" />
        </>
      )}
      {open && <rect x="4" y="4" width="13" height="96" rx="2" fill="hsl(24 45% 40%)" />}
      <rect x="0" y="97" width="60" height="3" fill="hsl(24 30% 30% / 0.35)" />
    </svg>
  );
}
