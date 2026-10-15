/**
 * The care rituals as one pure machine: the same game over the 2D home's
 * drawing and the 3D room's model. The ritual (`rituals.ts`) is an ordered
 * list of stages; the machine walks it and passes each by its own rule:
 *
 *   idle → stage 0 → stage 1 → … → committing → done
 *                                             ↘ failed → committing (the player's retry)
 *   any stage, and failed → cancelled
 *
 *   rub       (the soap, the shampoo) the tool is dragged over the body and a
 *             cell is lathered when the brush passes over it; the stage passes
 *             once most of the visible body is foamed.
 *   rinse     the shower is held over (or above) the body: water falls in a
 *             column under its head and a foamed cell under it is rinsed after
 *             a moment there; the head has to travel across the body.
 *   dry-rub   the towel, rubbed like the soap; a cell is towelled when the
 *             brush passes over it.
 *   timed     the player watches (the play in the water): it passes with time.
 *   script    the host's (a jump into the tub, out of it): it passes when the
 *             host says it has (`script-done`).
 *
 * The body is a coarse grid over the Blobbi's art box (`BATH_GRID` cells a
 * side), masked by its silhouette; a cell is visible when the player can see
 * it (not under the tub's water). Only visible body cells count, and what is
 * counted is exactly what a renderer draws (booleans: `bath-frame.ts`). The
 * last few cells of a stage finish themselves, so a stage never hangs on a
 * cell nobody can find.
 *
 * Every stage the player plays is passed by COVERAGE, never by a tap: a
 * press that has not moved past a tap's slop lays nothing, and the shower
 * works with time under its head. Nothing is rubbed before the body's own
 * outline is known (`mask`), so what is laid is never thrown away.
 *
 * `committing` is where the one write happens (the host's, not this
 * module's); nothing before it touches the item or the relays, and a cancel
 * never consumes anything. A failed write waits for the player's Retry
 * (never by itself); a cancel while the write is out is held off by the
 * session (`protect`), not here: this machine refuses to leave `committing`
 * except by `landed` or `failed`. A landed wash or soak leaves the Blobbi
 * wet: it shakes (a `shake` cue), then `shaken` dries it and the celebration
 * begins (`done` cue).
 *
 * Pure and deterministic: `reduce(state, event)` returns a new state and
 * mutates nothing, so every rule above is a unit test.
 */
import type { CancelReason } from '@/features/room/lib/room-interaction';
import type { BathCue, BathCueKind, BathFrameStatus, FrameSource } from './bath-frame';
import { stageAt, type RitualDef, type RitualStage, type RitualStageId } from './rituals';

export type BathStatus = BathFrameStatus;
export type BathTool = 'soap' | 'shower' | 'towel';

/** A point in the Blobbi's art box: x across (0 left, 1 right), y up (0 the box's bottom, 1 its top). */
export interface BathPoint {
  x: number;
  y: number;
}

/** The box's size on screen (px), for the rules measured in px (the brush, the shower's column, a tap's slop). */
export interface BoxPx {
  w: number;
  h: number;
}

/** Cells a side of the body grid. Row 0 is the bottom of the box. */
export const BATH_GRID = 8;

/** The rules, as numbers. */
export const BATH_RULES = {
  /** Distance along a drag between two samples (box fractions): a third of a cell. */
  sampleStep: 1 / (BATH_GRID * 3),
  /** How far round a sample the brush reaches (cells), and never less than this many px (a 24 px brush at the least). */
  brushCells: 1,
  brushMinPx: 12,
  /** How far a pointer may move and still be a tap: a share of the box, and never less than these px. */
  tapSlop: 0.01,
  tapSlopPx: 5,
  /** The shower: its column's half width (box fractions, never under the px), how high above the body it still reaches (box fractions above the top of the body), how long a cell under the middle of the column takes to rinse (s), and how far above the finger its head is drawn and works (px). */
  columnHalf: 0.15,
  columnHalfMinPx: 9,
  showerReach: 0.8,
  rinseCellSeconds: 0.35,
  showerLiftPx: 26,
  /** How much of the visible body each stage must reach; the last `autoFinish` cells finish themselves. */
  rubDone: 0.75,
  rinseDone: 0.85,
  dryDone: 0.7,
  autoFinish: 2,
} as const;

