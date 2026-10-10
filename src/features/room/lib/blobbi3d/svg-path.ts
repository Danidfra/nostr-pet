/**
 * Sample the kit's SVG path strings into polylines. The procedural geometry
 * states curves (an arm, a brow, a mouth, a stripe, an ear) as absolute path
 * data with M, L, C, Q, A and Z only, which is all this reads; anything else
 * is a loud error rather than a silently wrong shape.
 */
export interface Pt {
  x: number;
  y: number;
}

export interface Polyline {
  points: Pt[];
  closed: boolean;
}

const TOKEN = /([A-Za-z])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g;

function cubic(p0: Pt, c1: Pt, c2: Pt, p1: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
  };
}

function quadratic(p0: Pt, c: Pt, p1: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y };
}

function angle(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  const a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
  return ux * vy - uy * vx < 0 ? -a : a;
}

/** Points along an SVG elliptical arc (SVG 1.1 §F.6.5), the start excluded. */
function arc(p0: Pt, rx: number, ry: number, rotation: number, large: boolean, sweep: boolean, p1: Pt, steps: number): Pt[] {
  if (rx === 0 || ry === 0 || (p0.x === p1.x && p0.y === p1.y)) return [p1];
  const phi = (rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (p0.x - p1.x) / 2;
  const dy = (p0.y - p1.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coef = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1) / ry;
  const cyp = (-coef * ry * x1) / rx;
  const cx = cos * cxp - sin * cyp + (p0.x + p1.x) / 2;
  const cy = sin * cxp + cos * cyp + (p0.y + p1.y) / 2;
  const theta = angle(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let delta = angle((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const out: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = theta + (delta * i) / steps;
    out.push({ x: cos * rx * Math.cos(t) - sin * ry * Math.sin(t) + cx, y: sin * rx * Math.cos(t) + cos * ry * Math.sin(t) + cy });
  }
  out[out.length - 1] = p1;
  return out;
}

/** The subpaths of `d` as polylines, each curve sampled into `steps` segments. */
export function samplePath(d: string, steps = 10): Polyline[] {
  const out: Polyline[] = [];
  let current: Polyline | null = null;
  let pen: Pt = { x: 0, y: 0 };
  let command = '';
  const numbers: number[] = [];
  const flush = () => {
    if (!command) return;
    const take = (n: number) => numbers.splice(0, n);
    while (numbers.length > 0 || command === 'Z') {
      switch (command) {
        case 'M': {
          const [x, y] = take(2);
          pen = { x, y };
          current = { points: [pen], closed: false };
          out.push(current);
          command = 'L';
          break;
        }
        case 'L': {
          const [x, y] = take(2);
          pen = { x, y };
          current!.points.push(pen);
          break;
        }
        case 'C': {
          const [x1, y1, x2, y2, x, y] = take(6);
          const p0 = pen;
          for (let i = 1; i <= steps; i++) current!.points.push(cubic(p0, { x: x1, y: y1 }, { x: x2, y: y2 }, { x, y }, i / steps));
          pen = { x, y };
          break;
        }
        case 'Q': {
          const [x1, y1, x, y] = take(4);
          const p0 = pen;
          for (let i = 1; i <= steps; i++) current!.points.push(quadratic(p0, { x: x1, y: y1 }, { x, y }, i / steps));
          pen = { x, y };
          break;
        }
        case 'A': {
          const [rx, ry, rotation, large, sweep, x, y] = take(7);
          current!.points.push(...arc(pen, rx, ry, rotation, large !== 0, sweep !== 0, { x, y }, steps));
          pen = { x, y };
          break;
        }
        case 'Z': {
          if (current) {
            current.closed = true;
            pen = current.points[0];
          }
          command = '';
          return;
        }
        default:
          throw new Error(`Unsupported path command "${command}"`);
      }
      if (!current) throw new Error('Path data must start with M');
    }
  };
  for (const match of d.matchAll(TOKEN)) {
    if (match[1]) {
      flush();
      command = match[1];
      if (command === 'Z') flush();
    } else {
      numbers.push(Number(match[2]));
    }
  }
  flush();
  return out;
}

/** The axis-aligned box of some points. */
export function boundsOf(points: readonly Pt[]): { x1: number; y1: number; x2: number; y2: number } {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of points) {
    if (p.x < x1) x1 = p.x;
    if (p.y < y1) y1 = p.y;
    if (p.x > x2) x2 = p.x;
    if (p.y > y2) y2 = p.y;
  }
  return { x1, y1, x2, y2 };
}
