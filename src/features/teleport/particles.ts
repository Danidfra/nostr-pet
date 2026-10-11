/**
 * The motes a journey breaks into, as one field both drawings draw: each
 * mote's place, brightness and size at a moment, from its index alone (a
 * seeded hash, no randomness at draw time, so a frame is the same however
 * often or late it is drawn, and a reversed journey is continuous).
 *
 * Coordinates are the body's own: `x` across, in box widths from the body's
 * axis (−0.5..0.5 is the art box); `y` up, in body heights from its feet
 * (0 feet, 1 the top of its tallest part; motes rise above 1). The drawing
 * maps them to pixels, the model to its units.
 *
 *   departure   each mote is BORN ON THE DISSOLVING EDGE: at the height it
 *               belongs to, at the moment the edge passes that height,
 *               somewhere across the outline there (`Silhouette`); then it
 *               rises, faster and faster, drifting a little, all the way up
 *               and OUT THROUGH THE TOP of the view (`ceiling`), fading only
 *               as it goes. A few early sparkles rise from the body while it
 *               gathers itself.
 *   arrival     each mote comes in from JUST PAST THE TOP of the view, wide,
 *               falls through it and narrows to LAND ON THE FORMING EDGE
 *               exactly when the edge reaches its height, and is absorbed
 *               there with a small flash. Their starts are staggered by when
 *               they land, so the stream is continuous from the first mote
 *               to the last, the last settling into the top of the head.
 *
 * The `ceiling` is where the view's top edge is, in body heights above the
 * feet: each drawing measures it for itself (the 2D one from the page, the
 * 3D one by projecting through the room's camera), so the motes span the
 * same share of the screen however big the view, wherever the Blobbi
 * stands, adult or baby. Without one, a modest height is assumed.
 *
 * Reversal: a journey turned back hands its motes on. Each mote of the old
 * journey that was already on its way keeps going (`bornBefore`) while the
 * new journey's begin, and the drawing fades the old ones out: nothing pops
 * and nothing is drawn twice.
 */
import { DEPART, arriveCutAt, arriveTimeAtHeight, departTimeAtHeight, type JourneyKind } from './timeline';

/** How many motes a journey has. Restrained on purpose: readable on a phone, cheap anywhere. */
export const MOTE_COUNT = 96;
/** How long a landed mote flashes as the body takes it in. */
const LANDING_FLASH_MS = 90;
/** Early sparkles while gathering, of the departure's motes. */
const SPARKLES = 10;

/** The body's outline: for a height (0 feet .. 1 top), where it spans across (box widths from the axis). */
export interface Silhouette {
  span(h: number): { left: number; right: number } | null;
}

/** A plain blob's outline, for when nothing better is known: an egg-ish ellipse a little over half the box wide. */
export const BLOB_SILHOUETTE: Silhouette = {
  span(h) {
    if (h < 0 || h > 1) return null;
    const half = 0.28 * Math.sqrt(Math.max(0, 1 - ((h - 0.45) / 0.55) ** 2));
    return half > 0.005 ? { left: -half, right: half } : null;
  },
};

export interface Mote {
  /** Which mote it is (stable for a journey): to find where it was a moment ago, for its trail. */
  index: number;
  x: number;
  y: number;
  /** 0..1 */
  alpha: number;
  /** In box widths. */
  size: number;
  /** 0..1: how white-hot (1) versus tinted (0) it is. */
  heat: number;
  /** Which depth layer it belongs to (0..1), for a 3D drawing to spread motes round the body. */
  depth: number;
}

