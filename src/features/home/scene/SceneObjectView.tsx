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
  return (
    <div
      className="scene-object-anchor"
      style={{ left: placement.left, top: placement.top, zIndex: placement.zIndex, '--object-scale': String(placement.scale), '--object-width': `${def.width * 100}%` } as React.CSSProperties}
      data-testid={`scene-object-${def.id}`}
      data-state={state}
    >
      <button type="button" className="scene-object" aria-label={def.label} onClick={onTap} disabled={!onTap}>
        {children}
      </button>
      {aside}
    </div>
  );
}

/** The bed: the pre-nuke `bed.png`, re-encoded to a 15 KB WebP. */
export function BedArt() {
  return <img src="/objects/bed.webp" alt="" width={560} height={315} draggable={false} className="scene-object-art" />;
}

/** The door to the Island: a simple painted door on the back wall. */
export function DoorArt({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 60 110" className="scene-object-art" aria-hidden data-open={open ? 'true' : 'false'}>
      <rect x="2" y="2" width="56" height="106" rx="6" fill="var(--wall-shade)" />
      <rect x="6" y="6" width="48" height="100" rx="4" fill={open ? 'var(--sky-bottom)' : 'hsl(24 45% 46%)'} />
      {!open && (
        <>
          <rect x="12" y="14" width="36" height="34" rx="3" fill="hsl(24 40% 40%)" />
          <rect x="12" y="56" width="36" height="42" rx="3" fill="hsl(24 40% 40%)" />
          <circle cx="44" cy="58" r="2.6" fill="hsl(42 90% 62%)" />
        </>
      )}
      {open && <rect x="6" y="6" width="14" height="100" rx="3" fill="hsl(24 45% 40%)" />}
    </svg>
  );
}
