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
  /** How far its body reaches from where it stands (tiles): what it takes to be wholly off the floor, or behind a wall. */
  reach?: number;
  /** A number in [0, 1) for this scene's choices (which edge, which wall), so a scene is the same however often it is drawn. */
  choice?: number;
  /** Whether the floor under a point is free of furniture (a path that would walk through a piece is not taken). */
  isFree?: (x: number, z: number) => boolean;
}

/** How far its body reaches when the room does not say: an adult's. */
const DEFAULT_REACH = 1.27;
/** The back walls' thickness (they stand outside the floor, x < 0 and z < 0). */
const WALL_THICK = 0.25;

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
  /** The back wall it is behind (the 2D drawing is hidden inside that wall's outline), or false. */
  wallsCover: 'left' | 'right' | false;
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

/**
 * Where it steps off the floor: through whichever open edge is nearer, just far enough that the whole body is
 * clear of it (its reach, and a hair), so it is plainly standing outside the room.
 */
function edgeExit(from: FloorPoint, reach: number): FloorPoint {
  const towardX = G - from.x < G - from.z;
  const along = (v: number) => Math.min(G - 1.2, Math.max(1.2, v));
  const out = G + reach + 0.15;
  return towardX ? { x: out, z: along(from.z) } : { x: along(from.x), z: out };
}

