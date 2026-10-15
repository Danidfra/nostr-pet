/**
 * The body's shape as the frame tells it (M15 care, the 2D effects): the
 * rows of the cell grid that are the body, the bottom and the top of each
 * column, where the water runs and where a drop lets go. Pure; everything
 * read from `BathFrame` alone (`bath-frame.ts`), so what is drawn on the
 * body is exactly what the machine counts as the body, and nothing is
 * drawn beside it.
 *
 * Box units throughout (x 0..1 across, y 0..1 up from the box's bottom),
 * except where a function says it gives the effects' viewBox (100 × 100,
 * y down).
 */
import type { BathCell, BathFrame } from '../bath-frame';
import { maskFromOutline } from '../body-mask';
import { outlineRows, rowsPath, type DrawingOutline, type OutlineRow } from '@/features/teleport/silhouette2d';

type Shape = Pick<BathFrame, 'grid' | 'cells' | 'outline'>;

/** How far in from an edge cell's outer edge a row's edge is drawn (cells). */
export const EDGE_INSET = 0.3;

/** Which cells count for a shape: the body, or part of it (the wet cells, the dry ones). */
export type CellPick = (cell: BathCell) => boolean;

export const isBody: CellPick = (c) => c.body;
export const isWet: CellPick = (c) => c.wet;
export const isDry: CellPick = (c) => c.dry;
/** Still wet: not yet rubbed dry with the towel. */
export const isWetNotDry: CellPick = (c) => c.wet && !c.dry;
/** A body cell not yet rubbed dry (a towel ritual leaves the whole body to dry; `wetness` is not its measure). */
export const isBodyNotDry: CellPick = (c) => c.body && !c.dry;

/**
 * The picked cells as rows, feet to top: each grid row with any picked cell gives one row at its centre, from the
 * leftmost picked cell's left edge to the rightmost's right edge. The lowest row's y is the body's feet and the
 * highest row's y its top (the outline), so the shape ends where the drawing does, not at a cell's middle.
 */
export function rowsOf(shape: Shape, pick: CellPick = isBody): OutlineRow[] {
  const { grid, cells } = shape;
  const rows: OutlineRow[] = [];
  for (let row = 0; row < grid; row++) {
    let left = -1;
    let right = -1;
    for (let col = 0; col < grid; col++) {
      const cell = cells[row * grid + col];
      if (!cell || !pick(cell)) continue;
      if (left < 0) left = col;
      right = col;
    }
    if (left < 0) continue;
    // A cell counts as the body when its CENTRE is in the silhouette, so its outer edge may stand half a cell
    // beyond the drawing: the row's edges are drawn in from the cells' edges toward their centres
    rows.push({ y: (row + 0.5) / grid, left: (left + EDGE_INSET) / grid, right: (right + 1 - EDGE_INSET) / grid });
  }
  if (rows.length === 0) return rows;
  // The body's own rows reach its feet and its top; a part of it keeps its cells' bounds
  if (pick === isBody) {
    rows[0] = { ...rows[0], y: Math.min(rows[0].y, shape.outline.bottom) };
    const top = rows.length - 1;
    rows[top] = { ...rows[top], y: Math.max(rows[top].y, shape.outline.top) };
  }
  return rows;
}

/** The picked cells as a closed, rounded path in the effects' viewBox (for a clipPath); empty when nothing is picked. */
export function shapePath(shape: Shape, pick: CellPick = isBody, pad = 0): string {
  const rows = rowsOf(shape, pick);
  // One row alone cannot make a path: give it a little height so a single wet row still shows
  if (rows.length === 1) {
    const r = rows[0];
    const half = 0.5 / shape.grid;
    return rowsPath([{ ...r, y: r.y - half }, { ...r, y: r.y + half }], pad);
  }
  return rowsPath(rows, pad);
}

/** The outline gives exactly the frame's body cells (a cell is the body when its centre is inside the outline). */
function outlineMatches(shape: Shape, outline: Pick<DrawingOutline, 'silhouette' | 'bottom' | 'top'>): boolean {
  const mask = maskFromOutline({ silhouette: outline.silhouette, bottom: outline.bottom, top: outline.top }, shape.grid);
  return shape.cells.length === mask.length && shape.cells.every((cell, i) => cell.body === mask[i]);
}

/** How many rows of the drawing's own outline the body's clip is built from (finer than the grid's 8). */
export const OUTLINE_CLIP_ROWS = 24;

/**
 * The body's clip: the drawing's own outline when it is known (its edge, so nothing laid on the body is cut off
 * inside the drawing or drawn in the air beside it), else the body cells rounded. The outline is used only when it
 * is the one the frame's body cells were read from (the same mask again); otherwise (the plain body stood in, an
 * outline too thin to hold a cell) the cells are the clip, so the clip never hides a cell the machine counts.
 */
export function bodyPath(shape: Shape, outline?: Pick<DrawingOutline, 'silhouette' | 'bottom' | 'top'> | null): string {
  if (outline && outlineMatches(shape, outline)) {
    const path = rowsPath(outlineRows(outline, OUTLINE_CLIP_ROWS));
    if (path) return path;
  }
  return shapePath(shape, isBody, 0);
}

/** How far inside the drawing's edge a foamed cell's bubble is kept (box units). */
export const FOAM_EDGE_MARGIN = 0.05;

