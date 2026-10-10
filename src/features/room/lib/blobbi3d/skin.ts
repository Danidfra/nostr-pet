/**
 * The body's markings, painted onto a texture wrapped around the lofted
 * body: the belly patch, the spots, the stripes, the pattern gradient, the
 * special mark and the freckles, each at the place and size the kit's
 * geometry states for the front or the back view. Nothing is positioned by
 * hand here; the only thing of the kit's that is restated is the outline of
 * the four special-mark glyphs (its `MARK_SHAPES` are not exported).
 *
 * The texture's u runs around the body (0 and 1 at the back, 0.5 at the
 * belly, so the belly never crosses the seam), v from the ground up.
 */
import * as THREE from 'three';
import type { BlobbiPalette, FrontGeometry } from '@blobbi-kit/renderer/procedural';
import { samplePath, type Pt } from './svg-path';
import { U, type Frame } from './units';
import type { Ring } from './surface';

export interface SurfaceMap {
  frame: Frame;
  ringAt(f: number): Ring;
  fractionOf(yRoot: number): number;
  phiOf(s: number): number;
}

type UV = [number, number];

const WIDTH = 1024;
const HEIGHT = 512;

/** The kit's special-mark glyphs in a unit box (`svg.js` MARK_SHAPES). */
const STAR = (() => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.92 : 0.43;
    const a = ((-90 + i * 36) * Math.PI) / 180;
    d += `${i === 0 ? 'M' : 'L'} ${(r * Math.cos(a)).toFixed(3)},${(r * Math.sin(a)).toFixed(3)} `;
  }
  return `${d}Z`;
})();
const MARK_SHAPES: Record<string, string> = {
  star: STAR,
  heart: 'M 0,0.92 C -0.55,0.48 -1,0.1 -1,-0.36 C -1,-0.72 -0.74,-0.95 -0.46,-0.95 C -0.25,-0.95 -0.08,-0.83 0,-0.64 C 0.08,-0.83 0.25,-0.95 0.46,-0.95 C 0.74,-0.95 1,-0.72 1,-0.36 C 1,0.1 0.55,0.48 0,0.92 Z',
  sparkle: 'M 0,-1 Q 0.17,-0.17 1,0 Q 0.17,0.17 0,1 Q -0.17,0.17 -1,0 Q -0.17,-0.17 0,-1 Z',
  moon: 'M 0.66,-0.751 A 1 1 0 1 0 0.66,0.751 A 0.78 0.78 0 1 1 0.66,-0.751 Z',
};

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Points around an ellipse in root units. */
function ellipsePoints(e: { cx: number; cy: number; rx: number; ry: number; rotation?: number }, steps = 40): Pt[] {
  const r = ((e.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const out: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = e.rx * Math.cos(t);
    const y = e.ry * Math.sin(t);
    out.push({ x: e.cx + x * cos - y * sin, y: e.cy + x * sin + y * cos });
  }
  return out;
}

/**
 * Paint the markings, or null where there is no 2D canvas to paint on (a
 * test runtime); the body is then its gradient alone.
 */
export function paintMarkings(front: FrontGeometry, back: FrontGeometry, surface: SurfaceMap, palette: BlobbiPalette): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return null;
  const c = ctx;
  const { frame } = surface;

  /** A front- or back-view root point on the texture. */
  const map = (view: 'front' | 'back') => (p: Pt): UV => {
    const f = surface.fractionOf(p.y);
    const ring = surface.ringAt(f);
    const xm = (p.x - frame.axisX) * U;
    const s = Math.max(-1, Math.min(1, (xm - ring.cx) / ring.a));
    // Seen from behind, screen-right is the Blobbi's left
    const phi = view === 'front' ? surface.phiOf(s) : Math.PI + surface.phiOf(s);
    return [(phi + Math.PI) / (2 * Math.PI), f];
  };
  const px = ([u, v]: UV, shift: number): [number, number] => [(u + shift) * WIDTH, (1 - v) * HEIGHT];

  /** Fill a polygon, drawn at every wrap so a shape over the seam stays whole. */
  const fill = (uvs: UV[], paint: string | CanvasGradient, alpha: number) => {
    if (uvs.length < 3) return;
    for (const shift of [-1, 0, 1]) {
      c.beginPath();
      uvs.forEach((uv, i) => {
        const [x, y] = px(uv, shift);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      c.closePath();
      c.globalAlpha = alpha;
      c.fillStyle = paint;
      c.fill();
    }
    c.globalAlpha = 1;
  };

  const paintView = (geo: FrontGeometry, view: 'front' | 'back') => {
    const to = map(view);
    const { markings } = geo;
    if (markings.gradient && view === 'front') {
      const top = (1 - surface.fractionOf(markings.gradient.y0)) * HEIGHT;
      const bottom = (1 - surface.fractionOf(markings.gradient.y1)) * HEIGHT;
      const g = c.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, rgba(palette.marking, 0));
      g.addColorStop(0.55, rgba(palette.marking, markings.gradient.strength * 0.72));
      g.addColorStop(1, rgba(palette.marking, markings.gradient.strength));
      c.fillStyle = g;
      c.fillRect(0, top, WIDTH, HEIGHT - top);
    }
    if (markings.belly?.ellipse && view === 'front') {
      const e = markings.belly.ellipse;
      const centre = to({ x: e.cx, y: e.cy });
      const uvs = ellipsePoints(e).map(to);
      const [cx, cy] = px(centre, 0);
      const radius = Math.max(...uvs.map((uv) => Math.hypot(...px(uv, 0).map((v, i) => v - [cx, cy][i]))));
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, radius);
      g.addColorStop(0, rgba(palette.belly, 1));
      g.addColorStop(0.55, rgba(palette.belly, 0.7));
      g.addColorStop(1, rgba(palette.belly, 0));
      fill(uvs, g, markings.belly.opacity ?? 1);
    }
    for (const band of markings.stripes) {
      for (const poly of samplePath(band, 6)) fill(poly.points.map(to), palette.marking, markings.stripeOpacity);
    }
    for (const spot of markings.marks) fill(ellipsePoints(spot).map(to), palette.marking, markings.markOpacity);
    if (markings.mark) {
      const mark = markings.mark;
      const d = MARK_SHAPES[mark.kind];
      if (d) {
        const rot = (mark.rotation * Math.PI) / 180;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        // The kit's transform: translate(cx cy) scale(squash 1) rotate(rotation) scale(r)
        const place = (p: Pt): Pt => {
          const x = p.x * mark.r;
          const y = p.y * mark.r;
          return { x: mark.cx + (x * cos - y * sin) * mark.squash, y: mark.cy + (x * sin + y * cos) };
        };
        for (const poly of samplePath(d, 8)) fill(poly.points.map(place).map(to), palette.mark, 0.92);
      }
    }
    for (const freckle of markings.freckles) fill(ellipsePoints({ cx: freckle.cx, cy: freckle.cy, rx: freckle.r, ry: freckle.r }, 16).map(to), palette.marking, markings.freckleOpacity);
  };

  paintView(front, 'front');
  paintView(back, 'back');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
