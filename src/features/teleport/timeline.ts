/**
 * A Blobbi's journey between worlds, as choreography: time in, a frame out.
 * Renderer-free and app-free (no React, no DOM, no three.js, no Nostr), so
 * the same timeline drives the 2D drawing and the 3D model alike, and can
 * move into blobbi-kit as it is.
 *
 * DEPARTURE (it sends itself somewhere else)
 *   gather    it stops, shuts its eyes tight, brows down, and squeezes down a
 *             little, gathering itself; a soft glow comes up
 *   dissolve  it comes apart from the TOP DOWN: the head first, the feet last;
 *             each slice breaks into glowing motes that rise away
 *   gone      the last motes speed upward and fade; nothing is left
 *
 * ARRIVAL (the same, run the other way)
 *   incoming  motes come down from above toward where it will stand
 *   form      it builds from the BOTTOM UP: feet, body, then head and
 *             appendages; the motes land on the forming edge; eyes shut tight
 *   hold      solid, still concentrating a moment
 *   open      the eyes open; a relieved, happy face and a little hop:
 *             "it worked!"
 *
 * Under reduced motion each is a short, gentle fade with no motes and no
 * squash; the face still closes and opens.
 *
 * Times are milliseconds from the start of a journey. `cut` is how much of
 * the body is there, measured from its BOTTOM (1 whole, 0 gone): a departure
 * takes it from 1 to 0 (top down), an arrival from 0 to 1 (bottom up).
 */

export type JourneyKind = 'depart' | 'arrive';

export type JourneyPhase = 'gather' | 'dissolve' | 'gone' | 'incoming' | 'form' | 'hold' | 'open' | 'done';

/** The face a frame asks for: concentrating (eyes shut tight) or relieved (the happy face), or the Blobbi's own. */
export type JourneyFace = 'concentrate' | 'relieved' | null;

/** A sound cue, by meaning; the app plays it (or not: muted, hidden). */
export type JourneyCue = 'gather' | 'rise' | 'descend' | 'tada';

export interface JourneyFrame {
  kind: JourneyKind;
  phase: JourneyPhase;
  /** 0..1 over the whole journey. */
  progress: number;
  /** How much of the body is there, from the bottom: 1 whole, 0 gone. */
  cut: number;
  /** How soft the dissolving edge is, as a fraction of the body's height. */
  edge: number;
  /** Squash about the ground: widths and heights as multiples of the rest pose. */
  sx: number;
  sy: number;
  /** 0..1: the body's own glow (gathering energy, forming). */
  glow: number;
  /** 0..1: the bright line along the dissolving edge. */
  edgeGlow: number;
  /** Eyes shut tight, as concentrating. */
  eyesClosed: boolean;
  face: JourneyFace;
  /** Whole-body opacity (reduced motion fades instead of dissolving). */
  opacity: number;
  /** Motes are drawn at all (none under reduced motion). */
  motes: boolean;
  /** The arrival's little hop starts at this frame's time (once). */
  hop: boolean;
}

/** The phases' boundaries, ms. */
export const DEPART = { gather: 650, dissolve: 1_800, total: 2_300 } as const;
export const ARRIVE = { incoming: 550, form: 1_700, hold: 2_000, total: 2_600 } as const;
/** Reduced motion: a short fade each way. */
export const REDUCED = { total: 450 } as const;

/** When each cue sounds, from the journey's start. */
export const CUES: Record<JourneyKind, { at: number; cue: JourneyCue }[]> = {
  depart: [
    { at: 0, cue: 'gather' },
    { at: DEPART.gather, cue: 'rise' },
  ],
  arrive: [
    { at: 0, cue: 'descend' },
    { at: ARRIVE.hold, cue: 'tada' },
  ],
};
export const REDUCED_CUES: Record<JourneyKind, { at: number; cue: JourneyCue }[]> = {
  depart: [{ at: 0, cue: 'rise' }],
  arrive: [{ at: REDUCED.total, cue: 'tada' }],
};

