/**
 * Which cells of the bath grid are the Blobbi's body: read from its own
 * drawing when it can be (`readDrawingOutline`, the canonical SVG drawn
 * small and read row by row, as the teleport does), else the plain blob.
 * The grid lives in the art box (x across, y from its bottom); the outline
 * says where the body's feet and top are in that box and how wide it is at
 * each height, so the foam lands on the body and never in the air beside it.
 */
import { BLOB_SILHOUETTE, type Silhouette } from '@/features/teleport/particles';
import { readDrawingOutline } from '@/features/teleport/silhouette2d';
import { BATH_GRID, defaultMask } from './bath-machine';

export interface BodyOutline {
  silhouette: Silhouette;
  /** The feet and the top of the body, as fractions of the box from its bottom. */
  bottom: number;
  top: number;
}

/** The outline nothing better is known for: the plain blob standing on the box's lower part. */
export const DEFAULT_OUTLINE: BodyOutline = { silhouette: BLOB_SILHOUETTE, bottom: 0.08, top: 0.92 };

/** The grid's cells that fall inside an outline (a cell counts when its centre does). */
export function maskFromOutline(outline: BodyOutline, grid = BATH_GRID): boolean[] {
  const mask: boolean[] = [];
  const height = Math.max(1e-3, outline.top - outline.bottom);
  for (let row = 0; row < grid; row++) {
    const y = (row + 0.5) / grid;
    const h = (y - outline.bottom) / height;
    const span = h >= 0 && h <= 1 ? outline.silhouette.span(h) : null;
    for (let col = 0; col < grid; col++) {
      const x = (col + 0.5) / grid - 0.5;
      mask.push(!!span && x >= span.left && x <= span.right);
    }
  }
  // An outline too thin to hold a cell (a tiny drawing) is no use: the plain body stands in
  return mask.some(Boolean) ? mask : defaultMask(grid);
}

/** The body mask of a rendered drawing; the default when it cannot be read (a test DOM, no canvas). */
export async function readBodyMask(svg: SVGSVGElement | null, grid = BATH_GRID): Promise<{ mask: boolean[]; outline: BodyOutline }> {
  const read = await readDrawingOutline(svg);
  const outline: BodyOutline = read ? { silhouette: read.silhouette, bottom: read.bottom, top: read.top } : DEFAULT_OUTLINE;
  return { mask: maskFromOutline(outline, grid), outline };
}
