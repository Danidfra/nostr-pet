/**
 * The Blobbi and the things put in its room, played out as one scene at a
 * time (`room-interaction.ts` runs it; this decides what happens):
 *
 *   feeding    the food is set down on a dish in front of it. It notices
 *              (a curious look toward the dish, a beat), walks over, and
 *              is eager (eyes on the dish) while the use is written. Once
 *              the write has landed, and never before, it eats: bite by
 *              bite, the mouth open on each and closed on it, the body
 *              dipping, a bite gone from the food on the dish with each,
 *              the chew heard. Then "mmm", the chips, a glad hop, the dish
 *              goes, and a glance at the player before its own life again.
 *   a ball     set down, it drops in and bounces. It notices, comes over,
 *              and plays: a nudge sends the ball rolling (a bop), its eyes
 *              follow it, it chases it to where it stops and nudges it
 *              again, three times (once under reduced motion); the play is
 *              written when the game begins and celebrated when it ends.
 *              The ball stays in the room for the visit; a tap sends it
 *              rolling again, and the Blobbi looks.
 *   anything   soap, medicine, another toy: set down, noticed, walked to,
 *   else       used where it lies (the home's consume), celebrated.
 *
 * Everything the scene borrows (its face, its eyes, a prop, a walk) is
 * given back when the scene ends, however it ends: the player changes room
 * (`room`), starts a teleport (`teleport`), chooses another item
 * (`replaced`), pets the Blobbi on its way (the walk stops: nothing is used,
 * the item goes back), or puts the page away (waits are not kept; a write
 * already out finishes, protected, and is celebrated without ceremony).
 * Nothing is written by a scene except through `RoomCare`, and nothing in
 * a scene can write twice.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { EyeOffset } from '@/features/home/scene/gaze';
import type { PokeGesture } from '@/features/home/personality';
import type { FeedbackResult } from '@/features/home/care-feedback-text';
import type { RoomId } from '@/features/home/rooms/rooms';
import type { HomeItem } from '@/features/inventory';
import type { BlobbiSoundId } from '@/features/sound/sounds';
import { PRIORITY } from '@/features/expression/controller';
import type { ExpressionName } from '@/features/expression/faces';
import type { RoomControl } from '../components/RoomShell';
import type { RoomNavigation } from './useRoomNavigation';
import { EAT, bitesFor, type RoomCare, type UseOutcome } from './useRoomCare';
import type { EatingMoment } from './useEatingPresentation';
import { Interrupted, createDirector, type CancelReason, type Run } from '../lib/room-interaction';
import { PROP_LEAVE_MS, propGlyphFor, propKindFor, type RoomProp } from '../lib/room-props';
import { kickDirection } from '../lib/ball-physics';
import { gazeToward } from '../lib/room-gaze';
import type { DropPlan, RoomCareEntry } from '../lib/room-care';
import { recordRuntimeError } from '../lib/runtime-errors';

export type InteractionKind = 'feeding' | 'playing' | 'using';

/** How long it looks at a thing just set down before going to it. */
export const NOTICE_MS = 480;
/** How long a glance at the player lasts, after. */
const AFTER_GLANCE_MS = 700;
/** Where the eyes go while it eats: on the dish at its feet. */
const ON_THE_DISH: EyeOffset = { x: 0, y: 0.65 };
/** The ball: how hard it is nudged (tiles/s), how many times, and how long it may roll before it is chased anyway. */
export const PLAY = { kicks: 3, power: [3.2, 4.4] as const, rollMaxMs: 2_400, tapPower: 2.8 } as const;
/** A pretend write (the development previews) takes this long to "land". */
const PRETEND_WRITE_MS = 600;

