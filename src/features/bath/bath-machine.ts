/**
 * The bath as a pure machine: one game, played the same over the 2D home's
 * drawing and the 3D room's model.
 *
 *   idle → entering → soap → rinse → dry → committing → done
 *                                                      ↘ failed → committing (a retry)
 *   any of entering…dry, and failed  → cancelled
 *
 * The body is a coarse grid over the Blobbi's art box (`BATH_GRID` cells a
 * side), masked by its silhouette, and each cell keeps how much foam is on
 * it and how wet it is. The player's pointer arrives in Blobbi-local
 * coordinates ([0..1]², x across the box, y from its bottom up) and every
 * stage is finished by COVERAGE, never by a tap:
 *
 *   soap    the bar is dragged over the body; foam is laid along the stroke
 *           (a disc round each sample of the drag), a cell saturates, and
 *           the stage passes once most of the body is lathered. Pressing
 *           without moving lays nothing.
 *   rinse   the shower is held over the body; water falls in a column under
 *           the head and the foam under it washes off with time, so the head
 *           has to be carried across the whole body. Everything is wet now.
 *   dry     the towel is rubbed like the soap; a cell dries as it is rubbed.
 *
 * `committing` is where the one write happens (the host's, not this
 * module's); nothing before it touches the item or the relays, and a
 * cancel never consumes anything. A failed write waits for the player's
 * Retry (never by itself); a cancel while the write is out is held off by
 * the session (`protect`), not here: this machine simply refuses to leave
 * `committing` except by `landed` or `failed`.
 *
 * Pure and deterministic: `reduce(state, event)` returns a new state and
 * mutates nothing, so every rule above is a unit test.
 */
import type { CancelReason } from '@/features/room/lib/room-interaction';

export type BathStage = 'entering' | 'soap' | 'rinse' | 'dry';
export type BathStatus = 'idle' | BathStage | 'committing' | 'done' | 'failed' | 'cancelled';
export type BathTool = 'soap' | 'shower' | 'towel';

/** A point in the Blobbi's art box: x across (0 left, 1 right), y up (0 the box's bottom, 1 its top). */
export interface BathPoint {
  x: number;
  y: number;
}

/** Cells a side of the body grid. Row 0 is the bottom of the box. */
export const BATH_GRID = 8;

/** The rules, as numbers: how far a stroke reaches, how fast each stage goes, when a stage is done. */
export const BATH_RULES = {
  /** Distance along a drag between two samples (box fractions): a third of a cell. */
  sampleStep: 1 / (BATH_GRID * 3),
  /** How far round a sample the soap or the towel reaches (cells). */
  rubRadius: 1.25,
  /** Foam laid on the cell under a sample; less toward the edge of the reach. */
  soapPerSample: 0.34,
  /** Wet taken off the cell under a towel sample. */
  dryPerSample: 0.3,
  /** Half the width of the shower's column (box fractions). */
  columnHalfWidth: 0.15,
  /** Foam washed off per second under the middle of the column. */
  rinsePerSecond: 1.7,
  /** The shares of the body each stage must reach. */
  soapDone: 0.82,
  rinseDone: 0.92,
  dryDone: 0.85,
  /** How far a pointer may move and still be a tap (box fractions): a tap lays nothing. */
  tapSlop: 0.01,
} as const;

export interface BathState {
  status: BathStatus;
  grid: number;
  /** Which cells are the body (row-major, row 0 at the bottom). */
  mask: readonly boolean[];
  foam: readonly number[];
  wet: readonly number[];
  /** The drag under way: where it last was, how far it has travelled over the box, how many samples it laid. */
  stroke: { last: BathPoint; travelled: number; samples: number } | null;
  /** Where the tool is (the pointer, in the box), or null while nothing is pressed. */
  pointer: BathPoint | null;
  /** How far the current stage has come, 0..1. */
  progress: number;
  /** For the rinse and the dry: how much there was to take off when the stage began. */
  startAmount: number;
  /** Writes attempted so far (the first and every retry). */
  attempts: number;
  error: string | null;
  reason: CancelReason | null;
  /** The stages passed, in order (a celebration per stage). */
  completed: readonly BathStage[];
  /** Counts every change that redraws the body (foam or wet), for cheap memoisation. */
  revision: number;
}

export type BathEvent =
  | { type: 'begin'; inPlace?: boolean }
  | { type: 'entered' }
  | { type: 'pointer-down'; point: BathPoint }
  | { type: 'pointer-move'; point: BathPoint }
  | { type: 'pointer-up' }
  | { type: 'tick'; dtMs: number }
  | { type: 'landed' }
  | { type: 'failed'; error: string }
  | { type: 'retry' }
  | { type: 'cancel'; reason: CancelReason };

/** Which tool a stage puts in the player's hand. */
export const TOOL_FOR_STAGE: Readonly<Record<BathStage, BathTool | null>> = { entering: null, soap: 'soap', rinse: 'shower', dry: 'towel' };

