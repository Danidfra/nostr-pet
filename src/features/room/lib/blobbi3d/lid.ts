/**
 * LIDS on the 3D eye, the way the 2D drawing has them.
 *
 * The kit gives a half-shut eye's lid as a skin region (a box above the
 * lid's edge, running past the eye on every side) and the edge's stroke;
 * the drawing clips the region to the eye. Here the region is clipped the
 * same way and laid over the eye as a grid of columns, each from the eye's
 * rim down to the edge, so every point of it can be raised over the white's
 * dome and everything on it: a flat fan of triangles from the outline alone
 * spans under the dome, and the eye showed through it. Over the white the
 * lid stands `LID_LIFT` above the dome; past the white's rim it comes down
 * to the skin, so it reads as skin over the eye and not as a plate on it.
 */
import { domeHeight } from './eyes';
import type { EllipseLike } from './surface';
import type { Pt } from './svg-path';

/** Root units the lid stands over the white's dome: above every layer on it, a "wide" iris's lift included. */
export const LID_LIFT = 5.2;
/** Root units the lid's edge is inked above the lid. */
export const LID_LINE_LIFT = 0.4;
/** How far past the white the lid reaches (root units), as the drawing's clip does, so no white fringe survives. */
export const LID_MARGIN = 0.7;
/** Root units the lid's rim stands over the skin, clear of it. */
const RIM_LIFT = 0.5;
const COLUMNS = 24;
const ROWS = 6;

export interface LidGrid {
  /** Front-view root points, column by column (ROWS + 1 a column, from the rim). */
  points: Pt[];
  /** Triangles over `points`. */
  index: number[];
}

/** The ellipse a lid is clipped to: the white, a hair larger. */
export function lidClip(white: EllipseLike): EllipseLike {
  return { cx: white.cx, cy: white.cy, rx: white.rx + LID_MARGIN, ry: white.ry + LID_MARGIN };
}

/** Where a vertical line at `x` crosses a closed polygon: the lowest and highest crossing, or null. */
function crossings(polygon: readonly Pt[], x: number): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if ((a.x <= x && b.x >= x) || (b.x <= x && a.x >= x)) {
      const y = a.x === b.x ? Math.min(a.y, b.y) : a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
      const y2 = a.x === b.x ? Math.max(a.y, b.y) : y;
      min = Math.min(min, y);
      max = Math.max(max, y2);
    }
  }
  return min <= max ? { min, max } : null;
}

/**
 * The lid's region (a closed polygon from the kit's path) inside the clip
 * ellipse, as a grid. The kit's regions are one span a column (the box above
 * the edge, or below it for the lower lid), which is what makes columns
 * exact. A column the region misses collapses onto the rim, so the grid
 * stays whole and adds nothing there.
 */
export function lidGrid(region: readonly Pt[], clip: EllipseLike, columns = COLUMNS, rows = ROWS): LidGrid | null {
  if (region.length < 3) return null;
  const points: Pt[] = [];
  let covered = false;
  for (let i = 0; i <= columns; i++) {
    // Columns spaced by angle round the ellipse, so they crowd where the rim turns
    const s = -Math.cos((Math.PI * i) / columns);
    const x = clip.cx + s * clip.rx;
    const half = clip.ry * Math.sqrt(Math.max(0, 1 - s * s));
    const top = clip.cy - half;
    const bottom = clip.cy + half;
    const span = crossings(region, x);
    const lo = span ? Math.min(bottom, Math.max(top, span.min)) : top;
    const hi = span ? Math.min(bottom, Math.max(top, span.max)) : top;
    if (hi - lo > 1e-6) covered = true;
    for (let j = 0; j <= rows; j++) points.push({ x, y: lo + ((hi - lo) * j) / rows });
  }
  if (!covered) return null;
  const index: number[] = [];
  const at = (i: number, j: number) => i * (rows + 1) + j;
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) index.push(at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
  }
  return { points, index };
}

/**
 * How high the lid stands over the skin at a front-view point (root units):
 * `LID_LIFT` over the white's dome, coming down past the white's rim to just
 * over the skin at the clip's rim.
 */
export function lidHeight(white: EllipseLike, x: number, y: number): number {
  const dx = (x - white.cx) / white.rx;
  const dy = (y - white.cy) / white.ry;
  const r = Math.sqrt(dx * dx + dy * dy);
  if (r <= 1) return domeHeight(white, x, y) + LID_LIFT;
  // Past the rim: the fraction of the way out to the clip, along the same direction
  const out = Math.min(1, (r - 1) / (LID_MARGIN / Math.min(white.rx, white.ry)));
  const ease = out * out * (3 - 2 * out);
  return LID_LIFT + (RIM_LIFT - LID_LIFT) * ease;
}
