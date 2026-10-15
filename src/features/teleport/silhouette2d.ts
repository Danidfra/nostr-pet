/**
 * The 2D drawing's own outline, for a journey: the rendered SVG drawn once,
 * small, onto an offscreen canvas and read row by row. Every generation's
 * artwork (V1, V2, V3) works the same, and what comes back lines up exactly
 * with what is on screen: where the body is across each height, where its
 * feet and its topmost part are in its box, and its colour (for the motes'
 * tint). The canonical SVG is only read, never changed.
 *
 * Without a canvas or an image (a test DOM, a browser that refuses), or for
 * a drawing with nothing in it, there is no outline: the caller falls back
 * to `BLOB_SILHOUETTE` and the whole box.
 */
import type { Silhouette } from './particles';

export interface DrawingOutline {
  silhouette: Silhouette;
  /** The body's feet and top, as fractions of the box's height from its bottom. */
  bottom: number;
  top: number;
  /** The drawing's average colour, `rgb(r, g, b)`. */
  tint: string;
}

/** The raster's side, px: enough rows for a smooth edge, few enough to read in a blink. */
const RASTER = 96;
const ALPHA = 80;

/** Rows of a raster's alpha into an outline; exported for tests (no canvas needed). */
export function outlineFromAlpha(data: Uint8ClampedArray, size: number): DrawingOutline | null {
  const rows: ({ left: number; right: number } | null)[] = [];
  let top = -1;
  let bottom = -1;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = 0; y < size; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      if (left < 0) left = x;
      right = x;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
    rows.push(left < 0 ? null : { left: (left + 0.5) / size - 0.5, right: (right + 0.5) / size - 0.5 });
    if (left >= 0) {
      if (top < 0) top = y;
      bottom = y;
    }
  }
  if (top < 0 || bottom <= top) return null;
  const bodyTop = top;
  const bodyBottom = bottom;
  const silhouette: Silhouette = {
    span(h) {
      if (h < 0 || h > 1) return null;
      // h 0 is the feet (the lowest row), 1 the top
      const y = Math.round(bodyBottom - h * (bodyBottom - bodyTop));
      return rows[Math.min(size - 1, Math.max(0, y))] ?? null;
    },
  };
  return {
    silhouette,
    bottom: 1 - (bodyBottom + 1) / size,
    top: 1 - bodyTop / size,
    tint: n ? `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})` : 'rgb(255, 255, 255)',
  };
}

/** Read a rendered SVG's outline. Resolves null when it cannot be read. */
export async function readDrawingOutline(svg: SVGSVGElement | null): Promise<DrawingOutline | null> {
  if (!svg || typeof document === 'undefined' || typeof XMLSerializer === 'undefined' || typeof Image === 'undefined') return null;
  try {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(RASTER));
    clone.setAttribute('height', String(RASTER));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const markup = new XMLSerializer().serializeToString(clone);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    const image = new Image();
    const loaded = new Promise<boolean>((resolve) => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
    });
    image.src = url;
    if (!(await loaded)) return null;
    const canvas = document.createElement('canvas');
    canvas.width = RASTER;
    canvas.height = RASTER;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, RASTER, RASTER);
    return outlineFromAlpha(ctx.getImageData(0, 0, RASTER, RASTER).data, RASTER);
  } catch {
    return null;
  }
}

// ─── Rows and a path (M15 care: the bath's effects clipped to the body) ─────

/** One row of an outline across the box: its height (a fraction from the box's bottom) and the body's edges there (x, 0 left to 1 right). */
export interface OutlineRow {
  y: number;
  left: number;
  right: number;
}

/**
 * An outline as rows, feet to top: `rows` heights evenly through the body (the first at its feet, the last at its
 * top), each with the body's edges there in box x (0..1). A height with no span is skipped; a body too thin for
 * a row gives none.
 */
export function outlineRows(outline: Pick<DrawingOutline, 'silhouette' | 'bottom' | 'top'>, rows: number): OutlineRow[] {
  const out: OutlineRow[] = [];
  const n = Math.max(2, Math.floor(rows));
  const height = Math.max(1e-3, outline.top - outline.bottom);
  for (let i = 0; i < n; i++) {
    const h = i / (n - 1);
    const span = outline.silhouette.span(h);
    if (!span) continue;
    out.push({ y: outline.bottom + h * height, left: span.left + 0.5, right: span.right + 0.5 });
  }
  return out;
}

/**
 * A closed, rounded SVG path through rows (feet to top), in a 100 × 100 box with y DOWN (the bath's effects
 * viewBox): up the right edge and down the left, each edge a smooth curve through its points, grown by `pad`
 * (box fractions) all round. Fewer than two rows give an empty path (nothing is clipped in).
 */
export function rowsPath(rows: readonly OutlineRow[], pad = 0): string {
  if (rows.length < 2) return '';
  const sorted = [...rows].sort((a, b) => a.y - b.y);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const pt = (x: number, y: number) => ({ x: x * 100, y: (1 - y) * 100 });
  const points = [
    // Under the feet and over the top: the ends close in to the middle so the shape rounds off there
    pt((first.left + first.right) / 2, first.y - pad),
    ...sorted.map((r) => pt(r.right + pad, r.y)),
    pt((last.left + last.right) / 2, last.y + pad),
    ...[...sorted].reverse().map((r) => pt(r.left - pad, r.y)),
  ];
  return smoothClosed(points);
}

/** A closed Catmull-Rom spline through points as cubic Béziers (2 decimals). */
function smoothClosed(points: { x: number; y: number }[]): string {
  const n = points.length;
  const f = (v: number) => v.toFixed(2);
  let d = `M ${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${f(c1.x)} ${f(c1.y)}, ${f(c2.x)} ${f(c2.y)}, ${f(p2.x)} ${f(p2.y)}`;
  }
  return `${d} Z`;
}
