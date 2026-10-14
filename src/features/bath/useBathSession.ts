/**
 * One bath, played: the machine (`bath-machine.ts`) run as a script on an
 * interaction director (`room-interaction.ts`), so the whole bath can be
 * cancelled at any moment by what happens around it (a change of room, a
 * teleport, decorating, the page put away, Stop) and everything it borrowed
 * (the Blobbi's place in the tub, its face, its eyes) is given back at once.
 *
 * The session knows nothing of drawings, relays or rooms. The HOST does:
 *
 *   enter    walk to the tub and climb in (resolves false when the walk was
 *            stopped); absent, the Blobbi is bathed where it lies (an egg on
 *            its nest, a room without a tub)
 *   leave    out of the tub, however the bath ends
 *   commit   THE ONE WRITE, through the home's own use paths
 *            (`useUseItem` for an owned item, so one spend is signed and
 *            ledgered; `useStarterUse` for a starter), begun only when the
 *            last stage has passed; a cancel asked meanwhile is held off
 *            (`protect`) until it has landed or failed
 *   retry    the write again after a failure, the player's tap only (an
 *            owned spend resumes its own record, never a second one)
 *   face, gaze, gesture, play   the Blobbi's reactions, on whichever drawing
 *
 * Nothing is persisted: the state lives in this hook, and an unmount (a
 * refresh, leaving the room, the other home) cancels the run, which puts
 * the Blobbi back on the floor and writes nothing. Hygiene already full is
 * refused before anything starts (there is nothing to wash, and no free play
 * mode is offered).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STAT_MAX } from '@blobbi-kit/core';
import type { BlobbiVisualEffect } from '@blobbi-kit/renderer';
import type { CareChoice } from '@/features/home/care-model';
import type { ItemGlyphModel } from '@/features/inventory';
import type { EyeOffset } from '@/features/home/scene/gaze';
import type { PokeGesture } from '@/features/home/personality';
import type { BlobbiSoundId } from '@/features/sound/sounds';
import type { ExpressionName } from '@/features/expression/faces';
import { createDirector, type CancelReason, type Interaction, type Run } from '@/features/room/lib/room-interaction';
import { createBath, defaultMask, guidanceFor, isBathActive, isBathStage, reduce, toolFor, type BathEvent, type BathPoint, type BathStage, type BathState, type BathStatus, type BathTool } from './bath-machine';
import { readBodyMask, type BodyOutline, DEFAULT_OUTLINE } from './body-mask';

export type BathCommitOutcome = { kind: 'landed'; alreadyApplied?: boolean } | { kind: 'failed'; error: string };

/** What is being bathed with. */
export interface BathItem {
  choice: CareChoice;
  name: string;
  glyph: ItemGlyphModel;
}

export interface BathHost {
  /** The Blobbi's name, for the guidance. */
  name: string;
  reducedMotion: boolean;
  /** Its hygiene now (the projected stat); full, a bath is refused. */
  hygiene: number | undefined;
  /**
   * Where the script runs: the room's own director (so the room knows the Blobbi is busy and other scenes give way);
   * absent, the session keeps a director of its own.
   */
  start?: (name: string, script: (run: Run) => Promise<void>) => Interaction;
  /** Into the tub (a walk, a hop in); false when it could not. Null: bathed where it lies. */
  enter: ((run: Run) => Promise<boolean>) | null;
  /** Out of the tub, however the bath ends. */
  leave?: () => void;
  commit: (choice: CareChoice) => Promise<BathCommitOutcome>;
  retry?: (choice: CareChoice) => Promise<BathCommitOutcome>;
  /** The write landed: the host's own celebration (the chips, the sound), beside the session's. */
  onLanded?: (outcome: Extract<BathCommitOutcome, { kind: 'landed' }>, item: BathItem) => void;
  /** The canonical drawing on screen, to read the body's outline from; null for the plain body. */
  drawing?: () => SVGSVGElement | null;
  face: (name: ExpressionName | null) => void;
  gaze: (offset: EyeOffset | null) => void;
  gesture: (kind: PokeGesture) => void;
  play: (sound: BlobbiSoundId) => void;
  /** A short word to the player (why a bath cannot start). */
  notify?: (text: string) => void;
}

