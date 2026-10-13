/**
 * What the home knows about the renderer's creature animation, and no more.
 *
 * The renderer owns how a Blobbi moves: its walk is a CSS animation on its
 * own root, `[data-blobbi-motion="walking"]`, one cycle of
 * `WALK_DURATION_S` in the kit's `motion-model.ts`, offset per instance by
 * `--blobbi-motion-phase` (from `blobbiMotionPhase(instanceId)`), so two
 * Blobbis never march in step. The home owns where the Blobbi stands and
 * what lies under it: the shadow is the home's.
 *
 * For the shadow to breathe with the bob, it needs the cycle length and the
 * phase. The phase is exported; the cycle length is not (it is a private
 * constant inside the exported stylesheet), so it is pinned here and
 * `motion-contract.test.ts` reads the kit's stylesheet and fails the build
 * the day the kit changes it. That is the smallest honest contract without
 * a kit release: one number, verified, not two animations guessed.
 *
 * The home never re-applies the walk transform to the Blobbi itself.
 */
import { DEPTH_WEIGHT, depthScale } from './geometry';
import type { WalkPace } from './locomotion';

export const RENDERER_WALK_CYCLE_S = 0.56;

/**
 * A V3 (procedural) Blobbi does not use that wrapper animation: it moves by
 * its own rig, on a cycle of its own, and offsets it per instance by the
 * same `blobbiMotionPhase(instanceId)` fraction. Its cycle length is private
 * to the renderer's V3 stylesheet in the same way, so it is pinned here and
 * verified against that stylesheet by the same test. What the gait LOOKS
 * like follows the stage: a V3 adult walks on its legs and keeps the floor,
 * a V3 baby hops.
 */
export const RENDERER_V3_WALK_CYCLE_S = 0.62;

/** The walk cycle the renderer animates for a Blobbi of this generation: what the shadow under it must follow. */
export function walkCycleFor(generation: string): number {
  return generation === 'v3' ? RENDERER_V3_WALK_CYCLE_S : RENDERER_WALK_CYCLE_S;
}

/**
 * The actor's box, as a fraction of the scene's width (the stylesheet's
 * `.scene-actor { width: 44% }`, which `motion-contract.test.ts` reads). A
 * drawing is fitted into that box, so a distance measured IN THE DRAWING (a
 * stride) becomes a distance on the floor through this number.
 */
export const ACTOR_BOX_WIDTH = 0.44;

/**
 * A GAIT: how far one cycle of a walk animation carries a Blobbi.
 *
 * This is the link between the animation and the ground. The renderer plays
 * a walk at its own pace; the home moves the Blobbi across the floor. If the
 * two are not tied, the body slides over feet that are stepping at another
 * speed. So a walking speed is never chosen on its own: it is a distance
 * per cycle, divided by the cycle the renderer plays.
 *
 * The two directions are calibrated separately, on purpose:
 *
 *  - `stride`, ACROSS the room, is MEASURED on the drawing, in boxes of the
 *    drawing per cycle. A walk on legs plants each foot for half a cycle and
 *    carries it back under the body; while it is planted the floor must pass
 *    under the body exactly as fast as the foot goes back, or the foot
 *    slides. One cycle is two such steps. A drawing with no legs has no foot
 *    to slide: its stride is set to the legged one, so a baby keeps pace
 *    with the adult it becomes.
 *  - `depth`, UP AND DOWN the floor, is a matter of how it looks, in floor
 *    depths per cycle. From the front and from behind the feet step in place
 *    and nothing is planted that could be seen to slide; what is seen is how
 *    fast the Blobbi grows and comes down the floor against the rhythm of
 *    its steps.
 */
export interface Gait {
  stride: number;
  depth: number;
}

/**
 * THE V3 ADULT, on its legs. The rig plants a foot for half the cycle and
 * carries it from 27 units ahead to 27 behind, at a constant speed
 * (`pb-walking-side-near-leg`): 54 units a step, two steps a cycle, in a
 * drawing 900 units square. 108 / 900 of a box per cycle, and not a hair
 * more: the home used to move it 3.3 times as far, and the feet slid.
 */
const LEGS_V3: Gait = { stride: 108 / 900, depth: 0.21 };
/**
 * THE V2 ADULT, on its legs (the kit's wrapper stylesheet,
 * `blobbi-motion-stride-near`): planted for half the cycle and carried 14
 * viewBox units back, twice a cycle, in a drawing 238.125 tall.
 */
