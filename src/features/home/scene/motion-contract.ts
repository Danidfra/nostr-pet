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