export interface BathState {
  status: BathStatus;
  ritual: RitualDef;
  /** The stage under way (an index into `ritual.stages`). */
  stageIndex: number;
  grid: number;
  /** Which cells are the body, and which of them the player can see (row-major, row 0 at the bottom). */
  body: readonly boolean[];
  visible: readonly boolean[];
  /** The body's own outline has been read (or given up on): only then is anything rubbed. */
  maskReady: boolean;
  /** The top of the body in the box (for how high the shower still reaches). */
  bodyTop: number;
  /** Below this height in the box the body is hidden (under the tub's water): those cells do not count. */
  hiddenBelow: number;
  foamed: readonly boolean[];
  wet: readonly boolean[];
  dry: readonly boolean[];
  /** Seconds each foamed cell has spent under the shower. */
  rinse: readonly number[];
  /** The box's size on screen, once measured. */
  boxPx: BoxPx | null;
  /** The drag under way: where it last was and how far it has travelled over the box. */
  stroke: { last: BathPoint; travelled: number } | null;
  /** Where the pointer is (the finger), or null while nothing is pressed. */
  pointer: BathPoint | null;
  /** How far the current stage has come, 0..1. */
  progress: number;
  /** A timed stage's time so far (ms); a rinse's foam to take off when it began (cells). */
  elapsedMs: number;
  startCount: number;
  wetness: number;
  /** Writes attempted so far (the first and every retry). */
  attempts: number;
  error: string | null;
  reason: CancelReason | null;
  /** The stages passed, in order. */
  completed: readonly RitualStageId[];
  cues: readonly BathCue[];
  /** Counts every change of the cells, for cheap memoisation. */
  revision: number;
}

export type BathEvent =
  | { type: 'begin'; hiddenBelow?: number }
  | { type: 'mask'; body: readonly boolean[]; top?: number }
  | { type: 'measure'; box: BoxPx }
  | { type: 'pointer-down'; point: BathPoint }
  | { type: 'pointer-move'; point: BathPoint }
  | { type: 'pointer-up' }
  | { type: 'tick'; dtMs: number }
  | { type: 'script-done' }
  | { type: 'landed' }
  | { type: 'shaken' }
  | { type: 'failed'; error: string }
  | { type: 'retry' }
  | { type: 'cancel'; reason: CancelReason };

/** The stage under way, or null (before the first, from the write on). */
export function currentStage(state: Pick<BathState, 'status' | 'ritual' | 'stageIndex'>): RitualStage | null {
  return state.status === 'stage' ? stageAt(state.ritual, state.stageIndex) : null;
}

/** The tool in the player's hand now. */
export function toolFor(state: Pick<BathState, 'status' | 'ritual' | 'stageIndex'>): BathTool | null {
  return currentStage(state)?.tool ?? null;
}

/** The player has something to do with the pointer now (a rub, a rinse, a towelling). */
export function isHandStage(stage: RitualStage | null): boolean {
  return stage?.kind === 'rub' || stage?.kind === 'rinse' || stage?.kind === 'dry-rub';
}

/** The ritual is under way: anything from the first stage to the write (a `failed` write is still under way, waiting for Retry). */
export function isBathActive(status: BathStatus): boolean {
  return status !== 'idle' && status !== 'done' && status !== 'cancelled';
}

