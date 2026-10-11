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
