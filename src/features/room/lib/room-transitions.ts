/**
 * How the Blobbi changes rooms: a small repertoire of short scenes, chosen
 * by context and played by one runner (`useRoomTransitions`) on whichever
 * drawing is showing. Pure: a scene is a function of time, so it can be
 * scrubbed, replayed and tested without a renderer.
 *
 *   quick        (most room changes; ~0.4 s) the room returns briskly, the
 *                Blobbi drops in with a little bounce
 *   big-jump     (a first visit) it crouches, leaps far out of view, the new
 *                room folds together under it, it comes down, lands, and
 *                looks about curiously
 *   outside      (a first visit) it walks off the edge of the floor, turns to
 *                watch the new room build itself, and walks back in
 *   floor-gag    (now and then) it strolls off the front edge onto a floor
 *                that is not there, notices, looks down, looks at the player
 *                ("uh oh"), drops out of view, and falls into the new room
 *                from the top of the screen, lands, and shakes it off
 *   behind-wall  (now and then) it scurries round the end of one wall and
 *                pops out from behind the other, in the new room
 *   fade         (reduced motion) the new room is simply there
 *
 * Every scene ends with the Blobbi standing on the floor of the new room
 * where it was going (`to`, a valid spot the runner resolves at the swap),
 * so the scene's freedom (off the floor, behind a wall, up in the air) never
 * outlasts it. `swapAtMs` is when the new room comes on screen, and with
 * which `intro`.
 */
import type { BlobbiSoundId } from '@/features/sound/sounds';
import type { ExpressionName } from '@/features/expression/faces';
import type { RoomIntro } from './scene/RoomScene';
import { CAMERA_AZIMUTH, ROOM_GRID } from './room-geometry';

export type TransitionKind = 'quick' | 'fade' | 'big-jump' | 'outside' | 'floor-gag' | 'behind-wall';

export const TRANSITION_KINDS: readonly TransitionKind[] = ['quick', 'fade', 'big-jump', 'outside', 'floor-gag', 'behind-wall'];

const G = ROOM_GRID;
/** Facing the camera (the player). */
const TOWARD_PLAYER = CAMERA_AZIMUTH;

export interface FloorPoint {
  x: number;
  z: number;
}

export interface TransitionContext {
  /** Where it stands in the room it leaves (tiles). */
  from: FloorPoint;
  /** Where it will stand in the room it enters; the runner replaces it with the valid spot nearest it at the swap. */
  to: FloorPoint;
  /** How high (tiles over the floor) the view's top is above `from` and above `to`. */
  skyFrom: number;
  skyTo: number;
}

/** One moment of a scene. */
export interface ChoreoFrame {
  /** Where it is (tiles; elev above the floor), or null to leave it where the room puts it. */
  at: { x: number; z: number; elev: number } | null;
  /** Which way it faces (yaw about +y, 0 toward +z). */
  heading?: number;
  walking: boolean;
  /** Its body about its feet: squash (`sx` across, `sy` up), a lean forward (`pitch`) and a roll, radians. */
  pose: { sx: number; sy: number; pitch: number; roll: number } | null;
  face: ExpressionName | null;
  /** Where it looks (the kit's offset), or null to leave the eyes to the room. */
  gaze: { x: number; y: number } | null;
  /** It is behind a back wall: the walls are drawn over the 2D drawing too. */
  wallsCover: boolean;
}

export interface Choreography {
  kind: TransitionKind;
  durationMs: number;
  /** When the new room comes on screen. */
  swapAtMs: number;
  /** How it comes on screen. */
  intro: RoomIntro;
  cues: readonly { at: number; cue: BlobbiSoundId }[];
  frame(t: number, ctx: TransitionContext): ChoreoFrame;
}