export function journeyDuration(kind: JourneyKind, reduced = false): number {
  if (reduced) return REDUCED.total;
  return kind === 'depart' ? DEPART.total : ARRIVE.total;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Ease in and out (smootherstep): the dissolve starts and ends gently. */
export const smoother = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
const easeIn = (t: number) => clamp01(t) ** 2;

/** The dissolve's cut over its window: the share of the window that has passed, eased. Shared so particles are born where the cut is. */
export function departCutAt(t: number): number {
  return 1 - smoother((t - DEPART.gather) / (DEPART.dissolve - DEPART.gather));
}
export function arriveCutAt(t: number): number {
  return smoother((t - ARRIVE.incoming) / (ARRIVE.form - ARRIVE.incoming));
}

/** When the dissolve passes a height (0 feet .. 1 top): the departure's mirror, used to time each mote. */
export function departTimeAtHeight(h: number): number {
  return DEPART.gather + inverseSmoother(1 - clamp01(h)) * (DEPART.dissolve - DEPART.gather);
}
export function arriveTimeAtHeight(h: number): number {
  return ARRIVE.incoming + inverseSmoother(clamp01(h)) * (ARRIVE.form - ARRIVE.incoming);
}

/** smoother is monotonic on [0, 1]: invert it by bisection (a few dozen steps, exact enough for a frame). */
export function inverseSmoother(y: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (smoother(mid) < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const REST = { sx: 1, sy: 1 };
/** How far it squeezes down gathering itself (a tenth of its height; it widens by 0.7 of that). */
const GATHER_SQUEEZE = -0.1;

/** The frame of a journey at `t` ms. */
export function journeyFrame(kind: JourneyKind, t: number, reduced = false): JourneyFrame {
  if (reduced) return reducedFrame(kind, t);
  return kind === 'depart' ? departFrame(t) : arriveFrame(t);
}

function departFrame(t: number): JourneyFrame {
  const base = { kind: 'depart' as const, progress: clamp01(t / DEPART.total), edge: 0.06, opacity: 1, motes: true, hop: false, eyesClosed: true, face: 'concentrate' as const };
  if (t < DEPART.gather) {
    // Gathering itself: squeeze down about the ground, glow coming up
    const e = easeOut(t / DEPART.gather);
    return { ...base, phase: 'gather', cut: 1, sx: 1 - 0.7 * GATHER_SQUEEZE * e, sy: 1 + GATHER_SQUEEZE * e, glow: 0.55 * e, edgeGlow: 0 };
  }
  if (t < DEPART.dissolve) {
    const k = (t - DEPART.gather) / (DEPART.dissolve - DEPART.gather);
    // Released into the beam: a damped spring from exactly the gathered squeeze, up through a stretch, settling
    const d = GATHER_SQUEEZE * Math.cos(10 * k) * Math.exp(-5 * k);
    return { ...base, phase: 'dissolve', cut: departCutAt(t), sx: 1 - 0.7 * d, sy: 1 + d, glow: 0.55 + 0.3 * Math.sin(Math.PI * k), edgeGlow: 1 };
  }
  if (t < DEPART.total) {
    return { ...base, phase: 'gone', cut: 0, ...REST, glow: 0, edgeGlow: 0 };
  }
  return { ...base, phase: 'done', progress: 1, cut: 0, ...REST, glow: 0, edgeGlow: 0, eyesClosed: false, face: null, motes: false };
}

function arriveFrame(t: number): JourneyFrame {
  const base = { kind: 'arrive' as const, progress: clamp01(t / ARRIVE.total), edge: 0.06, opacity: 1, motes: true, hop: false };
  if (t < ARRIVE.incoming) {
    return { ...base, phase: 'incoming', cut: 0, ...REST, glow: 0.4, edgeGlow: 0, eyesClosed: true, face: 'concentrate' };
  }
  if (t < ARRIVE.form) {
    const k = (t - ARRIVE.incoming) / (ARRIVE.form - ARRIVE.incoming);
    // Forming upward with a slight stretch that settles as the head appears
    return { ...base, phase: 'form', cut: arriveCutAt(t), sx: 1 - 0.03 * (1 - k), sy: 1 + 0.05 * (1 - k), glow: 0.75 - 0.2 * k, edgeGlow: 1, eyesClosed: true, face: 'concentrate' };
  }
  if (t < ARRIVE.hold) {
    // Whole, still concentrating; a small squeeze as it settles, the glow going
    const k = (t - ARRIVE.form) / (ARRIVE.hold - ARRIVE.form);
    const squeeze = Math.sin(Math.PI * k);
    return { ...base, phase: 'hold', cut: 1, sx: 1 + 0.03 * squeeze, sy: 1 - 0.04 * squeeze, glow: 0.55 * (1 - easeIn(k)), edgeGlow: 0, eyesClosed: true, face: 'concentrate' };
  }
  if (t < ARRIVE.total) {
    return { ...base, phase: 'open', cut: 1, ...REST, glow: 0, edgeGlow: 0, eyesClosed: false, face: 'relieved', motes: false, hop: t - ARRIVE.hold < 17 };
  }
  return { ...base, phase: 'done', progress: 1, cut: 1, ...REST, glow: 0, edgeGlow: 0, eyesClosed: false, face: 'relieved', motes: false };
}

function reducedFrame(kind: JourneyKind, t: number): JourneyFrame {
  const k = clamp01(t / REDUCED.total);
  const done = t >= REDUCED.total;
  const opacity = kind === 'depart' ? 1 - easeIn(k) : easeOut(k);
  return {
    kind,
    phase: done ? 'done' : kind === 'depart' ? 'dissolve' : 'form',
    progress: k,
    cut: kind === 'depart' ? (done ? 0 : 1) : 1,
    edge: 0,
    ...REST,
    glow: 0,
    edgeGlow: 0,
    eyesClosed: !done,
    face: done ? (kind === 'arrive' ? 'relieved' : null) : 'concentrate',
    opacity: done ? (kind === 'depart' ? 0 : 1) : opacity,
    motes: false,
    hop: false,
  };
}