/** Outside the room: it walks off the floor's edge, turns to watch the new room build itself, and walks back in. */
function outside(ctx: TransitionContext): Choreography {
  const exit = edgeExit(ctx.from, ctx.reach ?? DEFAULT_REACH);
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

/** A walk along a polyline at a steady pace: where it is and which way it faces `t` ms in. */
interface Path {
  points: FloorPoint[];
  /** Arrival time at each point (ms). */
  at: number[];
  total: number;
}

function path(points: FloorPoint[], speed: number): Path {
  const at = [0];
  for (let i = 1; i < points.length; i++) at.push(at[i - 1] + (dist(points[i - 1], points[i]) / speed) * 1000);
  return { points, at, total: at[at.length - 1] };
}

function along(p: Path, t: number): { at: FloorPoint; heading: number; segment: number } {
  const k = Math.min(Math.max(t, 0), p.total);
  let i = 1;
  while (i < p.points.length - 1 && p.at[i] < k) i++;
  const a = p.points[i - 1];
  const b = p.points[i];
  const span = p.at[i] - p.at[i - 1];
  return { at: lerpPoint(a, b, span > 0 ? (k - p.at[i - 1]) / span : 1), heading: headingFrom(a, b), segment: i - 1 };
}

/** Whether a straight walk crosses only free floor (or no floor at all). */
function clear(a: FloorPoint, b: FloorPoint, isFree?: (x: number, z: number) => boolean): boolean {
  if (!isFree) return true;
  const steps = Math.max(2, Math.ceil(dist(a, b) / 0.4));
  for (let i = 1; i < steps; i++) {
    const p = lerpPoint(a, b, i / steps);
    if (!isFree(p.x, p.z)) return false;
  }
  return true;
}

/** An open edge to walk off: which (the x = G or the z = G side) and where along it. */
interface EdgeChoice {
  /** On the floor, just inside the edge. */
  inside: FloorPoint;
  /** Off the floor, the whole body past the edge by `beyond`. */
  outside: FloorPoint;
  /** The way out (yaw). */
  heading: number;
}

/**
 * The open edges it could walk off from where it stands, best first: the nearer edge first (the other too when it
 * is nearly as near, picked between by `choice`), straight out from where it stands along that edge, kept away from
 * the corners (the walls' ends and the bottom of the view), and only where the walk there is clear of furniture.
 */
function openEdges(ctx: TransitionContext, beyond: number): EdgeChoice[] {
  const { from } = ctx;
  const keep = (v: number) => Math.min(G - 2, Math.max(2, v));
  const sides = [
    { d: G - from.x, edge: (o: number): EdgeChoice => ({ inside: { x: G - 0.5, z: keep(from.z) }, outside: { x: G + o, z: keep(from.z) }, heading: Math.PI / 2 }) },
    { d: G - from.z, edge: (o: number): EdgeChoice => ({ inside: { x: keep(from.x), z: G - 0.5 }, outside: { x: keep(from.x), z: G + o }, heading: 0 }) },
  ].sort((a, b) => a.d - b.d);
  // Nearly as near: let the scene's choice pick, so the same spot does not always walk off the same edge
  if (Math.abs(sides[0].d - sides[1].d) < 1.5 && (ctx.choice ?? 0) >= 0.5) sides.reverse();
  return sides.map((s) => s.edge(beyond)).filter((e) => clear(from, e.inside, ctx.isFree));
}

/**
 * The invisible floor: it walks to an open edge of the room and on, past
 * the floor's boundary, a little farther still, sure of ground that is not
 * there, and stops, standing on nothing, wholly outside the room. A beat of
 * not knowing; it looks down into the empty space; then (slowly) back at the
 * player, "uh oh"; and it drops out of view. It comes down into the new room
 * from the top of the screen, lands hard (softly), and shakes it off. Every
 * moment of the joke happens out past the edge, never over the floor.
 */
function floorGag(ctx: TransitionContext): Choreography {
  const reach = ctx.reach ?? DEFAULT_REACH;
  // Far enough out that it plainly stands on nothing (its body well clear of the edge), still well in view;
  // no open edge it can reach without walking through furniture: the quick change instead
  const edge = openEdges(ctx, reach + 0.85)[0];
  if (!edge) return quick();
  const walk = path([ctx.from, edge.inside, edge.outside], 2.6);
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
  const t1 = walk.total;
  const t2 = t1 + CONFIDENT;
  const t3 = t2 + NOTICE;
  const t4 = t3 + DOWN;
  const t5 = t4 + LOOK_BACK;
  const t6 = t5 + TROUBLE;
  const t7 = t6 + FALL;
  const t8 = t7 + GAP;
  const t9 = t8 + DROP;
  const t10 = t9 + LAND;
  const out = edge.heading;
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
    frame(t, { to, skyTo }) {
      if (t < t1) {
        const w = along(walk, t);
        return frame({ at: { ...w.at, elev: 0 }, heading: w.heading, walking: true, face: 'happy' });
      }
      const there = { ...edge.outside, elev: 0 };
      // Standing on nothing, pleased with itself, still facing the way it was going
      if (t < t2) return frame({ at: there, heading: out, face: 'happy' });
      // Something is wrong
      if (t < t3) return frame({ at: there, heading: out, face: 'surprised', pose: { sx: 0.97, sy: 1.05, pitch: 0, roll: 0 } });
      // It looks down, into the empty space under it
      if (t < t4) {
        const k = easeInOut((t - t3) / DOWN);
        return frame({ at: there, heading: out, face: 'surprised', gaze: { x: 0, y: k }, pose: { sx: 1, sy: 1, pitch: 0.32 * k, roll: 0 } });
      }
      // Slowly, it turns and looks back up, at the player
      if (t < t5) {
        const k = easeInOut((t - t4) / LOOK_BACK);
        return frame({ at: there, heading: turn(out, TOWARD_PLAYER, k), face: 'worried', gaze: { x: 0, y: 1 - 1.05 * k }, pose: { sx: 1, sy: 1, pitch: 0.32 * (1 - k), roll: 0 } });
      }
      // "I'm in trouble": held, with a little tremble
      if (t < t6) {
        const k = (t - t5) / TROUBLE;
        return frame({ at: there, heading: TOWARD_PLAYER, face: 'worried', gaze: { x: 0, y: -0.05 }, pose: { sx: 1, sy: 1 - 0.03 * Math.sin(k * Math.PI), pitch: 0, roll: 0.035 * Math.sin(k * Math.PI * 8) } });
      }
      // Down it goes, out of view, past the outside of the floor
      if (t < t7) {
        const k = (t - t6) / FALL;
        return frame({ at: { ...edge.outside, elev: -11 * k * k }, heading: TOWARD_PLAYER, face: 'surprised', pose: { sx: 0.9, sy: 1.14, pitch: 0, roll: 0 } });
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
 * The two back walls, each a slab standing outside the floor along one of its back edges, with one free end at
 * the open side of the room. For each: a spot on the floor near that end, a spot off the floor beyond the open
 * edge there, a spot beside the wall's end (outside the room, past the end, the body clear of the slab), and a spot
 * behind the wall (the body wholly behind it, out of the camera's sight).
 */
function wallRoute(wall: 'left' | 'right', reach: number) {
  const m = reach + 0.25;
  const off = WALL_THICK + m;
  // On the floor near the wall's end, the body still clear of the wall
  const clearOfWall = Math.max(1.2, reach + 0.15);
  if (wall === 'left') {
    // The left wall stands at x < 0 along z, its free end at z = G
    return {
      onFloor: { x: clearOfWall, z: G - 0.6 },
      outside: { x: clearOfWall, z: G + m },
      beside: { x: -off, z: G + m },
      behind: { x: -off, z: G - m - 1.8 },
    };
  }
  // The right wall stands at z < 0 along x, its free end at x = G
  return {
    onFloor: { x: G - 0.6, z: clearOfWall },
    outside: { x: G + m, z: clearOfWall },
    beside: { x: G + m, z: -off },
    behind: { x: G - m - 1.8, z: -off },
  };
}

/**
 * Behind the wall: it steps off the floor near the free end of one back
 * wall, goes round that end (never through the wall: past its end, outside
 * the room) and slips behind it, where the wall hides it as it goes (in 3D by
 * depth, in 2D by the wall's own outline on screen). The room changes while it
 * is out of sight; it comes out from behind the other wall, round its end,
 * and steps back onto the floor. Which wall it leaves behind is the nearer
 * one's (the other when nearly as near, by the scene's choice). Brisk.
 */
function behindWall(ctx: TransitionContext): Choreography {
  const reach = ctx.reach ?? DEFAULT_REACH;
  const leftEnd = { x: 0, z: G };
  const rightEnd = { x: G, z: 0 };
  const dl = dist(ctx.from, leftEnd);
  const dr = dist(ctx.from, rightEnd);
  let order: ('left' | 'right')[] = dl <= dr ? ['left', 'right'] : ['right', 'left'];
  if (Math.abs(dl - dr) < 1.5 && (ctx.choice ?? 0) >= 0.5) order = [order[1], order[0]];
  // Never through furniture: the first wall whose way is clear, the way back from the other clear too; neither: quick
  const usable = order.filter((w) => clear(ctx.from, wallRoute(w, reach).onFloor, ctx.isFree) && clear(wallRoute(w === 'left' ? 'right' : 'left', reach).onFloor, ctx.to, ctx.isFree));
  if (!usable.length) return quick();
  const first = usable[0];
  const second: 'left' | 'right' = first === 'left' ? 'right' : 'left';
  const away = wallRoute(first, reach);
  const back = wallRoute(second, reach);
  const SPEED = 4.2;
  const out = path([ctx.from, away.onFloor, away.outside, away.beside, away.behind], SPEED);
  const GAP = 120;
  // Back: out from behind the other wall, round its end, onto the floor (the last leg's end is where it was going)
  const inFrom = [back.behind, back.beside, back.outside, back.onFloor];
  const inPath = path([...inFrom, ctx.to], SPEED);
  const tHidden = out.total;
  const tBack = tHidden + GAP;
  const tHome = tBack + inPath.total;
  /** Behind a wall: on the way in along its far side (the last leg out), or on the way out (the first leg back). */
  const cover = (wall: 'left' | 'right', p: FloorPoint) => (wall === 'left' ? p.x < -WALL_THICK : p.z < -WALL_THICK);
  return {
    kind: 'behind-wall',
    durationMs: tHome + 160,
    swapAtMs: tHidden + GAP / 2,
    intro: 'quick',
    cues: [{ at: tBack + (inPath.at[1] ?? 0) * 0.6, cue: 'peek' }],
    frame(t, { to }) {
      if (t < tHidden) {
        const w = along(out, t);
        // Behind the wall once it is on the far side of it (the last leg), never while it walks round the end
        return frame({ at: { ...w.at, elev: 0 }, heading: w.heading, walking: true, face: 'happy', wallsCover: w.segment === 3 && cover(first, w.at) ? first : false });
      }
      if (t < tBack) return frame({ at: { ...away.behind, elev: 0 }, heading: headingFrom(away.beside, away.behind), wallsCover: first });
      const live = path([...inFrom, to], SPEED);
      if (t < tHome) {
        const w = along(live, t - tBack);
        return frame({ at: { ...w.at, elev: 0 }, heading: w.heading, walking: true, face: w.segment >= 2 ? 'excited' : null, wallsCover: w.segment === 0 && cover(second, w.at) ? second : false });
      }
      return frame({ at: { ...to, elev: 0 }, heading: turn(headingFrom(back.onFloor, to), TOWARD_PLAYER, easeInOut((t - tHome) / 160)) });
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
