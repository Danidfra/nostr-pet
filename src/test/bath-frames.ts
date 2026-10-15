/**
 * Bath frames for the renderers' tests (M15 care): a frame made the real way
 * (`frameFromState`) over the plain body, with whatever cells, tool, wetness
 * and cues a test asks for.
 */
import { BATH_GRID, defaultMask } from '@/features/bath/bath-machine';
import { frameFromState, type BathCue, type BathFrame, type BathFrameStatus, type FrameSource } from '@/features/bath/bath-frame';
import { RITUALS, type RitualDef, type RitualPlace } from '@/features/bath/rituals';

type Pick = boolean | ((index: number, body: boolean) => boolean);

export interface FrameOptions {
  ritual?: RitualDef;
  place?: RitualPlace;
  status?: BathFrameStatus;
  stageIndex?: number;
  progress?: number;
  /** Which cells: true for every body cell, or a rule over the cell's index. */
  foamed?: Pick;
  wet?: Pick;
  dry?: Pick;
  head?: { x: number; y: number } | null;
  wetness?: number;
  cues?: BathCue[];
  reducedMotion?: boolean;
  key?: number;
  revision?: number;
  outline?: { bottom: number; top: number };
}

export const CELLS = BATH_GRID * BATH_GRID;
export const BODY = defaultMask(BATH_GRID);

function cells(pick: Pick | undefined): boolean[] {
  return BODY.map((body, i) => (pick === undefined ? false : typeof pick === 'boolean' ? pick && body : pick(i, body)));
}

export function makeFrame(options: FrameOptions = {}): BathFrame {
  const source: FrameSource = {
    status: options.status ?? 'stage',
    stageIndex: options.stageIndex ?? 0,
    progress: options.progress ?? 0.3,
    grid: BATH_GRID,
    body: BODY,
    visible: BODY,
    foamed: cells(options.foamed),
    wet: cells(options.wet),
    dry: cells(options.dry),
    head: options.head ?? null,
    wetness: options.wetness ?? 0,
    cues: options.cues ?? [],
    revision: options.revision ?? 1,
  };
  return frameFromState(source, { key: options.key ?? 1, ritual: options.ritual ?? RITUALS.soap, place: options.place, outline: options.outline ?? { bottom: 0.08, top: 0.92 }, reducedMotion: options.reducedMotion ?? false });
}

/** The indices of the body's cells. */
export const bodyCells = (): number[] => BODY.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
