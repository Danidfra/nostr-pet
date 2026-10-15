/**
 * One care ritual, played: the machine (`bath-machine.ts`) walking the
 * ritual's stages (`rituals.ts`), run as a script on an interaction director
 * (`room-interaction.ts`), so the whole ritual can be cancelled at any moment
 * by what happens around it (a change of room, a teleport, decorating, the
 * page put away, Stop) and everything it borrowed (the Blobbi's place in the
 * tub, its face, its eyes) is given back at once.
 *
 * The session knows nothing of drawings, relays or rooms. The HOST does:
 *
 *   enter    a soak's jump in: walk to the tub and jump into it (resolves
 *            false when the walk was stopped); null, there is no tub here (an
 *            egg on its nest, a room without one) and a soak is played where
 *            the Blobbi stands, a hop for each jump
 *   exit     a soak's jump out, onto the floor beside the tub
 *   leave    the ritual is over, however it ended: back on the floor
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
import { createBath, currentStage, defaultMask, frameSource, guidanceFor, headFor, isBathActive, isHandStage, reduce, toolFor, type BathEvent, type BathPoint, type BathState, type BathStatus, type BathTool, type BoxPx } from './bath-machine';
import { frameFromState, type BathFrame } from './bath-frame';
import { ritualFor, type RitualDef, type RitualStage, type RitualStageId } from './rituals';
import { readBodyMask, type BodyOutline, DEFAULT_OUTLINE } from './body-mask';

export type BathCommitOutcome = { kind: 'landed'; alreadyApplied?: boolean } | { kind: 'failed'; error: string };

/** What the ritual is played with. */
export interface BathItem {
  choice: CareChoice;
  name: string;
  glyph: ItemGlyphModel;
}

export interface BathHost {
  /** The Blobbi's name, for the guidance. */
  name: string;
  reducedMotion: boolean;
  /** Its hygiene now (the projected stat); full, a ritual is refused. */
  hygiene: number | undefined;
  /**
   * Where the script runs: the room's own director (so the room knows the Blobbi is busy and other scenes give way);
   * absent, the session keeps a director of its own.
   */
  start?: (name: string, script: (run: Run) => Promise<void>) => Interaction;
  /** A soak's jump into the tub (a walk, a jump in); false when it could not. Null: no tub here, a soak is played in place. */
  enter: ((run: Run) => Promise<boolean>) | null;
  /** A soak's jump out of the tub, onto the floor. */
  exit?: (run: Run) => Promise<void>;
  /** The ritual is over, however it ended. */
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
  /** A short word to the player (why a ritual cannot start). */
  notify?: (text: string) => void;
}

/** What the bar and the hosts show: the frame (the renderers') plus the words, the item and the ways out. */
export interface BathView {
  status: BathStatus;
  ritual: RitualDef;
  /** The stage under way, or null. */
  stage: RitualStage | null;
  stageId: RitualStageId | null;
  tool: BathTool | null;
  progress: number;
  guidance: string;
  item: BathItem;
  error: string | null;
  attempts: number;
  /** The render model every renderer reads (`bath-frame.ts`). */
  frame: BathFrame;
  /** The body's outline in the box (the drawings' water line, the 3D foam). */
  outline: BodyOutline;
  /** Played where the Blobbi stands: no tub. */
  inPlace: boolean;
  /** The body's outline is known: the layer takes the rubbing (before, a stroke would be laid on a guess). */
  ready: boolean;
  /** The ritual is over and the Blobbi is glad of it. */
  celebrating: boolean;
  /** Changes with each ritual. */
  key: number;
}

export interface BathInput {
  down: (point: BathPoint) => void;
  move: (point: BathPoint) => void;
  up: () => void;
  /** The layer's box on screen (px), for the rules measured in px. */
  measure: (box: BoxPx) => void;
}