export function toolFor(status: BathStatus): BathTool | null {
  return status === 'soap' || status === 'rinse' || status === 'dry' ? TOOL_FOR_STAGE[status] : null;
}

export function isBathStage(status: BathStatus): status is BathStage {
  return status === 'entering' || status === 'soap' || status === 'rinse' || status === 'dry';
}

/** The bath is under way: anything from the first step to the write (a `failed` write is still under way, waiting for Retry). */
export function isBathActive(status: BathStatus): boolean {
  return status !== 'idle' && status !== 'done' && status !== 'cancelled';
}

/** A fresh machine over a body mask (`bodyMask` or a test's own). */
export function createBath(mask: readonly boolean[], grid = BATH_GRID): BathState {
  if (mask.length !== grid * grid) throw new Error(`a bath mask has ${grid * grid} cells, not ${mask.length}`);
  const cells = grid * grid;
  return {
    status: 'idle',
    grid,
    mask,
    foam: new Array<number>(cells).fill(0),
    wet: new Array<number>(cells).fill(0),
    stroke: null,
    pointer: null,
    progress: 0,
    startAmount: 0,
    attempts: 0,
    error: null,
    reason: null,
    completed: [],
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

function maskedCount(state: BathState): number {
  let n = 0;
  for (const m of state.mask) if (m) n++;
  return n;
}

function sum(values: readonly number[], mask: readonly boolean[]): number {
  let total = 0;
  for (let i = 0; i < values.length; i++) if (mask[i]) total += values[i];
  return total;
}

/** How far the soap has come: the share of the body with foam on it (each cell counting at most once). */
function soapProgress(state: BathState): number {
  const body = maskedCount(state);
  if (body === 0) return 1;
  let covered = 0;
  for (let i = 0; i < state.foam.length; i++) if (state.mask[i]) covered += Math.min(1, state.foam[i]);
  return covered / body;
}

/** How far the rinse or the dry has come: the share of what there was to take off that is gone. */
function removalProgress(remaining: number, start: number): number {
  if (start <= 1e-6) return 1;
  return clamp01(1 - remaining / start);
}

/** Lay (or take off) an amount round a point, with a linear falloff, on body cells only. Returns the new values and whether anything changed. */
function daub(values: readonly number[], mask: readonly boolean[], grid: number, at: BathPoint, amount: number, radiusCells: number): { values: number[]; changed: boolean } {
  const next = [...values];
  let changed = false;
  const cx = at.x * grid - 0.5;
  const cy = at.y * grid - 0.5;
  const c0 = Math.max(0, Math.floor(cx - radiusCells));
  const c1 = Math.min(grid - 1, Math.ceil(cx + radiusCells));
  const r0 = Math.max(0, Math.floor(cy - radiusCells));
  const r1 = Math.min(grid - 1, Math.ceil(cy + radiusCells));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const i = cellIndex(grid, col, row);
      if (!mask[i]) continue;
      const d = Math.hypot(col - cx, row - cy);
      if (d > radiusCells) continue;
      const k = 1 - d / radiusCells;
      const v = clamp01(next[i] + amount * k);
      if (v !== next[i]) {
        next[i] = v;
        changed = true;
      }
    }
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

/** Whether a point is inside the box at all. */
function inBox(p: BathPoint): boolean {
  return p.x >= -0.05 && p.x <= 1.05 && p.y >= -0.05 && p.y <= 1.05;
}

/** The stage after a passed one. */
function nextStage(stage: BathStage): BathStatus {
  switch (stage) {
    case 'entering':
      return 'soap';
    case 'soap':
      return 'rinse';
    case 'rinse':
      return 'dry';
    case 'dry':
      return 'committing';
  }
}

/** Move from a passed stage to the next, resetting the stage's progress and recording what the next has to take off. */
function pass(state: BathState, stage: BathStage): BathState {
  const status = nextStage(stage);
  const completed = [...state.completed, stage];
  if (status === 'rinse') {
    // Into the water: the whole body is wet from here, and the foam is what the shower has to take off
    const wet = state.mask.map((m) => (m ? 1 : 0));
    return { ...state, status, completed, progress: 0, stroke: null, wet, startAmount: sum(state.foam, state.mask), revision: state.revision + 1 };
  }
  if (status === 'dry') {
    // Whatever foam the shower left is gone with the last of the water; the towel takes the wet off
    const foam = state.foam.map(() => 0);
    return { ...state, status, completed, progress: 0, stroke: null, foam, startAmount: sum(state.wet, state.mask), revision: state.revision + 1 };
  }
  if (status === 'committing') {
    const wet = state.wet.map(() => 0);
    return { ...state, status, completed, progress: 1, stroke: null, pointer: null, wet, attempts: state.attempts + 1, revision: state.revision + 1 };
  }
  return { ...state, status, completed, progress: 0, stroke: null };
}

/** A sample of the soap or the towel at a point. */
function rub(state: BathState, at: BathPoint): BathState {
  if (!inBox(at)) return state;
  if (state.status === 'soap') {
    const { values, changed } = daub(state.foam, state.mask, state.grid, at, BATH_RULES.soapPerSample, BATH_RULES.rubRadius);
    if (!changed) return state;
    const next = { ...state, foam: values, revision: state.revision + 1 };
    next.progress = soapProgress(next);
    return next.progress >= BATH_RULES.soapDone ? pass(next, 'soap') : next;
  }
  if (state.status === 'dry') {
    const { values, changed } = daub(state.wet, state.mask, state.grid, at, -BATH_RULES.dryPerSample, BATH_RULES.rubRadius);
    if (!changed) return state;
    const next = { ...state, wet: values, revision: state.revision + 1 };
    next.progress = removalProgress(sum(values, state.mask), state.startAmount);
    return next.progress >= BATH_RULES.dryDone ? pass(next, 'dry') : next;
  }
  return state;
}

/** The shower held at a point for `dt` seconds: the foam in the column under its head washes off. */
function shower(state: BathState, head: BathPoint, dtSeconds: number): BathState {
  if (dtSeconds <= 0 || !inBox(head)) return state;
  const foam = [...state.foam];
  let changed = false;
  for (let i = 0; i < foam.length; i++) {
    if (!state.mask[i] || foam[i] <= 0) continue;
    const c = cellCenter(state.grid, i);
    // Under the head: the water falls from it, so only cells below it (a little above too, for the spray) are reached
    if (c.y > head.y + 0.08) continue;
    const across = Math.abs(c.x - head.x);
    if (across > BATH_RULES.columnHalfWidth) continue;
    const k = 1 - (across / BATH_RULES.columnHalfWidth) * 0.6;
    const v = Math.max(0, foam[i] - BATH_RULES.rinsePerSecond * k * dtSeconds);
    if (v !== foam[i]) {
      foam[i] = v;
      changed = true;
    }
  }
  if (!changed) return state;
  const next = { ...state, foam, revision: state.revision + 1 };
  next.progress = removalProgress(sum(foam, state.mask), state.startAmount);
  return next.progress >= BATH_RULES.rinseDone ? pass(next, 'rinse') : next;
}

export function reduce(state: BathState, event: BathEvent): BathState {
  switch (event.type) {
    case 'begin': {
      if (state.status !== 'idle') return state;
      const fresh = { ...createBath(state.mask, state.grid), status: 'entering' as const };
      // Bathed where it lies (an egg on its nest, a room with no tub): no entering, straight to the soap
      return event.inPlace ? pass(fresh, 'entering') : fresh;
    }
    case 'entered':
      return state.status === 'entering' ? pass(state, 'entering') : state;
    case 'pointer-down': {
      if (!isBathStage(state.status) || state.status === 'entering') return state;
      return { ...state, pointer: event.point, stroke: { last: event.point, travelled: 0, samples: 0 } };
    }
    case 'pointer-move': {
      if (!isBathStage(state.status) || state.status === 'entering') return state;
      if (!state.stroke) return { ...state, pointer: event.point };
      const from = state.stroke.last;
      const to = event.point;
      const travelled = state.stroke.travelled + Math.hypot(to.x - from.x, to.y - from.y);
      let next: BathState = { ...state, pointer: to, stroke: { last: to, travelled, samples: state.stroke.samples } };
      if (state.status === 'rinse') return next;
      // A press that has not moved past a tap lays nothing; from there, a sample every third of a cell
      if (travelled <= BATH_RULES.tapSlop) return next;
      for (const sample of strokeSamples(from, to)) {
        next = rub(next, sample);
        if (next.stroke) next.stroke = { ...next.stroke, samples: next.stroke.samples + 1 };
        if (next.status !== state.status) break;
      }
      return next;
    }
    case 'pointer-up':
      if (!isBathStage(state.status)) return state;
      return { ...state, pointer: null, stroke: null };
    case 'tick': {
      // The shower rinses while it is held; moving it only aims it
      if (state.status !== 'rinse' || !state.stroke || !state.pointer) return state;
      return shower(state, state.pointer, event.dtMs / 1000);
    }
    case 'landed':
      return state.status === 'committing' ? { ...state, status: 'done', error: null, pointer: null, stroke: null } : state;
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

/** The one line that says what to do now, in a child's words, naming the Blobbi. */
export function guidanceFor(status: BathStatus, name: string): string {
  switch (status) {
    case 'entering':
      return `${name} is getting into the tub…`;
    case 'soap':
      return `Rub the soap all over ${name}.`;
    case 'rinse':
      return `Hold the shower over ${name} to rinse off the foam.`;
    case 'dry':
      return `Rub ${name} dry with the towel.`;
    case 'committing':
      return `All clean! Saving ${name}'s bath…`;
    case 'done':
      return `${name} is squeaky clean!`;
    case 'failed':
      return `The bath could not be saved.`;
    default:
      return '';
  }
}

export const TOOL_LABEL: Readonly<Record<BathTool, string>> = { soap: 'Soap', shower: 'Shower', towel: 'Towel' };