/** A fresh machine for a ritual over a body mask (`bodyMask`, `defaultMask` or a test's own); not ready to rub until `mask` (unless `ready`). */
export function createBath(ritual: RitualDef, body: readonly boolean[], options: { grid?: number; ready?: boolean } = {}): BathState {
  const grid = options.grid ?? BATH_GRID;
  if (body.length !== grid * grid) throw new Error(`a bath mask has ${grid * grid} cells, not ${body.length}`);
  const cells = grid * grid;
  const none = new Array<boolean>(cells).fill(false);
  return {
    status: 'idle',
    ritual,
    stageIndex: 0,
    grid,
    body,
    visible: body,
    maskReady: options.ready ?? false,
    bodyTop: 0.92,
    hiddenBelow: 0,
    foamed: none,
    wet: none,
    dry: none,
    rinse: new Array<number>(cells).fill(0),
    boxPx: null,
    stroke: null,
    pointer: null,
    progress: 0,
    elapsedMs: 0,
    startCount: 0,
    wetness: 0,
    attempts: 0,
    error: null,
    reason: null,
    completed: [],
    cues: [],
    revision: 0,
  };
}

/** A plain body mask when no drawing can be read: an egg-ish ellipse over the middle of the box (`BLOB_SILHOUETTE`'s shape). */
export function defaultMask(grid = BATH_GRID): boolean[] {
  const mask: boolean[] = [];
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const h = (row + 0.5) / grid;
      const x = (col + 0.5) / grid - 0.5;
      const half = 0.3 * Math.sqrt(Math.max(0, 1 - ((h - 0.45) / 0.5) ** 2));
      mask.push(Math.abs(x) <= half);
    }
  }
  return mask;
}

/** Row-major index of a cell. */
export const cellIndex = (grid: number, col: number, row: number) => row * grid + col;