// ─── Easing and small helpers ───────────────────────────────────────────────

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpPoint = (a: FloorPoint, b: FloorPoint, k: number): FloorPoint => ({ x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k) });
const headingFrom = (a: FloorPoint, b: FloorPoint) => Math.atan2(b.x - a.x, b.z - a.z);
const dist = (a: FloorPoint, b: FloorPoint) => Math.hypot(b.x - a.x, b.z - a.z);
/** The short way round from one heading to another, part way. */
const turn = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const REST: ChoreoFrame['pose'] = null;
const frame = (f: Partial<ChoreoFrame> & Pick<ChoreoFrame, 'at'>): ChoreoFrame => ({ walking: false, pose: REST, face: null, gaze: null, wallsCover: false, ...f });
/** A landing's squash: down and wide, back up a little past, settled (k 0..1). */
const landing = (k: number, depth = 0.24) => {
  const s = Math.sin(Math.PI * clamp01(k)) * (1 - 0.35 * k);
  return { sx: 1 + depth * 0.6 * s, sy: 1 - depth * s, pitch: 0, roll: 0 };
};
/** How long a walk of `d` tiles takes at `speed` tiles/s, kept between bounds (a far walk hurries). */
const walkMs = (d: number, speed: number, min: number, max: number) => Math.min(max, Math.max(min, (d / speed) * 1000));

// ─── The scenes ─────────────────────────────────────────────────────────────

/** The room comes back briskly and the Blobbi drops in from a hop's height with a little bounce. */
function quick(): Choreography {
  const DROP = 240;
  const BOUNCE = 180;
  return {
    kind: 'quick',
    durationMs: DROP + BOUNCE,
    swapAtMs: 0,
    intro: 'quick',
    cues: [{ at: 0, cue: 'room' }],
    frame(t, { to }) {
      if (t < DROP) {
        const k = t / DROP;
        return frame({ at: { ...to, elev: 0.55 * (1 - k * k) }, heading: TOWARD_PLAYER, pose: { sx: 0.94, sy: 1.08, pitch: 0, roll: 0 } });
      }
      return frame({ at: { ...to, elev: 0 }, heading: TOWARD_PLAYER, pose: landing((t - DROP) / BOUNCE, 0.14) });
    },
  };
}

/**
 * No scene: the new room is there at once and the room stands the Blobbi in it as it always does (on its bed
 * when asleep). For reduced motion, and for a Blobbi that cannot take part.
 */
function fade(): Choreography {
  return { kind: 'fade', durationMs: 0, swapAtMs: 0, intro: 'none', cues: [], frame: () => frame({ at: null }) };
}

/**
 * The big jump: crouch (anticipation), leap far out of the top of the view
 * on a real parabola (no hovering: the hang time is the height), the new
 * room folding together under it while it is up there, then down, a landing
 * squash, and a curious look round its new room.
 */
function bigJump(): Choreography {
  const CROUCH = 260;
  const FLIGHT = 1250;
  const LAND = 280;
  const LOOK = 1000;
  const up = CROUCH;
  const down = CROUCH + FLIGHT;
  const settled = down + LAND;
  return {
    kind: 'big-jump',
    durationMs: settled + LOOK,
    // Just after it leaves the ground: the old room goes, the new one starts folding together under it
    swapAtMs: up + 140,
    intro: 'build',
    cues: [
      { at: 0, cue: 'crouch' },
      { at: up, cue: 'jump' },
      { at: down, cue: 'land' },
      { at: settled + LOOK - 320, cue: 'happy' },
    ],
    frame(t, { from, to, skyFrom, skyTo }) {
      if (t < up) {
        const k = easeOut(t / CROUCH);
        return frame({ at: { ...from, elev: 0 }, heading: TOWARD_PLAYER, pose: { sx: 1 + 0.16 * k, sy: 1 - 0.27 * k, pitch: 0, roll: 0 }, face: 'excited' });
      }
      if (t < down) {
        const u = (t - up) / FLIGHT;
        // High enough to leave the top of the view for a moment
        const apex = Math.max(skyFrom, skyTo) * 1.15 + 1;
        const p = lerpPoint(from, to, easeInOut(u));
        // Stretched leaving the ground and coming down, round at the top
        const stretch = u < 0.2 ? 1.22 - 1.1 * u : u > 0.78 ? 1 + (u - 0.78) * 0.6 : 1;
        return frame({ at: { ...p, elev: apex * 4 * u * (1 - u) }, heading: TOWARD_PLAYER, pose: { sx: 1 / Math.sqrt(stretch), sy: stretch, pitch: 0, roll: 0 }, face: 'excited' });
      }
      if (t < settled) {
        return frame({ at: { ...to, elev: 0 }, heading: TOWARD_PLAYER, pose: landing((t - down) / LAND, 0.3), face: t - down < 150 ? 'impact' : 'curious' });
      }
      // A look round: left, right, then at the player, pleased
      const k = t - settled;
      const gaze = k < 330 ? { x: -0.85, y: 0.05 } : k < 660 ? { x: 0.85, y: -0.05 } : null;
      return frame({ at: { ...to, elev: 0 }, heading: TOWARD_PLAYER, face: k < 680 ? 'curious' : 'happy', gaze });
    },
  };
}