export interface BathSession {
  view: BathView | null;
  /** From the first step to the write (a failed write waiting for Retry included). */
  active: boolean;
  /** Start a ritual with this item; false (with a word to the player) when one cannot start now. */
  start: (item: BathItem, options?: { inPlace?: boolean }) => boolean;
  cancel: (reason: CancelReason) => void;
  /** The write again, after a failure (the player's tap). */
  retry: () => void;
  input: BathInput;
  /** The renderer's effects around the Blobbi right now (sparkles at the end). */
  effects: readonly BlobbiVisualEffect[];
}

/** The ritual's clock (ms between two ticks): the shower while held, a timed stage. */
export const RINSE_TICK_MS = 50;
/** A passed stage: a glad moment before the next tool. */
const BEAT_MS = 520;
/** The glad face of a passed stage. */
const EXCITED_MS = 700;
/** How long a wet Blobbi shakes itself dry after the write landed. */
export const SHAKE_MS = 700;
/** How long the Blobbi is glad of its care before the ritual leaves the screen. */
export const CELEBRATE_MS = 1_600;
/** How long the body's outline may take to read before the plain body stands in (nothing is rubbed meanwhile). */
const MASK_WAIT_MS = 700;
/** How far the pointer must travel over the body before the Blobbi wiggles with pleasure again (box fractions). */
const WIGGLE_EVERY = 1.1;
/** A jump in place (a soak with no tub here). */
const HOP_MS = 520;

const SPARKLES: readonly BlobbiVisualEffect[] = [{ id: 'golden-sparkles', intensity: 1 }];
const NONE: readonly BlobbiVisualEffect[] = [];

