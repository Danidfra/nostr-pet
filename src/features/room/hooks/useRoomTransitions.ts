/**
 * The room-change director, in React: which room is on screen, how the next
 * one arrives, and the scene the Blobbi plays on the way (`room-transitions`).
 *
 *   request(room)   the player asked for a room: a scene is chosen (a first
 *                   visit's spectacle, a quick return, now and then a
 *                   surprise) and played; the new room comes on screen at its
 *                   swap moment. Asked again mid-scene, the scene is cut
 *                   short (the new room at once, the Blobbi set down safely)
 *                   and a quick one follows to the latest room.
 *   play(kind)      the development playground: a given scene, to a given room
 *   cancel()        end the scene now, the Blobbi standing in the room
 *
 * Each frame of a scene is handed to both drawings at once: the scene (the
 * Blobbi's place, the 3D pose, walls over the 2D drawing), the 2D drawing's
 * box (its pose, by style, never by render), the face (the expression
 * controller, as a "script"), the eyes (state, only when they change) and
 * the sounds (the cues). Driven by animation frames; a hidden tab skips to
 * the end, so nothing is ever left half way. Unmounting mid-scene leaves the
 * Blobbi standing on the floor.
 */
import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';

import type { RoomId } from '@/features/home/rooms/rooms';
import type { BlobbiSoundId } from '@/features/sound/sounds';
import type { ExpressionName } from '@/features/expression/faces';
import { PRIORITY } from '@/features/expression/controller';
import type { RoomControl } from '../components/RoomShell';
import type { RoomIntro } from '../lib/scene/RoomScene';
import { chooseTransition, choreograph, type Choreography, type TransitionContext, type TransitionKind } from '../lib/room-transitions';
import type { FloorPoint } from '../lib/room-memory';
import { ROOM_GRID } from '../lib/room-geometry';

const MIDDLE: FloorPoint = { x: ROOM_GRID / 2 + 0.5, z: ROOM_GRID / 2 + 0.5 };
/** A request this soon after the last scene ended is a player in a hurry. */
const RAPID_MS = 700;

export interface RoomTransitionMemory {
  seen: (room: RoomId) => boolean;
  markSeen: (room: RoomId) => void;
  positionIn: (room: RoomId) => FloorPoint | null;
  rememberPosition: (room: RoomId, at: FloorPoint) => void;
}

export interface UseRoomTransitionsOptions {
  /** The room shown first (the remembered one, or the default). */
  initialRoom: RoomId;
  controlRef: MutableRefObject<RoomControl | null>;
  /** The 2D drawing's box, posed by style during a scene. */
  boxRef: RefObject<HTMLElement | null>;
  memory: RoomTransitionMemory;
  /** Whether the Blobbi can take part now (here, awake, hatched, a 3D room). */
  canAct: () => boolean;
  reducedMotion: () => boolean;
  play: (sound: BlobbiSoundId) => void;
  showFace: (source: string, name: ExpressionName, options?: { priority?: number; durationMs?: number }) => void;
  clearFace: (source: string) => void;
  random?: () => number;
  /** How far the Blobbi's body reaches from where it stands (tiles), for scenes that take it off the floor or behind a wall. */
  reach?: () => number;
}

export interface RoomTransitions {
  /** The room on screen. */
  shownRoom: RoomId;
  /** How the room on screen arrived, for the shell (its intro and where the Blobbi stands). */
  roomEntry: { intro: RoomIntro; spawn: FloorPoint | null };
  /** A scene is playing: nothing else should start (care, decorating, its own life). */
  transitioning: boolean;
  kind: TransitionKind | null;
  /** Where the scene wants the eyes, or null. */
  gaze: { x: number; y: number } | null;
  request: (room: RoomId) => void;
  /**
   * The next request plays this scene (the playground; it then asks for the room as the player does, so the
   * header and the page follow): `intro` overrides how the room comes on screen, `holdAt` holds the scene at a
   * moment instead of playing it (a scrubber).
   */
  forceNext: (kind: TransitionKind, options?: { intro?: RoomIntro; holdAt?: number }) => void;
  cancel: () => void;
  /** Move a held scene to another moment (the playground's scrubber); false when no scene is held. */
  seek: (t: number) => boolean;
  /** How long the scene being shown or held lasts (ms), for a scrubber. */
  durationMs: number;
  /** Playback speed (the playground's), 1 normally. */
  speed: number;
  setSpeed: (speed: number) => void;
}

interface Running {
  room: RoomId;
  choreo: Choreography;
  ctx: TransitionContext;
  target: FloorPoint;
  startedAt: number;
  swapped: boolean;
  fired: number;
  firstVisit: boolean;
  /** How the room comes on screen, when the playground says. */
  intro?: RoomIntro;
  /** Held at a moment by the scrubber. */
  held: boolean;
  last: { face: ExpressionName | null; gaze: string; walls: 'left' | 'right' | false; scripted: boolean };
}