/** A stable pseudo-random number in [0, 1) for a mote and a channel. */
function hash(i: number, channel: number): number {
  let x = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(channel + 7, 0x85ebca6b);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  x = Math.imul(x, 0x297a2d39);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Where across the outline at height `h` a mote lands, from its seed (a little in from the edges, so motes read as the body). */
function across(silhouette: Silhouette, h: number, u: number): number {
  const span = silhouette.span(h) ?? silhouette.span(clamp01(h - 0.04)) ?? { left: -0.05, right: 0.05 };
  const inset = (span.right - span.left) * 0.06;
  return span.left + inset + (span.right - span.left - 2 * inset) * u;
}

export interface MoteOptions {
  /** The view's top edge, body heights above the feet. */
  ceiling?: number;
  /** Only motes already on their way before this time (ms of the journey): a turned-back journey's, finishing. */
  bornBefore?: number;
}

/** Where the top of the view is assumed to be when a drawing does not say (body heights above the feet). */
export const DEFAULT_CEILING = 2.6;
/** How long a mote's trail is, in ms of its flight. */
export const TRAIL_MS = 45;

/** Every mote that shows at `t` ms of a journey (the dead and the unborn are left out). */
export function motesAt(kind: JourneyKind, t: number, silhouette: Silhouette, options: MoteOptions = {}): Mote[] {
  const ceiling = Math.max(1.4, options.ceiling ?? DEFAULT_CEILING);
  const bornBefore = options.bornBefore ?? Infinity;
  const motes: Mote[] = [];
  for (let i = 0; i < MOTE_COUNT; i++) {
    const m = kind === 'depart' ? departMote(i, t, silhouette, ceiling, bornBefore) : arriveMote(i, t, silhouette, ceiling, bornBefore);
    if (m && m.alpha > 0.01) motes.push(m);
  }
  return motes;
}

function departMote(i: number, t: number, silhouette: Silhouette, ceiling: number, bornBefore: number): Mote | null {
  const u = hash(i, 1);
  const drift = (hash(i, 2) - 0.5) * 0.12;
  const sizeSeed = hash(i, 3);
  const depth = hash(i, 5);
  if (i < SPARKLES) {
    // Early sparkles: lifting off the body while it gathers, slow
    const born = 120 + hash(i, 4) * (DEPART.gather - 200);
    if (born >= bornBefore) return null;
    const age = t - born;
    if (age < 0 || age > 700) return null;
    const h0 = 0.2 + hash(i, 6) * 0.75;
    const k = age / 700;
    return { index: i, x: across(silhouette, h0, u) + drift * k, y: h0 + 0.35 * k, alpha: Math.sin(Math.PI * k) * 0.8, size: 0.02 + 0.012 * sizeSeed, heat: 0.6, depth };
  }
  // Born on the edge where the dissolve passes its height; heights spread evenly so the edge is never bare
  const h = clamp01((i - SPARKLES + hash(i, 4)) / (MOTE_COUNT - SPARKLES));
  const born = departTimeAtHeight(h);
  if (born >= bornBefore) return null;
  // Long enough to leave through the top, and gone by the journey's end (the last ones, from the feet, fly fastest)
  const life = Math.max(380, Math.min(620 + hash(i, 6) * 480, DEPART.total + 40 - born));
  const age = t - born;
  if (age < 0 || age > life) return null;
  const k = age / life;
  // Rising, faster and faster: a lift off the edge, then away to past the top of the view
  const away = (ceiling + 0.35 - h) * (0.9 + hash(i, 7) * 0.3);
  const rise = 0.1 * k + away * k * k * (0.6 + 0.4 * k);
  const flash = Math.max(0, 1 - age / 90);
  // Fading only as it leaves (or, for one that lives out its time in view, at its very end)
  const leaving = 1 - smoothstep(0.82, 1, k);
  const spread = drift * (1 + 6 * k * k) + (u - 0.5) * 0.08 * k * k * ceiling * 0.25;
  return {
    index: i,
    x: across(silhouette, h, u) + spread,
    y: h + rise,
    alpha: Math.min(1, 0.6 + flash) * leaving,
    size: (0.022 + 0.024 * sizeSeed) * (1 - 0.35 * k),
    heat: Math.max(flash, 0.55 * (1 - k) + 0.15),
    depth,
  };
}

function arriveMote(i: number, t: number, silhouette: Silhouette, ceiling: number, bornBefore: number): Mote | null {
  const u = hash(i, 11);
  const sizeSeed = hash(i, 13);
  const depth = hash(i, 15);
  // Where and when it lands: its height on the body, when the forming edge reaches it
  const h = clamp01((i + hash(i, 14)) / MOTE_COUNT);
  const lands = arriveTimeAtHeight(h);
  // It sets off from just past the top of the view, long enough before landing to be seen coming down the whole way,
  // never before the journey starts (the first ones are already on their way in as it begins)
  const flight = Math.min(lands, 520 + hash(i, 17) * 420);
  const start = lands - flight;
  if (start >= bornBefore) return null;
  const age = t - start;
  const target = across(silhouette, h, u);
  if (age < 0) return null;
  if (age <= flight) {
    const k = age / flight;
    const from = ceiling + 0.15 + hash(i, 16) * 0.45;
    // Falling the whole height, easing onto the edge; converging from a spread that is wider the higher it is
    const toGo = (1 - k) ** 1.7;
    const spread = (hash(i, 18) - 0.5) * Math.min(1.6, 0.35 + 0.12 * ceiling);
    return { index: i, x: target + spread * (1 - k) ** 2, y: h + (from - h) * toGo, alpha: clamp01(k * 5) * 0.95, size: (0.02 + 0.022 * sizeSeed) * (0.75 + 0.25 * k), heat: 0.4 + 0.5 * k, depth };
  }
  // Landed: a small flash as the body takes it in
  // Short: the edge rises on, and the flash should stay a spark where it landed
  const after = age - flight;
  if (after > LANDING_FLASH_MS) return null;
  const k = after / LANDING_FLASH_MS;
  // It rides the forming edge as it fades: every spark sits on the line of light where the body is being made
  return { index: i, x: target, y: Math.max(h, arriveCutAt(t)), alpha: 1 - k, size: (0.028 + 0.018 * sizeSeed) * (1 - 0.5 * k), heat: 1, depth };
}

function smoothstep(a: number, b: number, x: number): number {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
}

/**
 * The motes a drawing shows now, current and handed on: the current
 * journey's, and (for a moment after it was turned back) the previous
 * journey's that were already on their way, fading out. A shared rule so
 * the 2D and 3D drawings hand over alike.
 */
export interface MoteLayer {
  kind: JourneyKind;
  t: number;
  /** 0..1, how much of the layer shows. */
  fade: number;
  bornBefore?: number;
}

/** How long a turned-back journey's motes take to fade (ms). */
export const HANDOVER_MS = 420;

export function moteLayers(current: { kind: JourneyKind; t: number } | null, previous: { kind: JourneyKind; startedAt: number; endedAt: number } | null, now: number): MoteLayer[] {
  const layers: MoteLayer[] = [];
  if (previous) {
    const since = now - previous.endedAt;
    if (since >= 0 && since < HANDOVER_MS) {
      layers.push({ kind: previous.kind, t: now - previous.startedAt, fade: 1 - since / HANDOVER_MS, bornBefore: previous.endedAt - previous.startedAt });
    }
  }
  if (current) layers.push({ kind: current.kind, t: current.t, fade: 1 });
  return layers;
}
