import { memo, type CSSProperties, type ReactNode } from 'react';
import { depthScale } from '../scene/geometry';
import { floorFromRoom, roomToCss } from '../space/room-space';
import { furnitureById, type FurnitureDefinition } from './furniture-registry';
import { placementZIndex, type Placement } from './layout-schema';
import { t } from '@/i18n';

export interface FurnitureLayerProps {
  placements: readonly Placement[];
  /** A piece the Blobbi can use is a button while this is on. */
  interactive?: boolean;
  onUse?: (placement: Placement, def: FurnitureDefinition) => void;
  /** Extra state per placement (the editor: selected, dragging). */
  stateOf?: (placement: Placement, index: number) => string | undefined;
  /** Something drawn on top of a placement (the editor's handles). */
  decorate?: (placement: Placement, index: number, def: FurnitureDefinition) => ReactNode;
  /** Pointer-down hook per placement (the editor's drag). */
  onPointerDown?: (placement: Placement, index: number, event: React.PointerEvent<HTMLElement>) => void;
  onSelect?: (placement: Placement, index: number) => void;
  /** Keyboard handling for the selected piece (the editor's nudging). */
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
  /** Label suffix while editing ("Bed, selected"). */
  editing?: boolean;
}

/**
 * The furniture of the room, placed in canvas coordinates: anchored at the
 * feet (`x` centre, `y` bottom), sized as a fraction of canvas width,
 * scaled a little by depth like the Blobbi, and painted in layers so the
 * Blobbi walks behind a bed and in front of a rug. What tapping a piece
 * does comes from its definition (`use`), never from a room id.
 */
function FurnitureLayerImpl({ placements, interactive = false, onUse, stateOf, decorate, onPointerDown, onSelect, onKeyDown, editing = false }: FurnitureLayerProps) {
  return (
    <>
      {placements.map((placement, index) => {
        const def = furnitureById(placement.id);
        if (!def) return null;
        const css = roomToCss(placement);
        const width = def.baseWidth * (placement.scale ?? 1);
        const depth = placement.layer === 'back' ? 0 : floorFromRoom({ x: placement.x, y: placement.y }).y;
        const scale = placement.layer === 'back' ? 1 : depthScale(depth);
        const usable = interactive && def.use && onUse;
        const clickable = usable || (editing && onSelect);
        const state = stateOf?.(placement, index);
        const name = furnitureLabel(def);
        const label = editing ? `${name}${state === 'selected' ? ', selected' : ''}` : name;
        const style = {
          left: css.left,
          top: css.top,
          zIndex: placementZIndex(placement, def),
          '--object-width': `${(width * 100).toFixed(3)}%`,
          '--object-scale': String(scale),
          '--object-aspect': String(def.aspectRatio),
          '--flip': placement.flip ? -1 : 1,
        } as CSSProperties;
        return (
          <div key={`${placement.id}#${index}`} className="furniture-anchor" style={style} data-testid={`furniture-${placement.id}`} data-furniture={placement.id} data-layer={placement.layer} data-index={index} data-state={state} data-use={def.use?.kind}>
            {def.shadow && def.shadow !== 'none' && <span aria-hidden className={def.shadow === 'wide' ? 'furniture-shadow furniture-shadow--wide' : 'furniture-shadow'} />}
            <button
              type="button"
              className="furniture"
              aria-label={label}
              disabled={!clickable}
              onClick={() => {
                if (editing && onSelect) onSelect(placement, index);
                else if (usable) onUse(placement, def);
              }}
              onPointerDown={onPointerDown ? (event) => onPointerDown(placement, index, event) : undefined}
              onKeyDown={editing && state === 'selected' ? onKeyDown : undefined}
              aria-pressed={editing ? state === 'selected' : undefined}
              data-testid={`furniture-button-${placement.id}`}
            >
              <img src={def.asset} alt="" draggable={false} className="furniture__art" />
            </button>
            {decorate?.(placement, index, def)}
          </div>
        );
      })}
    </>
  );
}

/**
 * A piece's name in the page's language: the bed and the tub the live home brings out are translated; the dormant
 * registry's other pieces (and its editor's words) keep their English labels.
 */
function furnitureLabel(def: { id: string; label: string }): string {
  if (def.id === 'home:bed-pet') return t('home.furniture.bed');
  if (def.id === 'home:tub') return t('home.furniture.tub');
  return def.label;
}

/** Memoized: the room re-renders every animation frame while the Blobbi walks; the furniture does not change with it. */
export const FurnitureLayer = memo(FurnitureLayerImpl);