/**
 * Where a foamed cell's bubble is drawn when the clip is the drawing's own outline: its place, moved in just
 * inside the edge when it stands on it (a cell counts when its centre is in the silhouette, so an edge cell's
 * centre may sit on the clip's line), so every counted cell's bubble shows. Box units, y up.
 */
export function insideOutline(
  p: { x: number; y: number },
  outline: Pick<DrawingOutline, 'silhouette' | 'bottom' | 'top'>,
  margin = FOAM_EDGE_MARGIN,
): { x: number; y: number } {
  const height = Math.max(1e-3, outline.top - outline.bottom);
  const y = Math.min(outline.top - margin, Math.max(outline.bottom + margin, p.y));
  const span = outline.silhouette.span((y - outline.bottom) / height);
  if (!span) return { x: p.x, y };
  const left = span.left + 0.5 + margin;
  const right = span.right + 0.5 - margin;
  const x = left > right ? (left + right) / 2 : Math.min(right, Math.max(left, p.x));
  return { x, y };
}

/** The lowest and highest body cell of a column, as y (box units, the cells' outer edges), or null for none. */
export function columnSpan(shape: Shape, col: number, pick: CellPick = isBody): { bottom: number; top: number } | null {
  const { grid, cells } = shape;
  let lowest = -1;
  let highest = -1;
  for (let row = 0; row < grid; row++) {
    const cell = cells[row * grid + col];
    if (!cell || !pick(cell)) continue;
    if (lowest < 0) lowest = row;
    highest = row;
  }
  if (lowest < 0) return null;
  return { bottom: lowest / grid, top: (highest + 1) / grid };
}

/** The body's columns (indices) that have any body cell, left to right. */
export function bodyColumns(shape: Shape): number[] {
  const out: number[] = [];
  for (let col = 0; col < shape.grid; col++) if (columnSpan(shape, col)) out.push(col);
  return out;
}

export interface StreamPlan {
  /** The stream's path in the effects' viewBox (y down). */
  d: string;
  /** Its length in viewBox units, for the dash that flows along it. */
  length: number;
}

/**
 * Thin streams of water running down the body: one along each side (a little in from the edge) and two down the
 * body itself, each following the rows from the body's top to its feet. From the body's rows alone; none for a
 * body of fewer than two rows.
 */
export function streamPlans(shape: Shape, count = 4): StreamPlan[] {
  const rows = rowsOf(shape);
  if (rows.length < 2) return [];
  const sorted = [...rows].sort((a, b) => b.y - a.y);
  const lanes = [0.1, 0.9, 0.36, 0.64].slice(0, Math.max(0, Math.min(4, count)));
  return lanes.map((lane) => {
    const pts = sorted.map((r) => ({ x: (r.left + (r.right - r.left) * lane) * 100, y: (1 - r.y) * 100 }));
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    let length = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      // A soft bend between rows: the water wanders a little as the edge does
      const cx = (a.x + b.x) / 2 + (i % 2 ? 1.5 : -1.5);
      d += ` Q ${cx.toFixed(2)} ${((a.y + b.y) / 2).toFixed(2)}, ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
      length += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return { d, length };
  });
}

export interface DropletPlan {
  /** Its column's centre, box x. */
  x: number;
  /** Where it starts on the body and where the body ends under it (box y); it falls from there to the ground. */
  start: number;
  release: number;
  ground: number;
  /** Its own timing (ms): when it begins, how long the slide and the fall take. */
  delay: number;
  slideMs: number;
  fallMs: number;
}

/**
 * Drops that run down the body and let go at its lowest point under them: `count` of them spread over the body's
 * columns, each starting a little under the body's top in its column, released where the column's lowest body
 * cell ends, and falling to the ground (the body's feet). Deterministic: the same frame plans the same drops.
 */
export function dropletPlans(shape: Shape, count: number): DropletPlan[] {
  const columns = bodyColumns(shape);
  if (columns.length === 0 || count <= 0) return [];
  const plans: DropletPlan[] = [];
  const ground = shape.outline.bottom;
  for (let i = 0; i < count; i++) {
    // Across the body in a spread that never bunches: the golden step, wrapped
    const col = columns[Math.floor(((i * 0.618 + 0.3) % 1) * columns.length)];
    const span = columnSpan(shape, col);
    if (!span) continue;
    const start = span.top - (0.12 + ((i * 7) % 5) * 0.05) * (span.top - span.bottom);
    const release = Math.max(span.bottom, ground);
    plans.push({
      x: (col + 0.5) / shape.grid + (((i * 3) % 3) - 1) * 0.03,
      start,
      release,
      ground,
      delay: (i * 530) % 2100,
      slideMs: 1400 + ((i * 11) % 4) * 220,
      fallMs: 300 + Math.round(Math.max(0, release - ground) * 400),
    });
  }
  return plans;
}

/** The viewBox point (y down) of a box point. */
export const toView = (p: { x: number; y: number }) => ({ x: p.x * 100, y: (1 - p.y) * 100 });

/** Where the shower's drops land: the body's top in the column under a point, or null beside the body. */
export function landingUnder(shape: Shape, x: number): number | null {
  const col = Math.max(0, Math.min(shape.grid - 1, Math.floor(x * shape.grid)));
  return columnSpan(shape, col)?.top ?? null;
}
