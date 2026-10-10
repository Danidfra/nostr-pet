/**
 * Units of the 3D Blobbi.
 *
 * The kit's procedural geometry is in ROOT units (an adult body is ~630 tall,
 * the ground line at y≈801, y down). Its SVG is a `VIEWBOX`-sized document the
 * root is scaled into by `DOCUMENT_TRANSFORM`, and the room scales THAT box to
 * the Blobbi's size in tiles (`RoomBlobbi`'s art box). So one model unit here
 * is the height of that box: a model of height 1 is exactly what the 2D
 * drawing's box is, and the room scales it by `blobbiBoxTiles(stage)`, the
 * same number it scales the 2D drawing by.
 *
 * Axes: x to the Blobbi's screen-right in the front view, y up, z toward the
 * viewer of the front view (the belly side). The origin is the ground point
 * under the body's axis.
 */
import { BABY_BOX, DOCUMENT_TRANSFORM, VIEWBOX } from '@blobbi-kit/renderer/procedural';

/** Root units per art box height: the adult's document. */
export const ROOT_PER_BOX = VIEWBOX.height / DOCUMENT_TRANSFORM.scale;
/** Model units per root unit, in the geometry as built (the adult's box). */
export const U = 1 / ROOT_PER_BOX;

/**
 * Root units per art box for a life stage. The baby is drawn in its own,
 * smaller square frame (`BABY_BOX`, the kit's stage viewBox for it), which
 * the room scales to the baby's size in tiles just as it scales the adult's
 * document to the adult's; so a model built in the adult's units is scaled
 * by `ROOT_PER_BOX / rootPerBox(stage)` to stand in its own box.
 */
export function rootPerBox(stage: 'baby' | 'adult'): number {
  return stage === 'baby' ? BABY_BOX.size : ROOT_PER_BOX;
}

/** Where the root coordinates of the front and side views sit in the model. */
export interface Frame {
  /** The front view's body axis (root x). */
  axisX: number;
  /** The front view's ground line (root y). */
  groundY: number;
  /** The side view's body axis (root x of the side drawing: its depth axis). */
  sideAxisX: number;
}

export const toModelX = (xRoot: number, f: Frame): number => (xRoot - f.axisX) * U;
export const toModelY = (yRoot: number, f: Frame): number => (f.groundY - yRoot) * U;
/** A side-view x (the view faces screen-right, so larger x is nearer the belly) as depth. */
export const toModelZ = (xSide: number, f: Frame): number => (xSide - f.sideAxisX) * U;