/** Where it steps off the floor: through whichever open edge is nearer, a little way out. */
function edgeExit(from: FloorPoint): FloorPoint {
  const towardX = G - from.x < G - from.z;
  const along = (v: number) => Math.min(G - 1.2, Math.max(1.2, v));
  return towardX ? { x: G + 0.85, z: along(from.z) } : { x: along(from.x), z: G + 0.85 };
}

/** Outside the room: it walks off the floor's edge, turns to watch the new room build itself, and walks back in. */
function outside(ctx: TransitionContext): Choreography {
  const exit = edgeExit(ctx.from);
  const OUT = walkMs(dist(ctx.from, exit), 2.4, 500, 1400);
  const TURN = 380;
  const WATCH = 1500;
  const HOP = 320;
  const back = walkMs(dist(exit, ctx.to), 2.4, 500, 1400);
  const tTurn = OUT;
  const tWatch = tTurn + TURN;
  const tHop = tWatch + WATCH;
  const tBack = tHop + HOP;
  const tFace = tBack + back;
  const center = { x: G / 2, z: G / 2 };
  const out = headingFrom(ctx.from, exit);
  const watching = headingFrom(exit, center);
  return {
    kind: 'outside',
    durationMs: tFace + 220,
    swapAtMs: tTurn + 260,
    intro: 'build',
    cues: [{ at: tHop, cue: 'happy' }],
    frame(t, { from, to }) {
      if (t < tTurn) return frame({ at: { ...lerpPoint(from, exit, t / OUT), elev: 0 }, heading: out, walking: true });
      if (t < tWatch) return frame({ at: { ...exit, elev: 0 }, heading: turn(out, watching, easeInOut((t - tTurn) / TURN)), face: 'curious' });
      if (t < tHop) return frame({ at: { ...exit, elev: 0 }, heading: watching, face: 'curious' });
      if (t < tBack) {
        // Delighted with it: a little hop in place
        const k = (t - tHop) / HOP;
        return frame({ at: { ...exit, elev: 0.35 * Math.sin(Math.PI * k) }, heading: watching, face: 'excited' });
      }
      if (t < tFace) return frame({ at: { ...lerpPoint(exit, to, (t - tBack) / back), elev: 0 }, heading: headingFrom(exit, to), walking: true, face: 'happy' });
      return frame({ at: { ...to, elev: 0 }, heading: turn(headingFrom(exit, to), TOWARD_PLAYER, easeInOut((t - tFace) / 220)), face: 'happy' });
    },
  };
}

/**
 * The invisible floor: a confident stroll off the front edge, a beat of
 * not knowing, the look down, then (slowly) the look back at the player,
 * "uh oh", and the drop. It comes down into the new room from the top of
 * the screen, lands hard (softly), and shakes it off. The look at the
 * player is held: that beat is the joke.
 */