export interface UseRoomInteractionsOptions {
  care: RoomCare;
  nav: Pick<RoomNavigation, 'approach' | 'canWalk' | 'stop'>;
  controlRef: MutableRefObject<RoomControl | null>;
  roomId: RoomId;
  /** Here and awake and hatched: a scene may play. Going false ends one (a teleport, falling asleep). */
  present: boolean;
  /** Nothing else owns the Blobbi (not decorating, not a room transition). Going false ends a scene. */
  enabled: boolean;
  reducedMotion: boolean;
  blobbiName: string;
  showFace: (source: string, name: ExpressionName, options?: { priority?: number; durationMs?: number }) => void;
  clearFace: (source: string) => void;
  gesture: (kind: PokeGesture) => void;
  play: (sound: BlobbiSoundId) => void;
  /** Where its stats come from for a pretend result (the previews). */
  random?: () => number;
}

export interface RoomInteractions {
  /** The physical things in the room now (for the shell). */
  props: readonly RoomProp[];
  /** Where a scene wants the eyes, or null. */
  gaze: EyeOffset | null;
  /** What the Blobbi is busy with, or null. */
  activity: InteractionKind | null;
  /** A meal under way (for the eating presentation: the faces and the dip), or null. */
  eating: EatingMoment | null;
  /** Set an item down for the Blobbi, as planned, and play the scene. False when it could not start. */
  offer: (entry: RoomCareEntry, plan: DropPlan, roomId: RoomId) => boolean;
  /** Try a failed use again, with its scene from the write on (the player's tap). */
  retry: () => void;
  /** A prop was tapped (a ball: it is sent rolling; the Blobbi looks). */
  onPropTap: (id: string) => void;
  /** The development previews: the whole scene with a pretend write (nothing used, nothing written). */
  preview: (kind: 'feed' | 'ball', item: HomeItem) => void;
  cancel: (reason: CancelReason) => void;
}

/** What a scene is about: the thing, where it is, and (unless pretend) the offer it belongs to. */
interface Subject {
  key: number;
  item: HomeItem;
  name: string;
  x: number;
  z: number;
  dry: boolean;
}

const FACE = 'interaction';