/** The face it wears through a stage. */
const STAGE_FACE: Readonly<Record<RitualStageId, ExpressionName | null>> = { lather: 'happy', rinse: 'affectionate', dry: 'happy', 'jump-in': 'curious', play: 'excited', 'jump-out': 'happy' };

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
  /** Who waits for the machine to move on (a stage passed, the bath ended), and for the player's Retry. */
  const moveWaiter = useRef<(() => void) | null>(null);
  const retryWaiter = useRef<(() => void) | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const maskTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTick = useRef(0);
  const rubbedSince = useRef(0);
  const [view, setView] = useState<BathView | null>(null);
  const [effects, setEffects] = useState<readonly BlobbiVisualEffect[]>(NONE);
  const pendingFlush = useRef<(() => void) | null>(null);

  const snapshot = useCallback((): BathView | null => {
    const s = machine.current;
    const it = item.current;
    if (!s || !it || s.status === 'idle') return null;
    const stage = currentStage(s);
    const frame = frameFromState(frameSource(s), {
      key: key.current,
      ritual: s.ritual,
      place: inPlace.current ? 'in-place' : s.ritual.place,
      outline: outline.current,
      reducedMotion: live.current.reducedMotion,
    });
    return {
      status: s.status,
      ritual: s.ritual,
      stage,
      stageId: stage?.id ?? null,
      tool: toolFor(s),
      progress: s.progress,
      guidance: guidanceFor(s, live.current.name),
      item: it,
      error: s.error,
      attempts: s.attempts,
      frame,
      outline: outline.current,
      inPlace: inPlace.current,
      ready: s.maskReady,
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
      const s = machine.current;
      const p = s ? headFor(s, s.pointer) : null;
      if (p && next?.tool) live.current.gaze({ x: Math.max(-1, Math.min(1, (p.x - 0.5) * 2.2)), y: Math.max(-1, Math.min(1, (0.55 - p.y) * 1.8)) });
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
    if (after.status !== before.status || after.stageIndex !== before.stageIndex) {
      rubbedSince.current = 0;
      const waiting = moveWaiter.current;
      moveWaiter.current = null;
      waiting?.();
    }
    flush();
  }, [flush]);

  /** The ritual's clock: one tick every `RINSE_TICK_MS` while it runs (the machine ignores a tick that changes nothing). */
  const startTicks = useCallback(() => {
    stopTicks();
    lastTick.current = Date.now();
    tickTimer.current = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(200, now - lastTick.current);
      lastTick.current = now;
      dispatch({ type: 'tick', dtMs: dt });
    }, RINSE_TICK_MS);
  }, [dispatch, stopTicks]);

  /** Resolves once the machine has moved on from this stage (passed, or the ritual ended). */
  const untilMoves = useCallback((run: Run) => {
    const s = machine.current;
    if (!s) return Promise.resolve();
    const at = { status: s.status, index: s.stageIndex };
    return run.until(new Promise<void>((resolve) => {
      const check = () => {
        const now = machine.current;
        if (!now || now.status !== at.status || now.stageIndex !== at.index) resolve();
        else moveWaiter.current = check;
      };
      check();
    }));
  }, []);

  const beat = useCallback(async (run: Run, next: RitualStage) => {
    const o = live.current;
    o.face('excited');
    o.play('chirp');
    if (!o.reducedMotion) o.gesture('bounce');
    await run.wait(o.reducedMotion ? 200 : BEAT_MS);
    o.face(STAGE_FACE[next.id]);
    await run.wait(Math.max(0, EXCITED_MS - BEAT_MS));
  }, []);

  /** A script stage: the host's jump (into the tub, out of it), or a hop where it stands. False: it could not (the walk was stopped). */
  const playScript = useCallback(async (run: Run, stage: RitualStage): Promise<boolean> => {
    const o = live.current;
    const hop = async () => {
      if (!o.reducedMotion) o.gesture('bounce');
      await run.wait(o.reducedMotion ? 200 : HOP_MS);
    };
    if (stage.id === 'jump-in') {
      o.face('curious');
      if (!inPlace.current && o.enter) {
        const ok = await run.until(o.enter(run));
        if (!ok) return false;
      } else await hop();
      // In it goes: a splash and a glad hop
      o.play('drop');
      return true;
    }
    if (stage.id === 'jump-out') {
      if (!inPlace.current && o.exit) await run.until(o.exit(run));
      else await hop();
      o.play('drop');
      return true;
    }
    return true;
  }, []);

  const script = useCallback((bathItem: BathItem) => async (run: Run) => {
    run.cleanup(() => {
      stopTicks();
      if (maskTimer.current) clearTimeout(maskTimer.current);
      maskTimer.current = null;
      // Not done, not already cancelled: the end came from outside (a change of room, Stop, the page going)
      const s = machine.current;
      if (s && isBathActive(s.status)) dispatch({ type: 'cancel', reason: run.reason ?? 'stopped' });
      moveWaiter.current = null;
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
    dispatch({ type: 'begin' });
    startTicks();
    // Each stage in turn, a glad beat between the ones the player plays
    for (;;) {
      const s = machine.current;
      const stage = s ? currentStage(s) : null;
      if (!s || !stage) break;
      if (stage.kind === 'script') {
        const ok = await playScript(run, stage);
        run.check();
        if (!ok) {
          dispatch({ type: 'cancel', reason: 'stopped' });
          return;
        }
        dispatch({ type: 'script-done' });
        continue;
      }
      live.current.face(STAGE_FACE[stage.id]);
      await untilMoves(run);
      run.check();
      const after = machine.current ? currentStage(machine.current) : null;
      if (isHandStage(stage) && after && isHandStage(after)) await beat(run, after);
    }
    stopTicks();
    run.check();
    // Every stage passed: the one write, held against a cancel until it has landed or failed
    const o = live.current;
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
    celebrating.current = true;
    flush();
    // A wet Blobbi shakes itself dry first (only once the write has landed)
    if ((machine.current?.wetness ?? 0) > 0) {
      live.current.face('excited');
      if (!live.current.reducedMotion) live.current.gesture('wiggle');
      await run.wait(live.current.reducedMotion ? 300 : SHAKE_MS);
      dispatch({ type: 'shaken' });
    }
    // Squeaky clean: glad, a hop, sparkles (not under reduced motion)
    live.current.face('excited');
    if (!live.current.reducedMotion) {
      live.current.gesture('bounce');
      setEffects(SPARKLES);
    }
    await run.wait(live.current.reducedMotion ? 600 : CELEBRATE_MS);
  }, [dispatch, flush, untilMoves, beat, stopTicks, startTicks, playScript]);

  const start = useCallback((bathItem: BathItem, options: { inPlace?: boolean } = {}): boolean => {
    const o = live.current;
    if (machine.current && isBathActive(machine.current.status)) return false;
    if (o.hygiene !== undefined && o.hygiene >= STAT_MAX) {
      o.notify?.(`${o.name} is already squeaky clean. Nothing to wash yet!`);
      return false;
    }
    const ritual = ritualFor(bathItem.choice.entry.item.itemId);
    key.current += 1;
    const thisKey = key.current;
    item.current = bathItem;
    // Only a soak goes to the tub, and only where there is one
    inPlace.current = ritual.place !== 'tub' || !!options.inPlace || o.enter === null;
    outline.current = DEFAULT_OUTLINE;
    celebrating.current = false;
    machine.current = createBath(ritual, defaultMask());
    // The body's own outline, read from the drawing when it can be; nothing is rubbed until it is (or the wait is over)
    const svg = o.drawing?.() ?? null;
    if (maskTimer.current) clearTimeout(maskTimer.current);
    maskTimer.current = setTimeout(() => {
      maskTimer.current = null;
      if (key.current === thisKey) dispatch({ type: 'mask', body: defaultMask() });
    }, MASK_WAIT_MS);
    void readBodyMask(svg).then(({ mask, outline: read }) => {
      if (key.current !== thisKey || !machine.current || machine.current.maskReady) return;
      outline.current = read;
      dispatch({ type: 'mask', body: mask, top: read.top });
    });
    const begin = o.start ?? ((name: string, fn: (run: Run) => Promise<void>) => ownDirector.start(name, fn));
    interaction.current = begin('bathing', script(bathItem));
    flush();
    return true;
  }, [script, flush, ownDirector, dispatch]);

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
    if (!s || !isHandStage(currentStage(s))) return;
    dispatch({ type: 'pointer-down', point });
  }, [dispatch]);

  const move = useCallback((point: BathPoint) => {
    const s = machine.current;
    if (!s || !isHandStage(currentStage(s))) return;
    const before = s.stroke?.travelled ?? 0;
    dispatch({ type: 'pointer-move', point });
    const now = machine.current;
    const after = now?.stroke?.travelled ?? 0;
    // Rubbed a good way: a wiggle of pleasure now and then (the lather and the towel; never under reduced motion)
    const kind = now ? currentStage(now)?.kind : undefined;
    if (after > before && (kind === 'rub' || kind === 'dry-rub')) {
      rubbedSince.current += after - before;
      if (rubbedSince.current >= WIGGLE_EVERY) {
        rubbedSince.current = 0;
        const o = live.current;
        o.play('pet');
        if (!o.reducedMotion) o.gesture('wiggle');
      }
    }
  }, [dispatch]);

  const up = useCallback(() => dispatch({ type: 'pointer-up' }), [dispatch]);
  const measure = useCallback((box: BoxPx) => dispatch({ type: 'measure', box }), [dispatch]);

  // The page goes: the run is cancelled, the Blobbi put back, nothing written that was not already on its way
  useEffect(() => () => {
    stopTicks();
    if (maskTimer.current) clearTimeout(maskTimer.current);
    interaction.current?.cancel('unmount');
    interaction.current = null;
  }, [stopTicks]);

  const input = useMemo<BathInput>(() => ({ down, move, up, measure }), [down, move, up, measure]);
  const active = view !== null && isBathActive(view.status);
  return useMemo(() => ({ view, active, start, cancel, retry, input, effects }), [view, active, start, cancel, retry, input, effects]);
}