function floorGag(ctx: TransitionContext): Choreography {
  const edgeOut = { x: G + 0.3, z: G + 0.3 };
  const STROLL = walkMs(dist(ctx.from, edgeOut), 2.2, 600, 1500);
  const CONFIDENT = 320;
  const NOTICE = 240;
  const DOWN = 420;
  const LOOK_BACK = 650;
  const TROUBLE = 560;
  const FALL = 560;
  const GAP = 80;
  const DROP = 620;
  const LAND = 320;
  const RECOVER = 820;
  const t1 = STROLL;
  const t2 = t1 + CONFIDENT;
  const t3 = t2 + NOTICE;
  const t4 = t3 + DOWN;
  const t5 = t4 + LOOK_BACK;
  const t6 = t5 + TROUBLE;
  const t7 = t6 + FALL;
  const t8 = t7 + GAP;
  const t9 = t8 + DROP;
  const t10 = t9 + LAND;
  const stroll = headingFrom(ctx.from, edgeOut);
  return {
    kind: 'floor-gag',
    durationMs: t10 + RECOVER,
    // Once it has dropped well out of view
    swapAtMs: t6 + Math.round(FALL * 0.85),
    intro: 'quick',
    cues: [
      { at: t2, cue: 'surprise' },
      { at: t6, cue: 'fall' },
      { at: t9, cue: 'land' },
      { at: t10 + 420, cue: 'happy' },
    ],
    frame(t, { from, to, skyTo }) {
      if (t < t1) return frame({ at: { ...lerpPoint(from, edgeOut, t / STROLL), elev: 0 }, heading: stroll, walking: true, face: 'happy' });
      const there = { ...edgeOut, elev: 0 };
      // Standing on nothing, pleased with itself
      if (t < t2) return frame({ at: there, heading: TOWARD_PLAYER, face: 'happy' });
      // Something is wrong
      if (t < t3) return frame({ at: there, heading: TOWARD_PLAYER, face: 'surprised', pose: { sx: 0.97, sy: 1.05, pitch: 0, roll: 0 } });
      // It looks down
      if (t < t4) {
        const k = easeInOut((t - t3) / DOWN);
        return frame({ at: there, heading: TOWARD_PLAYER, face: 'surprised', gaze: { x: 0, y: k }, pose: { sx: 1, sy: 1, pitch: 0.32 * k, roll: 0 } });
      }
      // Slowly, it looks back up at the player
      if (t < t5) {
        const k = easeInOut((t - t4) / LOOK_BACK);
        return frame({ at: there, heading: TOWARD_PLAYER, face: 'worried', gaze: { x: 0, y: 1 - 1.05 * k }, pose: { sx: 1, sy: 1, pitch: 0.32 * (1 - k), roll: 0 } });
      }
      // "I'm in trouble": held, with a little tremble
      if (t < t6) {
        const k = (t - t5) / TROUBLE;
        return frame({ at: there, heading: TOWARD_PLAYER, face: 'worried', gaze: { x: 0, y: -0.05 }, pose: { sx: 1, sy: 1 - 0.03 * Math.sin(k * Math.PI), pitch: 0, roll: 0.035 * Math.sin(k * Math.PI * 8) } });
      }
      // Down it goes, out of view
      if (t < t7) {
        const k = (t - t6) / FALL;
        return frame({ at: { ...edgeOut, elev: -11 * k * k }, heading: TOWARD_PLAYER, face: 'surprised', pose: { sx: 0.9, sy: 1.14, pitch: 0, roll: 0 } });
      }
      // Into the new room, from the top of the screen
      if (t < t8) return frame({ at: { ...to, elev: skyTo + 2 }, heading: TOWARD_PLAYER, face: 'surprised' });
      if (t < t9) {
        const k = (t - t8) / DROP;
        return frame({ at: { ...to, elev: (skyTo + 2) * (1 - k * k) }, heading: TOWARD_PLAYER, face: 'surprised', pose: { sx: 0.9, sy: 1.14, pitch: 0, roll: 0 } });
      }
      if (t < t10) return frame({ at: { ...to, elev: 0 }, heading: TOWARD_PLAYER, face: 'impact', pose: landing((t - t9) / LAND, 0.36) });
      // Shakes it off, relieved, then glad
      const k = (t - t10) / RECOVER;
      const shake = k < 0.55 ? 0.11 * Math.sin((k / 0.55) * Math.PI * 4) * (1 - k / 0.55) : 0;
      return frame({ at: { ...to, elev: 0 }, heading: TOWARD_PLAYER, face: k < 0.5 ? 'relieved' : 'happy', pose: { sx: 1, sy: 1, pitch: 0, roll: shake } });
    },
  };
}

/**
 * Behind the wall: it scurries round the front end of the left wall and
 * out of sight, and pops out from behind the front end of the right wall,
 * in the new room. Brisk: a far start hurries.
 */
