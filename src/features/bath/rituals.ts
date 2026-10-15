/**
 * The care rituals (M15 care refinement): which little game a cleaning item
 * is, as data. One table, read by the machine (`bath-machine.ts`: the stages
 * in order, each passed by its own rule), by the hosts (`place`: the tub or
 * where the Blobbi stands) and, through the frame (`bath-frame.ts`), by the
 * renderers (`style`: how the tools and the lather look).
 *
 *   wash   Soap, Shampoo     in place   rub (lather) → rinse (the shower)
 *   towel  Soft Towel        in place   dry-rub (a short towelling)
 *   soak   Bubble Bath       the tub    script (jump in) → timed (play in the water) → script (jump out)
 *
 * The one write is after the last stage, always (the session's, never this
 * module's). A soak writes out of the water; its shake-dry and the
 * celebration follow a landed write. Any other `clean` item (a definition
 * this table does not know, a future one) is a plain wash with the soap's
 * look: the safe default, a game every Blobbi can play in place.
 */
import type { BathTool } from './bath-machine';

export type RitualId = 'wash' | 'soak' | 'towel';
/** How a ritual looks (the renderers'); the rules never read it. */
export type RitualStyle = 'soap' | 'shampoo' | 'bubbles' | 'towel';
export type RitualPlace = 'tub' | 'in-place';
export type RitualStageKind = 'rub' | 'rinse' | 'dry-rub' | 'timed' | 'script';
export type RitualStageId = 'lather' | 'rinse' | 'dry' | 'jump-in' | 'play' | 'jump-out';

export interface RitualStage {
  id: RitualStageId;
  kind: RitualStageKind;
  /** A timed stage's length (ms); a script stage's expected length (the host's script decides). */
  durationMs?: number;
  /** The tool in the player's hand during it; null for a stage the player watches. */
  tool: BathTool | null;
  /** The one line that says what to do now, in a child's words, naming the Blobbi. */
  guidance: (name: string) => string;
}

export interface RitualDef {
  id: RitualId;
  style: RitualStyle;
  place: RitualPlace;
  stages: readonly RitualStage[];
}

/** How long the Bubble Bath's play in the water lasts. */
export const SOAK_PLAY_MS = 4_200;

const LATHER = (tool: string): RitualStage => ({ id: 'lather', kind: 'rub', tool: 'soap', guidance: (name) => `Rub the ${tool} all over ${name}.` });
const RINSE: RitualStage = { id: 'rinse', kind: 'rinse', tool: 'shower', guidance: (name) => `Hold the shower over ${name} to rinse off the foam.` };

export const RITUALS = {
  soap: { id: 'wash', style: 'soap', place: 'in-place', stages: [LATHER('soap'), RINSE] },
  shampoo: { id: 'wash', style: 'shampoo', place: 'in-place', stages: [LATHER('shampoo'), RINSE] },
  towel: {
    id: 'towel',
    style: 'towel',
    place: 'in-place',
    stages: [{ id: 'dry', kind: 'dry-rub', tool: 'towel', guidance: (name) => `Rub ${name} with the soft towel.` }],
  },
  soak: {
    id: 'soak',
    style: 'bubbles',
    place: 'tub',
    stages: [
      { id: 'jump-in', kind: 'script', durationMs: 700, tool: null, guidance: (name) => `${name} is jumping into the bubbles…` },
      { id: 'play', kind: 'timed', durationMs: SOAK_PLAY_MS, tool: null, guidance: (name) => `${name} is splashing in the bubbles!` },
      { id: 'jump-out', kind: 'script', durationMs: 700, tool: null, guidance: (name) => `${name} is jumping out…` },
    ],
  },
} as const satisfies Record<string, RitualDef>;

/** The item ids (the definition's `d`) the table knows. */
const BY_ITEM: Readonly<Record<string, RitualDef>> = {
  'blobbi:hygiene:soap': RITUALS.soap,
  'blobbi:hygiene:shampoo': RITUALS.shampoo,
  'blobbi:hygiene:bubble-bath': RITUALS.soak,
  'blobbi:hygiene:soft-towel': RITUALS.towel,
};

/** The ritual a cleaning item plays: by its `d`; anything else a plain wash with the soap's look (in place, safe). */
export function ritualFor(itemD: string | null | undefined): RitualDef {
  return (itemD && BY_ITEM[itemD]) || RITUALS.soap;
}

/** The stage at an index, or null past the end. */
export function stageAt(ritual: RitualDef, index: number): RitualStage | null {
  return index >= 0 && index < ritual.stages.length ? ritual.stages[index] : null;
}
