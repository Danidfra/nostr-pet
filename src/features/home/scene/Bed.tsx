import { placeOnFloor } from './geometry';
import { BED_POSITION } from './objects';

interface BedProps {
  /** Tapping the bed calls the Blobbi over without putting it to sleep. */
  onTap?: () => void;
  occupied?: boolean;
}

/**
 * The bed: the first real object in the home. It sits on a floor point like
 * the Blobbi does, so it stays in the same place at every viewport, and it
 * is drawn behind or in front of the Blobbi by depth. Recovered from the
 * pre-nuke `public/bed.png`, re-encoded from 2.1 MB to a 15 KB WebP.
 */
export function Bed({ onTap, occupied = false }: BedProps) {
  const placement = placeOnFloor(BED_POSITION);
  return (
    <button
      type="button"
      className="scene-object scene-bed"
      data-testid="scene-bed"
      data-occupied={occupied ? 'true' : 'false'}
      aria-label={occupied ? 'Bed (occupied)' : 'Bed: call your Blobbi over'}
      onClick={onTap}
      disabled={!onTap}
      style={{ left: placement.left, top: placement.top, zIndex: placement.zIndex, '--object-scale': String(placement.scale) } as React.CSSProperties}
    >
      <img src="/objects/bed.webp" alt="" width={560} height={315} draggable={false} />
    </button>
  );
}