function behindWall(ctx: TransitionContext): Choreography {
  const near = { x: 0.6, z: G - 0.9 };
  const hidden = { x: -0.9, z: G - 0.9 };
  const behind = { x: G - 0.9, z: -0.9 };
  const out = { x: G - 0.9, z: 0.6 };
  const A = walkMs(dist(ctx.from, near), 4.5, 220, 620);
  const B = 240;
  const GAP = 90;
  const C = 240;
  const D = walkMs(dist(out, ctx.to), 4, 220, 700);
  const tA = A;
  const tB = tA + B;
  const tC = tB + GAP;
  const tD = tC + C;
  const tE = tD + D;
  return {
    kind: 'behind-wall',
    durationMs: tE + 160,
    swapAtMs: tB + 20,
    intro: 'quick',
    cues: [{ at: tC, cue: 'peek' }],
    frame(t, { from, to }) {
      if (t < tA) return frame({ at: { ...lerpPoint(from, near, t / A), elev: 0 }, heading: headingFrom(from, near), walking: true, face: 'happy' });
      if (t < tB) {
        const p = lerpPoint(near, hidden, (t - tA) / B);
        return frame({ at: { ...p, elev: 0 }, heading: headingFrom(near, hidden), walking: true, face: 'happy', wallsCover: p.x < -0.15 });
      }
      if (t < tC) return frame({ at: { ...behind, elev: 0 }, heading: headingFrom(behind, out), wallsCover: true });
      if (t < tD) {
        const p = lerpPoint(behind, out, (t - tC) / C);
        return frame({ at: { ...p, elev: 0 }, heading: headingFrom(behind, out), walking: true, face: 'excited', wallsCover: p.z < -0.15 });
      }
      if (t < tE) return frame({ at: { ...lerpPoint(out, to, (t - tD) / D), elev: 0 }, heading: headingFrom(out, to), walking: true, face: 'excited' });
      return frame({ at: { ...to, elev: 0 }, heading: turn(headingFrom(out, to), TOWARD_PLAYER, easeInOut((t - tE) / 160)) });
    },
  };
}

export function choreograph(kind: TransitionKind, ctx: TransitionContext): Choreography {
  switch (kind) {
    case 'big-jump':
      return bigJump();
    case 'outside':
      return outside(ctx);
    case 'floor-gag':
      return floorGag(ctx);
    case 'behind-wall':
      return behindWall(ctx);
    case 'fade':
      return fade();
    default:
      return quick();
  }
}

// ─── Choosing ───────────────────────────────────────────────────────────────

export interface TransitionChoice {
  /** The room has never been built in front of the player. */
  firstVisit: boolean;
  reducedMotion: boolean;
  /** Asked for while a transition was still playing, or straight after one: the player is in a hurry. */
  rapid: boolean;
  /** The Blobbi can take part (not an egg, not asleep, here, a 3D room to do it in). */
  canAct: boolean;
  /** The transitions played before, latest last. */
  history: readonly TransitionKind[];
  random: () => number;
}

/** How many transitions must pass before the floor gag can come back. */
export const GAG_COOLDOWN = 6;

/**
 * The director: spectacle for a first visit, briskness otherwise, with
 * the occasional surprise. Never the gag twice close together, never the
 * same theatrical scene twice in a row, nothing theatrical when the player
 * is hurrying, nothing moving under reduced motion.
 */
export function chooseTransition({ firstVisit, reducedMotion, rapid, canAct, history, random }: TransitionChoice): TransitionKind {
  if (reducedMotion || !canAct) return 'fade';
  if (rapid) return 'quick';
  const last = history[history.length - 1];
  if (firstVisit) {
    const pick = random() < 0.6 ? 'big-jump' : 'outside';
    return pick === last ? (pick === 'big-jump' ? 'outside' : 'big-jump') : pick;
  }
  const recentGag = history.slice(-GAG_COOLDOWN).includes('floor-gag');
  const r = random();
  if (!recentGag && history.length >= 2 && r < 0.12) return 'floor-gag';
  if (last !== 'behind-wall' && r < 0.36) return 'behind-wall';
  return 'quick';
}