/** What the drawings show: the machine's body plus the words and the tool. */
export interface BathView {
  status: BathStatus;
  stage: BathStage | null;
  tool: BathTool | null;
  progress: number;
  guidance: string;
  item: BathItem;
  error: string | null;
  attempts: number;
  pointer: BathPoint | null;
  foam: readonly number[];
  wet: readonly number[];
  mask: readonly boolean[];
  grid: number;
  /** The body's feet and top in the box (for the drawings' water line and the 3D foam). */
  outline: BodyOutline;
  revision: number;
  /** Bathed where it lies: no tub. */
  inPlace: boolean;
  /** The bath is over and the Blobbi is glad of it. */
  celebrating: boolean;
  /** Changes with each bath. */
  key: number;
}

export interface BathInput {
  down: (point: BathPoint) => void;
  move: (point: BathPoint) => void;
  up: () => void;
}

export interface BathSession {
  view: BathView | null;
  /** From the first step to the write (a failed write waiting for Retry included). */
  active: boolean;
  /** Start a bath with this item; false (with a word to the player) when one cannot start now. */
  start: (item: BathItem, options?: { inPlace?: boolean }) => boolean;
  cancel: (reason: CancelReason) => void;
  /** The write again, after a failure (the player's tap). */
  retry: () => void;
  input: BathInput;
  /** The renderer's effects around the Blobbi right now (sparkles at the end). */
  effects: readonly BlobbiVisualEffect[];
}

/** The shower's clock while it is held (ms between two ticks). */
export const RINSE_TICK_MS = 50;
/** A passed stage: a glad moment before the next tool. */
const BEAT_MS = 520;
/** The glad face of a passed stage. */
const EXCITED_MS = 700;
/** How long the Blobbi is glad of its bath before it steps out. */
export const CELEBRATE_MS = 1_600;
/** How far the pointer must travel over the body before the Blobbi wiggles with pleasure again (box fractions). */
const WIGGLE_EVERY = 1.1;

const SPARKLES: readonly BlobbiVisualEffect[] = [{ id: 'golden-sparkles', intensity: 1 }];
const NONE: readonly BlobbiVisualEffect[] = [];

/** The face it wears through a stage. */
const STAGE_FACE: Readonly<Record<BathStage, ExpressionName | null>> = { entering: 'curious', soap: 'happy', rinse: 'affectionate', dry: 'happy' };

const schedule = (fn: () => void): (() => void) => {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(fn);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(fn, 16);
  return () => clearTimeout(id);
};