/** The centre of a cell in box coordinates. */
export function cellCenter(grid: number, index: number): BathPoint {
  return { x: (index % grid + 0.5) / grid, y: (Math.floor(index / grid) + 0.5) / grid };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function count(values: readonly boolean[], within: readonly boolean[]): number {
  let n = 0;
  for (let i = 0; i < values.length; i++) if (within[i] && values[i]) n++;
  return n;
}

const visibleCount = (s: BathState) => count(s.visible, s.visible);

/** The body cells the player can see: above the water line. */
function visibleOf(body: readonly boolean[], grid: number, hiddenBelow: number): boolean[] {
  return body.map((b, i) => b && cellCenter(grid, i).y >= hiddenBelow);
}

/** The brush's reach round a sample, in box units across and up: a cell's worth, never under the px minimum. */
export function brushRadius(state: Pick<BathState, 'grid' | 'boxPx'>): { rx: number; ry: number } {
  const cells = BATH_RULES.brushCells / state.grid;
  if (!state.boxPx || state.boxPx.w <= 0 || state.boxPx.h <= 0) return { rx: cells, ry: cells };
  return { rx: Math.max(cells, BATH_RULES.brushMinPx / state.boxPx.w), ry: Math.max(cells, BATH_RULES.brushMinPx / state.boxPx.h) };
}

/** The shower's column half width (box units): a share of the box, never under the px minimum. */
export function columnHalfWidth(state: Pick<BathState, 'boxPx'>): number {
  if (!state.boxPx || state.boxPx.w <= 0) return BATH_RULES.columnHalf;
  return Math.max(BATH_RULES.columnHalf, BATH_RULES.columnHalfMinPx / state.boxPx.w);
}

/** Where the tool's head is for a pointer: the shower's a little above the finger (so the finger never hides it or the face); the others at it. */
export function headFor(state: Pick<BathState, 'boxPx' | 'status' | 'ritual' | 'stageIndex'>, pointer: BathPoint | null): BathPoint | null {
  if (!pointer) return null;
  if (toolFor(state) !== 'shower') return pointer;
  const lift = state.boxPx && state.boxPx.h > 0 ? BATH_RULES.showerLiftPx / state.boxPx.h : 0.15;
  return { x: pointer.x, y: pointer.y + lift };
}

function tapSlop(state: Pick<BathState, 'boxPx'>): number {
  if (!state.boxPx || state.boxPx.w <= 0) return BATH_RULES.tapSlop;
  return Math.max(BATH_RULES.tapSlop, BATH_RULES.tapSlopPx / state.boxPx.w);
}

/** Mark the visible body cells the brush covers at a point. */
function brush(values: readonly boolean[], state: BathState, at: BathPoint, mark: boolean): { values: boolean[]; changed: boolean } {
  const { rx, ry } = brushRadius(state);
  const next = [...values];
  let changed = false;
  for (let i = 0; i < next.length; i++) {
    if (!state.visible[i] || next[i] === mark) continue;
    const c = cellCenter(state.grid, i);
    const dx = (c.x - at.x) / rx;
    const dy = (c.y - at.y) / ry;
    if (dx * dx + dy * dy > 1) continue;
    next[i] = mark;
    changed = true;
  }
  return { values: next, changed };
}

/** The samples a drag from `from` to `to` lays: every `sampleStep` along it, the end included when it moved at all. */
export function strokeSamples(from: BathPoint, to: BathPoint, step = BATH_RULES.sampleStep): BathPoint[] {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  if (dist <= 0) return [];
  const n = Math.max(1, Math.floor(dist / step));
  const out: BathPoint[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  }
  return out;
}

function withCue(state: BathState, kind: BathCueKind): readonly BathCue[] {
  const last = state.cues.length > 0 ? state.cues[state.cues.length - 1].id : 0;
  return [...state.cues, { id: last + 1, kind }];
}

/** Into a stage: its own starting point. */
function enterStage(state: BathState, index: number): BathState {
  const stage = stageAt(state.ritual, index);
  if (!stage) {
    // Every stage passed: the write
    return { ...state, status: 'committing', stageIndex: index, progress: 1, stroke: null, pointer: null, attempts: state.attempts + 1 };
  }
  const next: BathState = { ...state, status: 'stage', stageIndex: index, progress: 0, elapsedMs: 0, stroke: null };
  if (stage.kind === 'rinse') next.startCount = count(state.foamed, state.visible);
  return next;
}

/** A stage passed: what it leaves behind, the cue it plays, and the next one. */
function pass(state: BathState): BathState {
  const stage = currentStage(state);
  if (!stage) return state;
  let next: BathState = { ...state, completed: [...state.completed, stage.id], pointer: null, stroke: null };
  const all = (values: readonly boolean[], mark: boolean) => values.map((v, i) => (state.visible[i] ? mark : v));
  switch (stage.kind) {
    case 'rub':
      // The last of the lather finishes itself: what is drawn is what was counted, all of it
      next = { ...next, foamed: all(state.foamed, true), revision: state.revision + 1 };
      break;
    case 'rinse':
      next = { ...next, foamed: state.foamed.map(() => false), wet: state.body.map((b) => b), rinse: state.rinse.map(() => 0), wetness: 1, cues: withCue(next, 'rinse'), revision: state.revision + 1 };
      break;
    case 'dry-rub':
      next = { ...next, dry: all(state.dry, true), wet: state.wet.map(() => false), wetness: 0, revision: state.revision + 1 };
      break;
    case 'script':
      if (stage.id === 'jump-in') next = { ...next, wet: state.body.map((b) => b), wetness: 1, cues: withCue(next, 'splash-in'), revision: state.revision + 1 };
      if (stage.id === 'jump-out') next = { ...next, cues: withCue(next, 'splash-out') };
      break;
    case 'timed':
      break;
  }
  return enterStage(next, state.stageIndex + 1);
}

/** How far a coverage stage has come, and whether it is done (its share reached, or only the last few cells left). */
function coverage(covered: number, of: number, done: number): { progress: number; finished: boolean } {
  if (of <= 0) return { progress: 1, finished: true };
  return { progress: clamp01(covered / of), finished: covered / of >= done || of - covered <= BATH_RULES.autoFinish };
}

/** A sample of the soap or the towel at a point. */
function rub(state: BathState, at: BathPoint): BathState {
  const stage = currentStage(state);
  if (stage?.kind === 'rub') {
    const { values, changed } = brush(state.foamed, state, at, true);
    const { progress, finished } = coverage(count(values, state.visible), visibleCount(state), BATH_RULES.rubDone);
    if (!changed && !finished) return state;
    const next = { ...state, foamed: values, progress, revision: state.revision + 1 };
    return finished ? pass(next) : next;
  }
  if (stage?.kind === 'dry-rub') {
    const { values, changed } = brush(state.dry, state, at, true);
    const { progress, finished } = coverage(count(values, state.visible), visibleCount(state), BATH_RULES.dryDone);
    if (!changed && !finished) return state;
    const wet = state.wet.map((w, i) => w && !values[i]);
    const next = { ...state, dry: values, wet, wetness: state.wetness > 0 ? 1 - progress : 0, progress, revision: state.revision + 1 };
    return finished ? pass(next) : next;
  }
  return state;
}

/** The shower held for `dt` seconds: the foamed cells in the column under its head rinse with time there. */
function shower(state: BathState, dtSeconds: number): BathState {
  const head = headFor(state, state.pointer);
  if (dtSeconds <= 0 || !head) return state;
  // Too far above the body (or below the box) the water no longer reaches it
  if (head.y > state.bodyTop + BATH_RULES.showerReach || head.y < -0.05) return state;
  const half = columnHalfWidth(state);
  const foamed = [...state.foamed];
  const wet = [...state.wet];
  const rinse = [...state.rinse];
  let changed = false;
  for (let i = 0; i < foamed.length; i++) {
    if (!state.visible[i]) continue;
    const c = cellCenter(state.grid, i);
    // The water falls from the head: the cells below it (a little above too, for the spray)
    if (c.y > head.y + 0.08) continue;
    const across = Math.abs(c.x - head.x);
    if (across > half) continue;
    if (!wet[i]) {
      wet[i] = true;
      changed = true;
    }
    if (!foamed[i]) continue;
    const k = 1 - (across / half) * 0.6;
    rinse[i] += dtSeconds * k;
    if (rinse[i] >= BATH_RULES.rinseCellSeconds) foamed[i] = false;
    changed = true;
  }
  if (!changed) return state;
  const left = count(foamed, state.visible);
  const of = state.startCount;
  const { progress, finished } = coverage(of - left, of, BATH_RULES.rinseDone);
  const next = { ...state, foamed, wet, rinse, progress, wetness: count(wet, state.visible) / Math.max(1, visibleCount(state)), revision: state.revision + 1 };
  return finished ? pass(next) : next;
}

export function reduce(state: BathState, event: BathEvent): BathState {
  switch (event.type) {
    case 'begin': {
      if (state.status !== 'idle') return state;
      const hiddenBelow = event.hiddenBelow ?? 0;
      return enterStage({ ...state, hiddenBelow, visible: visibleOf(state.body, state.grid, hiddenBelow) }, 0);
    }
    case 'mask': {
      // The body's outline arrives once, before anything is rubbed (a pointer waits for it)
      if (state.maskReady) return state;
      if (event.body.length !== state.body.length || !event.body.some(Boolean)) return { ...state, maskReady: true };
      return { ...state, body: event.body, visible: visibleOf(event.body, state.grid, state.hiddenBelow), maskReady: true, bodyTop: event.top ?? state.bodyTop, revision: state.revision + 1 };
    }
    case 'measure':
      if (state.boxPx && state.boxPx.w === event.box.w && state.boxPx.h === event.box.h) return state;
      return { ...state, boxPx: { ...event.box } };
    case 'pointer-down': {
      if (!isHandStage(currentStage(state)) || !state.maskReady) return state;
      return { ...state, pointer: event.point, stroke: { last: event.point, travelled: 0 } };
    }
    case 'pointer-move': {
      const stage = currentStage(state);
      if (!isHandStage(stage)) return state;
      if (!state.stroke) return { ...state, pointer: event.point };
      const from = state.stroke.last;
      const to = event.point;
      const travelled = state.stroke.travelled + Math.hypot(to.x - from.x, to.y - from.y);
      let next: BathState = { ...state, pointer: to, stroke: { last: to, travelled } };
      if (stage!.kind === 'rinse') return next;
      // A press that has not moved past a tap lays nothing; from there, a sample every third of a cell
      if (travelled <= tapSlop(state)) return next;
      const samples = state.stroke.travelled <= tapSlop(state) ? [from, ...strokeSamples(from, to)] : strokeSamples(from, to);
      for (const sample of samples) {
        next = rub(next, sample);
        if (next.status !== 'stage' || next.stageIndex !== state.stageIndex) break;
      }
      return next;
    }
    case 'pointer-up':
      if (state.status !== 'stage' || (!state.pointer && !state.stroke)) return state;
      return { ...state, pointer: null, stroke: null };
    case 'tick': {
      const stage = currentStage(state);
      if (stage?.kind === 'rinse') return state.stroke && state.pointer ? shower(state, event.dtMs / 1000) : state;
      if (stage?.kind === 'timed') {
        const elapsedMs = state.elapsedMs + Math.max(0, event.dtMs);
        const duration = Math.max(1, stage.durationMs ?? 1);
        const next = { ...state, elapsedMs, progress: clamp01(elapsedMs / duration) };
        return elapsedMs >= duration ? pass(next) : next;
      }
      return state;
    }
    case 'script-done':
      return currentStage(state)?.kind === 'script' ? pass(state) : state;
    case 'landed': {
      if (state.status !== 'committing') return state;
      // A wet Blobbi shakes itself dry first; a dry one celebrates at once
      const done = { ...state, status: 'done' as const, error: null, pointer: null, stroke: null };
      return { ...done, cues: withCue(done, state.wetness > 0 ? 'shake' : 'done') };
    }
    case 'shaken':
      if (state.status !== 'done' || state.wetness <= 0) return state;
      return { ...state, wetness: 0, wet: state.wet.map(() => false), cues: withCue(state, 'done'), revision: state.revision + 1 };
    case 'failed':
      return state.status === 'committing' ? { ...state, status: 'failed', error: event.error, pointer: null, stroke: null } : state;
    case 'retry':
      return state.status === 'failed' ? { ...state, status: 'committing', error: null, attempts: state.attempts + 1 } : state;
    case 'cancel':
      // A write on its way cannot be cancelled here (the session holds the cancel until it has landed or failed)
      if (state.status === 'committing' || state.status === 'done' || state.status === 'cancelled' || state.status === 'idle') return state;
      return { ...state, status: 'cancelled', reason: event.reason, pointer: null, stroke: null };
  }
}

/** What the renderers are handed (`frameFromState`): the machine's cells, booleans, the tool's head. */
export function frameSource(state: BathState): FrameSource {
  return {
    status: state.status,
    stageIndex: state.stageIndex,
    progress: state.progress,
    grid: state.grid,
    body: state.body,
    visible: state.visible,
    foamed: state.foamed,
    wet: state.wet,
    dry: state.dry,
    head: headFor(state, state.pointer),
    wetness: state.wetness,
    cues: state.cues,
    revision: state.revision,
  };
}

/** The one line that says what to do now, in a child's words, naming the Blobbi. */
export function guidanceFor(state: Pick<BathState, 'status' | 'ritual' | 'stageIndex'>, name: string): string {
  const stage = currentStage(state);
  if (stage) return stage.guidance(name);
  switch (state.status) {
    case 'committing':
      return `All done! Saving ${name}'s care…`;
    case 'done':
      return `${name} is squeaky clean!`;
    case 'failed':
      return `That could not be saved.`;
    default:
      return '';
  }
}

/** The tool's name for the bar: the lather's by the ritual's look (Soap, Shampoo). */
export function toolLabel(tool: BathTool, style: RitualDef['style']): string {
  if (tool === 'soap') return style === 'shampoo' ? 'Shampoo' : 'Soap';
  return tool === 'shower' ? 'Shower' : 'Towel';
}