export function useRoomInteractions(options: UseRoomInteractionsOptions): RoomInteractions {
  const { care, roomId, present, enabled, reducedMotion } = options;
  const live = useRef(options);
  live.current = options;
  const [props, setProps] = useState<RoomProp[]>([]);
  const [gaze, setGazeState] = useState<EyeOffset | null>(null);
  const gazeRef = useRef<EyeOffset | null>(null);
  const [activity, setActivity] = useState<InteractionKind | null>(null);
  const [eating, setEating] = useState<EatingMoment | null>(null);
  const leaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const director = useMemo(() => createDirector({ onError: (error, name) => recordRuntimeError('error', error instanceof Error ? error : new Error(`${name}: ${String(error)}`)) }), []);

  // ─── What a scene may touch ───
  const setGaze = useCallback((next: EyeOffset | null) => {
    const prev = gazeRef.current;
    if (prev === next || (prev && next && Math.abs(prev.x - next.x) < 0.03 && Math.abs(prev.y - next.y) < 0.03)) return;
    gazeRef.current = next;
    setGazeState(next);
  }, []);
  const addProp = useCallback((prop: RoomProp) => {
    const timer = leaveTimers.current.get(prop.id);
    if (timer) {
      clearTimeout(timer);
      leaveTimers.current.delete(prop.id);
    }
    setProps((ps) => [...ps.filter((p) => p.id !== prop.id && !(prop.kind === 'ball' && p.kind === 'ball')), prop]);
  }, []);
  const updateProp = useCallback((id: string, patch: Partial<RoomProp>) => {
    setProps((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);
  const removeProp = useCallback((id: string) => {
    const timer = leaveTimers.current.get(id);
    if (timer) clearTimeout(timer);
    leaveTimers.current.delete(id);
    setProps((ps) => (ps.some((p) => p.id === id) ? ps.filter((p) => p.id !== id) : ps));
  }, []);
  /** A prop on its way out: it shrinks away, then goes. */
  const leaveProp = useCallback((id: string) => {
    updateProp(id, { leaving: true });
    const timer = setTimeout(() => {
      leaveTimers.current.delete(id);
      setProps((ps) => ps.filter((p) => p.id !== id));
    }, PROP_LEAVE_MS);
    leaveTimers.current.set(id, timer);
  }, [updateProp]);
  const clearAllProps = useCallback(() => {
    for (const timer of leaveTimers.current.values()) clearTimeout(timer);
    leaveTimers.current.clear();
    setProps((ps) => (ps.length ? [] : ps));
  }, []);
  useEffect(() => () => {
    for (const timer of leaveTimers.current.values()) clearTimeout(timer);
    leaveTimers.current.clear();
  }, []);

  const face = useCallback((name: ExpressionName | null) => {
    if (name) live.current.showFace(FACE, name, { priority: PRIORITY.care });
    else live.current.clearFace(FACE);
  }, []);
  const lookAt = useCallback((point: { x: number; z: number }) => {
    const at = live.current.controlRef.current?.blobbiPosition();
    setGaze(at ? gazeToward(at, point) : { x: 0, y: 0.4 });
  }, [setGaze]);

  // ─── The moments the scenes are made of ───

  /** It notices the thing: a curious look toward it, a beat; then it goes to it. False when it could not get there (the offer is taken back). */
  const noticeAndApproach = useCallback(async (run: Run, subject: Subject): Promise<boolean> => {
    const o = live.current;
    face('curious');
    lookAt(subject);
    run.cleanup(() => {
      face(null);
      setGaze(null);
    });
    await run.wait(NOTICE_MS);
    if (!o.nav.canWalk) return true;
    const outcome = await run.until(o.nav.approach(subject.x, subject.z));
    if (outcome === 'arrived') return true;
    // Replaced, stopped (a hand on it, a change of room) or refused: nothing is used, the item goes back
    if (!subject.dry) o.care.clear(subject.key);
    if (outcome === 'refused') o.care.notify(`${o.blobbiName} can't get to that spot.`);
    return false;
  }, [face, lookAt, setGaze]);

  /** The write, or a pretend one: eager meanwhile; resolves how it ended. */
  const write = useCallback(async (run: Run, subject: Subject, eager: EyeOffset): Promise<UseOutcome> => {
    const o = live.current;
    face('excited');
    setGaze(eager);
    if (subject.dry) {
      await run.wait(PRETEND_WRITE_MS);
      const action = subject.item.care?.action ?? 'feed';
      const feedback: FeedbackResult = { action, name: o.blobbiName, statsChanged: { ...subject.item.care?.effects }, xpGained: 0, nextState: 'active', itemName: subject.item.name };
      return { kind: 'landed', result: null as never, feedback };
    }
    // The write is on its way: a cancel waits for it to land or fail, then takes effect
    return run.protect(() => o.care.begin(subject.key));
  }, [face, setGaze]);

  /** A glance at the player, then its own life. */
  const settle = useCallback(async (run: Run) => {
    face(null);
    setGaze({ x: 0, y: -0.15 });
    await run.wait(AFTER_GLANCE_MS);
    setGaze(null);
  }, [face, setGaze]);

  /** Food: eaten bite by bite once the write has landed, the dish emptying with it; then satisfied. */
  const eat = useCallback(async (run: Run, subject: Subject, dishId: string, outcome: UseOutcome) => {
    const o = live.current;
    if (outcome.kind === 'failed') {
      // The dish stays with the failure card (Retry, Put away); the face returns to its own
      face(null);
      setGaze(null);
      return;
    }
    const alreadyApplied = !subject.dry && !!outcome.result?.alreadyApplied;
    const action = subject.item.care?.action ?? 'feed';
    const bites = alreadyApplied ? 0 : bitesFor(action, o.reducedMotion);
    // The use has landed: whatever cuts the meal short from here (a change of room, a teleport), the result stands
    // and the offer is over, so nothing is left busy; the show alone is skipped
    let finished = false;
    run.cleanup(() => {
      if (finished) return;
      finished = true;
      if (!subject.dry) live.current.care.finish(subject.key, { feedback: outcome.feedback, alreadyApplied, soundPlayed: true });
    });
    if (run.cancelled || bites === 0) {
      finished = true;
      // Interrupted (a change of room, the page put away) or already applied before: the result stands, the show does not
      if (!subject.dry) o.care.finish(subject.key, { feedback: outcome.feedback, alreadyApplied });
      else o.care.celebrate(outcome.feedback);
      removeProp(dishId);
      return;
    }
    // The eating presentation (the faces and the dip) follows this moment; here the dish, the chews and the time
    face(null);
    if (!subject.dry) o.care.startEating(subject.key, bites);
    setEating({ key: subject.key, since: Date.now(), bites });
    run.cleanup(() => setEating(null));
    setGaze(ON_THE_DISH);
    const chew = action === 'boost' ? 'drink' : 'bite';
    for (let i = 1; i <= bites; i++) {
      o.play(chew);
      await run.wait(EAT.biteMs);
      updateProp(dishId, { bites: { taken: i, of: bites } });
    }
    setEating(null);
    o.play('yum');
    finished = true;
    if (!subject.dry) o.care.finish(subject.key, { feedback: outcome.feedback, soundPlayed: true });
    else o.care.celebrate(outcome.feedback, { soundPlayed: true });
    leaveProp(dishId);
    await settle(run);
  }, [face, setGaze, updateProp, removeProp, leaveProp, settle]);

  /** The ball game: nudge, watch it roll, chase, again; then pleased. */
  const playBall = useCallback(async (run: Run, subject: Subject, ballId: string, outcome: UseOutcome) => {
    const o = live.current;
    if (outcome.kind === 'failed') {
      face(null);
      setGaze(null);
      return;
    }
    const alreadyApplied = !subject.dry && !!outcome.result?.alreadyApplied;
    const kicks = alreadyApplied || run.cancelled ? 0 : o.reducedMotion ? 1 : PLAY.kicks;
    const control = () => live.current.controlRef.current;
    // The play has landed: a game cut short still ends its offer, so nothing is left busy
    let finished = false;
    run.cleanup(() => {
      if (finished) return;
      finished = true;
      if (!subject.dry) live.current.care.finish(subject.key, { feedback: outcome.feedback, alreadyApplied, soundPlayed: true });
    });
    // Its eyes on the ball as it rolls (the frames are the scene's; here a timer at the eyes' pace)
    let watching: ReturnType<typeof setInterval> | null = null;
    const watch = () => {
      if (watching) return;
      watching = setInterval(() => {
        const ball = control()?.propPosition(ballId);
        if (ball) lookAt(ball);
      }, 90);
    };
    const unwatch = () => {
      if (watching) clearInterval(watching);
      watching = null;
    };
    run.cleanup(unwatch);
    for (let i = 0; i < kicks; i++) {
      const c = control();
      const ball = c?.propPosition(ballId);
      const at = c?.blobbiPosition();
      if (!c || !ball || !at) break;
      // The nudge: the body's glad bounce, the bop, the ball away from it (a little to one side each time)
      face('excited');
      o.gesture('bounce');
      o.play('kick');
      const aim = (o.random?.() ?? Math.random()) * 2 - 1;
      const power = PLAY.power[0] + (PLAY.power[1] - PLAY.power[0]) * (o.random?.() ?? Math.random());
      c.kickProp(ballId, kickDirection(ball, at, aim), power);
      watch();
      // Watch it roll until it stops, or long enough
      await run.until(Promise.race([c.whenPropRests(ballId), new Promise<void>((resolve) => setTimeout(resolve, PLAY.rollMaxMs))]));
      unwatch();
      if (i === kicks - 1) break;
      // After it: happy on the way
      face('happy');
      o.play('chirp');
      const there = control()?.propPosition(ballId);
      if (!there || !o.nav.canWalk) break;
      const walk = await run.until(o.nav.approach(there.x, there.z));
      if (walk !== 'arrived') break;
    }
    unwatch();
    face(null);
    finished = true;
    if (!subject.dry) o.care.finish(subject.key, { feedback: outcome.feedback, alreadyApplied });
    else o.care.celebrate(outcome.feedback);
    // The ball stays in the room for the visit
    await settle(run);
  }, [face, setGaze, lookAt, settle]);

  // ─── The scenes ───
  const feedScene = useCallback((subject: Subject, from: 'start' | 'write') => async (run: Run) => {
    const dishId = `dish-${subject.key}`;
    if (from === 'start') {
      addProp({ id: dishId, kind: 'dish', x: subject.x, z: subject.z, food: propGlyphFor(subject.item), bites: { taken: 0, of: bitesFor(subject.item.care?.action ?? 'feed', live.current.reducedMotion) } });
      live.current.play('drop');
      if (!(await noticeAndApproach(run, subject))) {
        removeProp(dishId);
        return;
      }
    }
    const outcome = from === 'start' ? await write(run, subject, ON_THE_DISH) : await run.protect(() => live.current.care.retry() ?? Promise.resolve<UseOutcome>({ kind: 'failed', error: 'Nothing to try again.' }));
    await eat(run, subject, dishId, outcome);
  }, [addProp, removeProp, noticeAndApproach, write, eat]);

  const ballScene = useCallback((subject: Subject, from: 'start' | 'write') => async (run: Run) => {
    const ballId = `ball-${subject.key}`;
    if (from === 'start') {
      addProp({ id: ballId, kind: 'ball', x: subject.x, z: subject.z });
      live.current.play('bounce');
      if (!(await noticeAndApproach(run, subject))) {
        removeProp(ballId);
        return;
      }
    }
    const outcome = from === 'start' ? await write(run, subject, { x: 0, y: 0.5 }) : await run.protect(() => live.current.care.retry() ?? Promise.resolve<UseOutcome>({ kind: 'failed', error: 'Nothing to try again.' }));
    await playBall(run, subject, ballId, outcome);
  }, [addProp, removeProp, noticeAndApproach, write, playBall]);

  const plainScene = useCallback((subject: Subject, from: 'start' | 'write') => async (run: Run) => {
    const o = live.current;
    if (from === 'start' && !(await noticeAndApproach(run, subject))) return;
    const outcome = from === 'start' ? await write(run, subject, { x: 0, y: 0.5 }) : await run.protect(() => o.care.retry() ?? Promise.resolve<UseOutcome>({ kind: 'failed', error: 'Nothing to try again.' }));
    if (outcome.kind === 'failed') {
      face(null);
      setGaze(null);
      return;
    }
    face(null);
    if (!subject.dry) o.care.finish(subject.key, { feedback: outcome.feedback, alreadyApplied: !!outcome.result?.alreadyApplied });
    else o.care.celebrate(outcome.feedback);
    await settle(run);
  }, [noticeAndApproach, write, face, setGaze, settle]);

  const sceneFor = useCallback((subject: Subject, from: 'start' | 'write'): { kind: InteractionKind; script: (run: Run) => Promise<void> } => {
    const prop = propKindFor(subject.item);
    if (prop === 'dish') return { kind: 'feeding', script: feedScene(subject, from) };
    if (prop === 'ball') return { kind: 'playing', script: ballScene(subject, from) };
    return { kind: 'using', script: plainScene(subject, from) };
  }, [feedScene, ballScene, plainScene]);

  const runScene = useCallback((subject: Subject, from: 'start' | 'write') => {
    const { kind, script } = sceneFor(subject, from);
    setActivity(kind);
    const run = director.start(kind, async (r) => {
      try {
        await script(r);
      } catch (error) {
        if (!(error instanceof Interrupted)) throw error;
        throw error;
      }
    });
    void run.ended.then(() => {
      if (director.current() === null) setActivity(null);
    });
  }, [director, sceneFor]);

  // ─── What the room asks ───
  const offer = useCallback((entry: RoomCareEntry, plan: DropPlan, room: RoomId): boolean => {
    const o = live.current;
    if (!o.present || !o.enabled || plan.kind !== 'set-down') return false;
    const placed = o.care.place(entry, plan, room);
    if (!placed) return false;
    runScene({ key: placed.key, item: entry.choice.entry.item, name: entry.name, x: plan.x, z: plan.z, dry: false }, 'start');
    return true;
  }, [runScene]);

  const retry = useCallback(() => {
    const o = live.current;
    const current = o.care.offer;
    if (!current || current.phase !== 'failed') return;
    runScene({ key: current.key, item: current.choice.entry.item, name: current.name, x: current.place.x, z: current.place.z, dry: false }, 'write');
  }, [runScene]);

  const preview = useCallback((kind: 'feed' | 'ball', item: HomeItem) => {
    const o = live.current;
    const at = o.controlRef.current?.blobbiPosition() ?? { x: 3.5, z: 3.5 };
    const d = 1.1 / Math.SQRT2;
    const spot = { x: Math.min(7.4, at.x + d), z: Math.min(7.4, at.z + d) };
    const subject: Subject = { key: -Date.now(), item, name: item.name, x: spot.x, z: spot.z, dry: true };
    if (kind === 'ball') {
      setActivity('playing');
      const run = director.start('playing', ballScene(subject, 'start'));
      void run.ended.then(() => { if (director.current() === null) setActivity(null); });
      return;
    }
    setActivity('feeding');
    const run = director.start('feeding', feedScene(subject, 'start'));
    void run.ended.then(() => { if (director.current() === null) setActivity(null); });
  }, [director, ballScene, feedScene]);

  const onPropTap = useCallback((id: string) => {
    const o = live.current;
    if (!id.startsWith('ball-') || director.current() || !o.present) return;
    const c = o.controlRef.current;
    const ball = c?.propPosition(id);
    const at = c?.blobbiPosition();
    if (!c || !ball) return;
    // Sent rolling away from the Blobbi (or any way, from the middle); it looks after it
    const dir = at ? kickDirection(ball, at, (o.random?.() ?? Math.random()) * 2 - 1) : { x: 1, z: 1 };
    if (!c.kickProp(id, dir, PLAY.tapPower)) return;
    o.play('kick');
    o.showFace(FACE, 'curious', { priority: PRIORITY.reaction, durationMs: 1_100 });
    lookAt(ball);
    const watching = setInterval(() => {
      const there = live.current.controlRef.current?.propPosition(id);
      if (there) lookAt(there);
    }, 90);
    setTimeout(() => {
      clearInterval(watching);
      setGaze(null);
    }, 1_100);
  }, [director, lookAt, setGaze]);

  const cancel = useCallback((reason: CancelReason) => director.cancel(reason), [director]);

  // ─── What ends a scene from outside ───
  // A change of room: the scene ends, a waiting item goes back, every prop goes with the room
  const firstRoom = useRef(roomId);
  useEffect(() => {
    if (firstRoom.current === roomId) return;
    firstRoom.current = roomId;
    director.cancel('room');
    live.current.care.clear();
    clearAllProps();
  }, [roomId, director, clearAllProps]);
  // Gone (a teleport) or asleep: the scene ends; so when something else owns the Blobbi (decorating)
  useEffect(() => {
    if (!present) director.cancel('teleport');
  }, [present, director]);
  useEffect(() => {
    if (!enabled) director.cancel('disabled');
  }, [enabled, director]);
  useEffect(() => () => director.cancel('unmount'), [director]);
  // A dish whose offer is gone (put away, taken back) goes too, unless it is already on its way out
  const offerKey = care.offer?.key ?? null;
  useEffect(() => {
    setProps((ps) => {
      const next = ps.filter((p) => p.kind !== 'dish' || p.leaving || p.id === `dish-${offerKey}` || p.id.startsWith('dish--'));
      return next.length === ps.length ? ps : next;
    });
  }, [offerKey]);
  void reducedMotion;

  return useMemo(() => ({ props, gaze, activity, eating, offer, retry, onPropTap, preview, cancel }), [props, gaze, activity, eating, offer, retry, onPropTap, preview, cancel]);
}
