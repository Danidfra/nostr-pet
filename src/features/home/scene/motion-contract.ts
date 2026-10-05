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
import { DEPTH_WEIGHT, FLOOR_DEPTH } from './geometry';

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
 * HOW FAR ONE CYCLE OF ITS WALK CARRIES A BLOBBI, in floor widths, measured
 * in the room (`geometry.ts`: the floor is as deep as it is wide).
 *
 * This is the link between the animation and the ground. The renderer plays
 * a walk at its own pace (two steps, or two hops, per cycle); the home moves
 * the Blobbi across the floor. If the two are not tied, the body slides
 * under legs that are stepping at another speed. So the walking speed is
 * never chosen on its own: it is this distance divided by the cycle the
 * renderer plays, and a renderer that changes its cycle changes the pace
 * with it.
 *
 * By stage and generation, because each is a different gait: the V1 and V2
 * drawings bob as one piece, a V3 adult steps on its legs, a V3 baby hops.
 * The numbers are the walk the home has always had, which reads right in
 * profile: 0.28 floor widths a second, as a distance per cycle.
 *
 * WHAT A VIEW CHANGES is not the pace but how it LOOKS (`apparentTravelPerCycle`):
 * the same ground covered up or down the floor is drawn foreshortened, a
 * third as far on screen, which is what makes a walk toward the viewer read
 * as steps taken and not as a slide.
 */
export const TRAVEL_PER_WALK_CYCLE: Readonly<Record<'v1' | 'v2' | 'v3', Readonly<Record<'baby' | 'adult', number>>>> = {
  v1: { baby: 0.157, adult: 0.157 },
  v2: { baby: 0.157, adult: 0.157 },
  v3: { baby: 0.174, adult: 0.174 },
};

const gaitOf = (stage: string, generation: string) => TRAVEL_PER_WALK_CYCLE[generation === 'v3' || generation === 'v2' ? generation : 'v1'][stage === 'adult' ? 'adult' : 'baby'];

/** How far one walk cycle carries this Blobbi across the room, in floor widths. */
export function travelPerCycleFor(stage: string, generation: string): number {
  return gaitOf(stage, generation);
}

/** The walking speed of this Blobbi, in floor widths per second: its travel per cycle over its cycle. */
export function walkSpeedFor(stage: string, generation: string): number {
  return gaitOf(stage, generation) / walkCycleFor(generation);
}

/**
 * How far one walk cycle moves this Blobbi ON SCREEN, in scene widths, in
 * the view the walk is drawn in: all of its travel in profile, and the
 * floor's foreshortening of it from the front or from behind.
 */
export function apparentTravelPerCycle(stage: string, generation: string, view: 'side' | 'front' | 'back'): number {
  const travel = gaitOf(stage, generation);
  return view === 'side' ? travel : (travel * DEPTH_WEIGHT) / FLOOR_DEPTH;
}
