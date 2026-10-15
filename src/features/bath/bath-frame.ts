/**
 * The bath's render model (M15 care refinement): everything a renderer may
 * read about a ritual under way, and nothing more. The 2D effects
 * (`BathEffects2D`), the room's Classic drawing and the 3D scene
 * (`RoomScene.setBath(frame, anchor)`) all draw from one `BathFrame`, made
 * by one pure function (`frameFromState`) from the machine.
 *
 * The rule: renderers never decide progress. What is drawn foamed is exactly
 * a cell's `foamed`, what is drawn wet is `wet`, what is drawn towelled is
 * `dry`; how far a stage has come is `progress`; a one-shot moment (a splash,
 * the shake) is a `cue`, played once per cue id, never inferred from a
 * change of state.
 *
 * Box coordinates throughout: x across the Blobbi's art box (0 left, 1
 * right), y up from its bottom (0) to its top (1); points outside [0, 1]
 * are beside or above the box (the shower is held above the head).
 */
import type { BathPoint, BathTool } from './bath-machine';
import type { RitualDef, RitualId, RitualPlace, RitualStageId, RitualStageKind, RitualStyle } from './rituals';

export type BathFrameStatus = 'idle' | 'stage' | 'committing' | 'done' | 'failed' | 'cancelled';

/** One cell of the body grid (row-major, row 0 at the bottom of the box). */
export interface BathCell {
  /** The Blobbi's body covers it (its silhouette). */
  body: boolean;
  /** A body cell the player can see and reach (not under the tub's water or rim); only these count. */
  visible: boolean;
  foamed: boolean;
  wet: boolean;
  /** Rubbed dry with the towel this ritual (fluffy). */
  dry: boolean;
}

export type BathCueKind = 'splash-in' | 'splash-out' | 'shake' | 'rinse' | 'done';

/**
 * A one-shot moment, in the order they happened. Ids grow within a bath and never repeat; a renderer keeps the last
 * id it played and plays each later one once. The list only grows while a bath is on screen.
 *
 *   splash-in    the Blobbi lands in the tub's water (soak)
 *   splash-out   it lands back on the floor (soak)
 *   rinse        the last of the foam washed off (wash)
 *   shake        a wet Blobbi shakes itself dry: after a LANDED write only (wash, soak)
 *   done         the celebration begins (every ritual, after a landed write)
 */
export interface BathCue {
  id: number;
  kind: BathCueKind;
}

export interface BathFrameStage {
  id: RitualStageId;
  kind: RitualStageKind;
  /** Its place in the ritual (0-based) and how many stages the ritual has. */
  index: number;
  count: number;
}

export interface BathFrameTool {
  kind: BathTool;
  /** Where the tool's head is drawn, in box units: at the pointer (the shower's head a little above the finger), or its resting place. */
  at: BathPoint;
  /** Held by the player now (false: resting, inviting the hand). */
  pressed: boolean;
}

export interface BathFrame {
  /** The bath's identity: changes with each new ritual (a renderer resets its cue memory on a new key). */
  key: number;
  ritual: RitualId;
  style: RitualStyle;
  place: RitualPlace;
  status: BathFrameStatus;
  /** The stage under way; null before the first and from the write on. */
  stage: BathFrameStage | null;
  /** How far the stage has come, 0..1 (1 from the write on). */
  progress: number;
  grid: number;
  cells: readonly BathCell[];
  /** The body's feet and top in the box (fractions from its bottom). */
  outline: { bottom: number; top: number };
  tool: BathFrameTool | null;
  /** How wet the Blobbi is overall, 0..1 (the 3D wet sheen, the drips). */
  wetness: number;
  cues: readonly BathCue[];
  reducedMotion: boolean;
  /** Counts every change of the cells, for cheap memoisation. */
  revision: number;
}

/**
 * Where a frame is drawn.
 *
 *   box     the 2D home and the room's Classic drawing: the effects are laid in the Blobbi's art box (the element the
 *           layer is mounted in, which moves with the actor); its size in screen px, for anything drawn in px.
 *   world   the 3D scene: the main actor, followed as it moves (the scene reads its own actor each frame), and the tub
 *           item it bathes in (its index among the placements), or null for a ritual in place.
 */
export type BathAnchor = { kind: 'box'; widthPx: number; heightPx: number } | { kind: 'world'; tubIndex: number | null };

/** Where a tool rests while nothing is pressed (box units): beside the body, the shower above it. */
export const TOOL_RESTING: Readonly<Record<BathTool, BathPoint>> = { soap: { x: 0.84, y: 0.4 }, shower: { x: 0.5, y: 1.04 }, towel: { x: 0.16, y: 0.42 } };

/** What the machine hands over to make a frame (`bath-machine.ts` keeps it; the arrays are row-major, row 0 at the bottom). */
export interface FrameSource {
  status: BathFrameStatus;
  stageIndex: number;
  progress: number;
  grid: number;
  body: readonly boolean[];
  visible: readonly boolean[];
  foamed: readonly boolean[];
  wet: readonly boolean[];
  dry: readonly boolean[];
  /** The tool's head (box units) while pressed, else null. */
  head: BathPoint | null;
  wetness: number;
  cues: readonly BathCue[];
  revision: number;
}

export interface FrameContext {
  key: number;
  ritual: RitualDef;
  /** Where it is played, when not where the ritual would be (a soak in place: no tub here, an egg). */
  place?: RitualPlace;
  outline: { bottom: number; top: number };
  reducedMotion: boolean;
}

/** The frame for a machine state: pure, the same input giving an equal frame. */
export function frameFromState(source: FrameSource, context: FrameContext): BathFrame {
  const { ritual } = context;
  const inStage = source.status === 'stage' && source.stageIndex >= 0 && source.stageIndex < ritual.stages.length;
  const def = inStage ? ritual.stages[source.stageIndex] : null;
  const cells: BathCell[] = [];
  for (let i = 0; i < source.body.length; i++) {
    const body = source.body[i];
    const visible = body && source.visible[i];
    cells.push({ body, visible, foamed: visible && source.foamed[i], wet: body && source.wet[i], dry: body && source.dry[i] });
  }
  const tool: BathFrameTool | null = def?.tool ? { kind: def.tool, at: source.head ?? TOOL_RESTING[def.tool], pressed: source.head !== null } : null;
  return {
    key: context.key,
    ritual: ritual.id,
    style: ritual.style,
    place: context.place ?? ritual.place,
    status: source.status,
    stage: def ? { id: def.id, kind: def.kind, index: source.stageIndex, count: ritual.stages.length } : null,
    progress: source.status === 'committing' || source.status === 'done' ? 1 : source.progress,
    grid: source.grid,
    cells,
    outline: { bottom: context.outline.bottom, top: context.outline.top },
    tool,
    wetness: Math.max(0, Math.min(1, source.wetness)),
    cues: source.cues,
    reducedMotion: context.reducedMotion,
    revision: source.revision,
  };
}

/** How many cells a frame draws foamed (the same count the machine's progress is made of). */
export function foamedCount(frame: Pick<BathFrame, 'cells'>): number {
  let n = 0;
  for (const c of frame.cells) if (c.foamed) n++;
  return n;
}

/** The cues after the last one a renderer played (ids above `lastId`), in order. */
export function cuesAfter(frame: Pick<BathFrame, 'cues'>, lastId: number): BathCue[] {
  return frame.cues.filter((c) => c.id > lastId);
}