export function useBathSession(host: BathHost): BathSession {
  const live = useRef(host);
  live.current = host;
  const ownDirector = useMemo(() => createDirector(), []);

  /** The machine, read and written synchronously by the input; the view follows once a frame. */
  const machine = useRef<BathState | null>(null);
  const item = useRef<BathItem | null>(null);
  const outline = useRef<BodyOutline>(DEFAULT_OUTLINE);
  const inPlace = useRef(false);
  const celebrating = useRef(false);
  const key = useRef(0);
  const interaction = useRef<Interaction | null>(null);
  /** Who waits for a stage to pass, and for the player's Retry. */
  const stageWaiters = useRef(new Map<BathStatus, () => void>());
  const retryWaiter = useRef<(() => void) | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTick = useRef(0);
  const rubbedSince = useRef(0);
  const [view, setView] = useState<BathView | null>(null);
  const [effects, setEffects] = useState<readonly BlobbiVisualEffect[]>(NONE);
  const pendingFlush = useRef<(() => void) | null>(null);

  const snapshot = useCallback((): BathView | null => {
    const s = machine.current;
    const it = item.current;
    if (!s || !it || s.status === 'idle') return null;
    return {
      status: s.status,
      stage: isBathStage(s.status) ? s.status : null,
      tool: toolFor(s.status),
      progress: s.progress,
      guidance: guidanceFor(s.status, live.current.name),
      item: it,
      error: s.error,
      attempts: s.attempts,
      pointer: s.pointer,
      foam: s.foam,
      wet: s.wet,
      mask: s.mask,
      grid: s.grid,
      outline: outline.current,
      revision: s.revision,
      inPlace: inPlace.current,
      celebrating: celebrating.current,
      key: key.current,
    };
  }, []);

  /** The view follows the machine once a frame, never per pointer event. */
  const flush = useCallback(() => {
    if (pendingFlush.current) return;
    pendingFlush.current = schedule(() => {
      pendingFlush.current = null;
      const next = snapshot();
      setView(next);
      // Its eyes follow the tool in its hand
      const p = next?.pointer;
      if (p && next.stage && next.stage !== 'entering') live.current.gaze({ x: Math.max(-1, Math.min(1, (p.x - 0.5) * 2.2)), y: Math.max(-1, Math.min(1, (0.55 - p.y) * 1.8)) });
      else if (next && next.stage) live.current.gaze(null);
    });
  }, [snapshot]);
  useEffect(() => () => pendingFlush.current?.(), []);

  const stopTicks = useCallback(() => {
    if (tickTimer.current) clearInterval(tickTimer.current);
    tickTimer.current = null;
  }, []);

  const dispatch = useCallback((event: BathEvent) => {
    const before = machine.current;
    if (!before) return;
    const after = reduce(before, event);
    if (after === before) return;
    machine.current = after;
    if (after.status !== before.status) {
      stopTicks();
      rubbedSince.current = 0;
      const waiting = stageWaiters.current.get(before.status);
      stageWaiters.current.delete(before.status);
      waiting?.();
    }
    flush();
  }, [flush, stopTicks]);

  /** Resolves once the machine has left this status (the stage passed, or the bath ended). */
  const untilLeaves = useCallback((run: Run, status: BathStatus) => {
    if (machine.current?.status !== status) return Promise.resolve();
    return run.until(new Promise<void>((resolve) => stageWaiters.current.set(status, resolve)));
  }, []);

  const beat = useCallback(async (run: Run, next: BathStage) => {
    const o = live.current;
    o.face('excited');
    o.play('chirp');
    if (!o.reducedMotion) o.gesture('bounce');
    await run.wait(o.reducedMotion ? 200 : BEAT_MS);
    o.face(STAGE_FACE[next]);
    await run.wait(Math.max(0, EXCITED_MS - BEAT_MS));
  }, []);

  const script = useCallback((bathItem: BathItem, where: { inPlace: boolean }) => async (run: Run) => {
    const o = live.current;
    run.cleanup(() => {
      stopTicks();
      // Not done, not already cancelled: the end came from outside (a change of room, Stop, the page going)
      const s = machine.current;
      if (s && isBathActive(s.status)) dispatch({ type: 'cancel', reason: run.reason ?? 'stopped' });
      stageWaiters.current.clear();
      retryWaiter.current = null;
      live.current.face(null);
      live.current.gaze(null);
      live.current.leave?.();
      celebrating.current = false;
      setEffects(NONE);
      machine.current = null;
      item.current = null;
      flush();
    });
    dispatch({ type: 'begin', inPlace: where.inPlace });
    if (!where.inPlace) {
      o.face('curious');
      const ok = await run.until(o.enter!(run));
      if (!ok) {
        dispatch({ type: 'cancel', reason: 'stopped' });
        return;
      }
      // In it goes: a splash and a glad hop
      o.play('drop');
      if (!o.reducedMotion) o.gesture('bounce');
      dispatch({ type: 'entered' });
    }
    o.face(STAGE_FACE.soap);
    await untilLeaves(run, 'soap');
    run.check();
    await beat(run, 'rinse');
    await untilLeaves(run, 'rinse');
    run.check();
    await beat(run, 'dry');
    await untilLeaves(run, 'dry');
    run.check();
    // Every stage passed: the one write, held against a cancel until it has landed or failed
    o.face('happy');
    o.gaze(null);
    let outcome = await run.protect(() => live.current.commit(bathItem.choice));
    while (outcome.kind === 'failed') {
      dispatch({ type: 'failed', error: outcome.error });
      live.current.play('invalid');
      live.current.face('worried');
      await run.until(new Promise<void>((resolve) => { retryWaiter.current = resolve; }));
      retryWaiter.current = null;
      dispatch({ type: 'retry' });
      live.current.face('happy');
      outcome = await run.protect(() => (live.current.retry ?? live.current.commit)(bathItem.choice));
    }
    dispatch({ type: 'landed' });
    live.current.onLanded?.(outcome, bathItem);
    // Squeaky clean: glad, a hop, sparkles (not under reduced motion), then out of the tub
    celebrating.current = true;
    flush();
    live.current.face('excited');
    if (!live.current.reducedMotion) {
      live.current.gesture('bounce');
      setEffects(SPARKLES);
    }
    await run.wait(live.current.reducedMotion ? 600 : CELEBRATE_MS);
  }, [dispatch, flush, untilLeaves, beat, stopTicks]);

  const start = useCallback((bathItem: BathItem, options: { inPlace?: boolean } = {}): boolean => {
    const o = live.current;
    if (machine.current && isBathActive(machine.current.status)) return false;
    if (o.hygiene !== undefined && o.hygiene >= STAT_MAX) {
      o.notify?.(`${o.name} is already squeaky clean. Nothing to wash yet!`);
      return false;
    }
    const where = { inPlace: !!options.inPlace || o.enter === null };
    key.current += 1;
    const thisKey = key.current;
    item.current = bathItem;
    inPlace.current = where.inPlace;
    outline.current = DEFAULT_OUTLINE;
    celebrating.current = false;
    machine.current = createBath(defaultMask());
    // The body's own outline, read from the drawing when it can be; until then (and without one) the plain body
    const svg = o.drawing?.() ?? null;
    void readBodyMask(svg).then(({ mask, outline: read }) => {
      const s = machine.current;
      if (key.current !== thisKey || !s || s.revision > 0 || !isBathStage(s.status)) return;
      outline.current = read;
      machine.current = { ...s, mask, foam: s.foam.map(() => 0), wet: s.wet.map(() => 0) };
      flush();
    });
    const begin = o.start ?? ((name: string, fn: (run: Run) => Promise<void>) => ownDirector.start(name, fn));
    interaction.current = begin('bathing', script(bathItem, where));
    flush();
    return true;
  }, [script, flush, ownDirector]);

  const cancel = useCallback((reason: CancelReason) => {
    const current = interaction.current;
    if (!current) return;
    interaction.current = null;
    current.cancel(reason);
  }, []);

  const retry = useCallback(() => {
    if (machine.current?.status !== 'failed') return;
    retryWaiter.current?.();
  }, []);

  // ─── The pointer, in the Blobbi's box ───
  const down = useCallback((point: BathPoint) => {
    const s = machine.current;
    if (!s || !isBathStage(s.status) || s.status === 'entering') return;
    dispatch({ type: 'pointer-down', point });
    if (machine.current?.status === 'rinse') {
      lastTick.current = Date.now();
      stopTicks();
      tickTimer.current = setInterval(() => {
        const now = Date.now();
        const dt = Math.min(200, now - lastTick.current);
        lastTick.current = now;
        dispatch({ type: 'tick', dtMs: dt });
      }, RINSE_TICK_MS);
    }
  }, [dispatch, stopTicks]);

  const move = useCallback((point: BathPoint) => {
    const s = machine.current;
    if (!s || !isBathStage(s.status) || s.status === 'entering') return;
    const before = s.stroke?.travelled ?? 0;
    dispatch({ type: 'pointer-move', point });
    const after = machine.current?.stroke?.travelled ?? 0;
    // Rubbed a good way: a wiggle of pleasure now and then (the soap and the towel; never under reduced motion)
    if (after > before && machine.current && (machine.current.status === 'soap' || machine.current.status === 'dry')) {
      rubbedSince.current += after - before;
      if (rubbedSince.current >= WIGGLE_EVERY) {
        rubbedSince.current = 0;
        const o = live.current;
        o.play('pet');
        if (!o.reducedMotion) o.gesture('wiggle');
      }
    }
  }, [dispatch]);

  const up = useCallback(() => {
    stopTicks();
    dispatch({ type: 'pointer-up' });
  }, [dispatch, stopTicks]);

  // The page goes: the run is cancelled, the Blobbi put back, nothing written that was not already on its way
  useEffect(() => () => {
    stopTicks();
    interaction.current?.cancel('unmount');
    interaction.current = null;
  }, [stopTicks]);

  const input = useMemo<BathInput>(() => ({ down, move, up }), [down, move, up]);
  const active = view !== null && isBathActive(view.status);
  return useMemo(() => ({ view, active, start, cancel, retry, input, effects }), [view, active, start, cancel, retry, input, effects]);
}