const LEGS_V2: Gait = { stride: 28 / 238.125, depth: 0.19 };
/**
 * THE BOB AND THE HOP: the V1 drawings, every baby, the V3 baby. Nothing
 * touches the floor, so nothing can slide on it. The bobs keep pace with the
 * legged adults, in their own boxes. The V3 baby's HOP carries it a little
 * farther per cycle than an adult's shuffle step (M14.2: a hop is a hop,
 * not a shuffle; 0.14 of its box, with a lift of about 2% of the box at
 * the top of each, still a low bound rather than a glide), and plays at a
 * quicker tempo (`WALK_TEMPO`): a baby that bounds about, not a small
 * adult.
 */
const HOP_V3: Gait = { stride: 0.14, depth: 0.21 };
const BOB: Gait = { stride: 0.12, depth: 0.19 };

/** The gait of each stage of each generation: the one table the home's walking pace comes from. */
export const GAITS: Readonly<Record<'v1' | 'v2' | 'v3', Readonly<Record<'baby' | 'adult', Gait>>>> = {
  v1: { baby: BOB, adult: BOB },
  v2: { baby: BOB, adult: LEGS_V2 },
  v3: { baby: HOP_V3, adult: LEGS_V3 },
};

/** The gait this Blobbi walks with. An unknown stage or generation walks as the oldest artwork does. */
export function gaitFor(stage: string, generation: string): Gait {
  return GAITS[generation === 'v3' || generation === 'v2' ? generation : 'v1'][stage === 'adult' ? 'adult' : 'baby'];
}

/**
 * THE TEMPO (M14.2): how many times faster than the renderer's own cycle a
 * walk plays, by stage.
 *
 * The kit's walk is a short-stride shuffle at a fixed cycle (0.62 s for V3,
 * 0.56 s for V1 and V2). Matched to that stride alone, a Blobbi crossed the
 * 2D home's floor in nine seconds and a 3D room in nine as well, which read
 * as far too slow in both; the room had already answered with a tempo of
 * 2.35 (`room-pace.ts`) while the 2D home kept the kit's cycle, which is why
 * a 2D baby felt slower than a 3D one. The kit has no rate control, but its
 * walk is CSS, so a home plays the cycle `tempo` times faster
 * (`index.css`, an `animation-duration` override on the kit's own
 * selectors) and moves the Blobbi `tempo` times faster with it. Both come
 * from this one number, so a planted foot keeps its spot at any tempo, and
 * the depth travel keeps the rhythm of the steps. The stride itself (the
 * kit's drawing) is unchanged.
 *
 * The baby plays quicker than the adult: smaller legs, more steps, an
 * eager little bound. The adult at 2.35 crosses a floor in about four
 * seconds; the baby's hop (above) at 2.6 reads as energetic without
 * becoming a blur (about four hops a second). An egg never walks.
 */
export const WALK_TEMPO: Readonly<Record<'baby' | 'adult', number>> = { baby: 2.6, adult: 2.35 };

/** The tempo this stage walks at. An unknown stage walks as a baby. */
export function walkTempoFor(stage: string): number {
  return WALK_TEMPO[stage === 'adult' ? 'adult' : 'baby'];
}

/** Seconds one walk cycle takes AS PLAYED on a home: the renderer's cycle over the stage's tempo. What the CSS plays and the shadow follows. */
export function playedWalkCycleFor(stage: string, generation: string): number {
  return walkCycleFor(generation) / walkTempoFor(stage);
}

/**
 * How fast this Blobbi walks where it stands, in floor units per second:
 * `side` along the floor's width, `depth` along its depth.
 *
 * The stride is a distance in the DRAWING, and the drawing is smaller at the
 * back of the room (`depthScale`), so the same stride covers less floor
 * there: the pace across follows the size the Blobbi is drawn at, which is
 * what keeps a planted foot on its spot at every depth. Both paces are per
 * PLAYED cycle (`playedWalkCycleFor`), so the tempo quickens the walk and
 * the steps together.
 */
export function paceFor(stage: string, generation: string, y = 1): WalkPace {
  const gait = gaitFor(stage, generation);
  const cycle = playedWalkCycleFor(stage, generation);
  return { side: (gait.stride * ACTOR_BOX_WIDTH * depthScale(y)) / cycle, depth: gait.depth / cycle };
}

/**
 * How far one walk cycle moves this Blobbi ON SCREEN, in scene widths, in
 * the view the walk is drawn in: its stride in profile, and the floor's
 * foreshortening of its depth travel from the front or from behind.
 */
export function apparentTravelPerCycle(stage: string, generation: string, view: 'side' | 'front' | 'back', y = 1): number {
  const gait = gaitFor(stage, generation);
  return view === 'side' ? gait.stride * ACTOR_BOX_WIDTH * depthScale(y) : gait.depth * DEPTH_WEIGHT;
}