export function useRoomTransitions(options: UseRoomTransitionsOptions): RoomTransitions {
  const opts = useRef(options);
  opts.current = options;
  const { initialRoom } = options;
  const [shownRoom, setShownRoom] = useState<RoomId>(initialRoom);
  const [roomEntry, setRoomEntry] = useState<{ intro: RoomIntro; spawn: FloorPoint | null }>(() => ({
    intro: options.memory.seen(initialRoom) ? 'none' : 'build',
    spawn: options.memory.positionIn(initialRoom) ?? MIDDLE,
  }));
  const [kind, setKind] = useState<TransitionKind | null>(null);
  const [gaze, setGaze] = useState<{ x: number; y: number } | null>(null);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  speedRef.current = speed;
  const running = useRef<Running | null>(null);
  const frameId = useRef(0);
  const history = useRef<TransitionKind[]>([]);
  const lastEnd = useRef(-Infinity);
  const shownRef = useRef(initialRoom);
  const forced = useRef<{ kind: TransitionKind; intro?: RoomIntro; holdAt?: number } | null>(null);

  // The first room, once built in front of the player, is remembered as seen
  useEffect(() => {
    const room = shownRef.current;
    const timer = setTimeout(() => opts.current.memory.markSeen(room), 1600);
    return () => clearTimeout(timer);
  }, []);

  const pose2d = useCallback((pose: { sx: number; sy: number; pitch: number; roll: number } | null) => {
    const box = opts.current.boxRef.current;
    if (!box) return;
    if (!pose) {
      box.style.transform = '';
      box.style.transformOrigin = '';
      return;
    }
    box.style.transformOrigin = '50% 100%';
    // A lean forward reads in 2D as a little dip of the head: a touch shorter, a touch lower
    const sy = pose.sy * (1 - 0.12 * Math.max(0, pose.pitch));
    box.style.transform = `scale(${pose.sx.toFixed(4)}, ${sy.toFixed(4)}) rotate(${((pose.roll * 180) / Math.PI).toFixed(2)}deg)`;
  }, []);

  const swap = useCallback((run: Running) => {
    if (run.swapped) return;
    run.swapped = true;
    const intro: RoomIntro = run.intro ?? (opts.current.reducedMotion() ? 'none' : run.firstVisit ? 'build' : run.choreo.intro === 'none' ? 'quick' : run.choreo.intro);
    shownRef.current = run.room;
    setRoomEntry({ intro, spawn: run.target });
    setShownRoom(run.room);
  }, []);

  /** End the scene: the Blobbi let go (on the floor, inside the room), every borrowed thing given back. */
  const finish = useCallback((silent = false) => {
    const run = running.current;
    if (!run) return;
    cancelAnimationFrame(frameId.current);
    swap(run);
    running.current = null;
    const control = opts.current.controlRef.current;
    if (run.last.scripted) control?.script(null);
    if (run.held) control?.holdIntro(null);
    control?.pose(null);
    if (run.last.walls) control?.wallsCover(null);
    pose2d(null);
    opts.current.clearFace('transition');
    lastEnd.current = performance.now();
    if (run.choreo.intro === 'build' || run.firstVisit) opts.current.memory.markSeen(run.room);
    const at = control?.blobbiPosition();
    if (at) opts.current.memory.rememberPosition(run.room, at);
    if (!silent) {
      setGaze(null);
      setKind(null);
    }
  }, [swap, pose2d]);

  /** Show the scene's moment `t` on both drawings. */
  const applyAt = useCallback((run: Running, t: number) => {
    const o = opts.current;
    if (!run.swapped && t >= run.choreo.swapAtMs) swap(run);
    const control = o.controlRef.current;
    // After the swap the Blobbi is headed for a real spot in the new room (its furniture, as it is now)
    if (run.swapped && control) run.ctx.to = control.standPointNear(run.target.x, run.target.z);
    const f = run.choreo.frame(Math.min(t, run.choreo.durationMs), run.ctx);
    if (control) {
      if (f.at) {
        control.script({ x: f.at.x, z: f.at.z, elev: f.at.elev, heading: f.heading, walking: f.walking });
        run.last.scripted = true;
      }
      control.pose(f.pose);
      if (f.wallsCover !== run.last.walls) {
        run.last.walls = f.wallsCover;
        control.wallsCover(f.wallsCover || null);
      }
    }
    pose2d(f.pose);
    if (f.face !== run.last.face) {
      run.last.face = f.face;
      if (f.face) o.showFace('transition', f.face, { priority: PRIORITY.script });
      else o.clearFace('transition');
    }
    const gazeKey = f.gaze ? `${f.gaze.x.toFixed(2)},${f.gaze.y.toFixed(2)}` : '';
    if (gazeKey !== run.last.gaze) {
      run.last.gaze = gazeKey;
      setGaze(f.gaze);
    }
    return f;
  }, [swap, pose2d]);

  const tick = useCallback(() => {
    const run = running.current;
    if (!run || run.held) return;
    const o = opts.current;
    if (typeof document !== 'undefined' && document.hidden) {
      finish();
      return;
    }
    const t = (performance.now() - run.startedAt) * speedRef.current;
    applyAt(run, t);
    while (run.fired < run.choreo.cues.length && run.choreo.cues[run.fired].at <= t) {
      o.play(run.choreo.cues[run.fired].cue);
      run.fired++;
    }
    if (t >= run.choreo.durationMs) {
      finish();
      return;
    }
    frameId.current = requestAnimationFrame(tick);
  }, [finish, applyAt]);

  const start = useCallback(
    (room: RoomId, forcedKind: TransitionKind | null, intro?: RoomIntro, holdAt?: number) => {
      const o = opts.current;
      const wasRunning = running.current !== null;
      // Cut a scene short: its room on screen at once, the Blobbi set down where it can stand
      if (wasRunning) finish(true);
      const control = o.controlRef.current;
      const from = control?.blobbiPosition() ?? MIDDLE;
      if (shownRef.current && !wasRunning) o.memory.rememberPosition(shownRef.current, from);
      const target = o.memory.positionIn(room) ?? MIDDLE;
      const firstVisit = !o.memory.seen(room);
      const chosen =
        forcedKind ??
        chooseTransition({
          firstVisit,
          reducedMotion: o.reducedMotion(),
          rapid: wasRunning || performance.now() - lastEnd.current < RAPID_MS,
          canAct: !!control && control.canChoreograph() && o.canAct(),
          history: history.current,
          random: o.random ?? Math.random,
        });
      const ctx: TransitionContext = {
        from,
        to: target,
        skyFrom: control?.skyAt(from.x, from.z) ?? 12,
        skyTo: control?.skyAt(target.x, target.z) ?? 12,
        reach: o.reach?.(),
        choice: (o.random ?? Math.random)(),
        isFree: control ? (x, z) => control.tileFree(x, z) : undefined,
      };
      const choreo = choreograph(chosen, ctx);
      history.current = [...history.current.slice(-12), chosen];
      const run: Running = { room, choreo, ctx, target, startedAt: performance.now(), swapped: false, fired: 0, firstVisit, intro, held: false, last: { face: null, gaze: '', walls: false, scripted: false } };
      running.current = run;
      setKind(chosen);
      // Held at a moment (the scrubber): drawn once, no frames run, nothing skips to the end
      if (holdAt !== undefined && control) {
        run.held = true;
        applyAt(run, holdAt);
        control.holdIntro(holdAt >= choreo.swapAtMs ? holdAt - choreo.swapAtMs : null);
        control.render();
        return;
      }
      // No scene to play (reduced motion, or nothing to play it with): the room at once
      if (choreo.durationMs <= 0 || !control || !control.canChoreograph() || (typeof document !== 'undefined' && document.hidden)) {
        finish();
        return;
      }
      frameId.current = requestAnimationFrame(tick);
    },
    [finish, tick, applyAt],
  );

  const request = useCallback(
    (room: RoomId) => {
      const target = running.current?.room ?? shownRef.current;
      if (room === target) return;
      const f = forced.current;
      forced.current = null;
      start(room, f?.kind ?? null, f?.intro, f?.holdAt);
    },
    [start],
  );
  const forceNext = useCallback((k: TransitionKind, options: { intro?: RoomIntro; holdAt?: number } = {}) => {
    forced.current = { kind: k, ...options };
  }, []);
  const seek = useCallback((t: number) => {
    const run = running.current;
    if (!run?.held) return false;
    applyAt(run, t);
    // The room's fold-in held at the same moment of the scene
    opts.current.controlRef.current?.holdIntro(t >= run.choreo.swapAtMs ? t - run.choreo.swapAtMs : null);
    opts.current.controlRef.current?.render();
    return true;
  }, [applyAt]);
  const cancel = useCallback(() => finish(), [finish]);

  useEffect(
    () => () => {
      // Leaving the room mid-scene: nothing keeps running, the Blobbi is let go
      cancelAnimationFrame(frameId.current);
      const run = running.current;
      running.current = null;
      if (!run) return;
      const control = opts.current.controlRef.current;
      control?.script(null);
      control?.pose(null);
      control?.wallsCover(null);
      opts.current.clearFace('transition');
    },
    [],
  );

  return { shownRoom, roomEntry, transitioning: kind !== null, kind, gaze, request, forceNext, cancel, seek, durationMs: running.current?.choreo.durationMs ?? 0, speed, setSpeed };
}
