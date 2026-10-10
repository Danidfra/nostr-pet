/**
 * How fast a Blobbi walks across the 3D room: the pace of its own gait, so
 * a planted foot keeps its spot on the floor.
 *
 * The gait is the home's (`scene/motion-contract.ts`): one cycle of the
 * renderer's walk carries a drawing `stride` of its own box sideways (the
 * V3 adult 108/900 of a box, measured on the rig's keyframes; babies and V1
 * keep that pace in their own boxes), over `walkCycleFor(generation)`
 * seconds. Nothing here chooses a speed; it converts that stride into room
 * tiles per second for THIS room's camera:
 *
 *  - the art box is `blobbiBoxTiles(stage)` tiles wide and is scaled by the
 *    scene's vertical px-per-tile, so a stride is `stride × tiles` of those
 *    screen units per cycle;
 *  - one world tile along the screen's right projects to `1 / cos(elevation)`
 *    of the same unit (the camera looks down at `CAMERA_ELEVATION`), so the
 *    lateral world speed that matches the stride is scaled by `cos(elevation)`;
 *  - a walk steps along the tile axes, and with the camera at 45° every
 *    tile axis is a screen diagonal, so only `1/√2` of a step is lateral:
 *    the speed along the path is `√2` times the lateral speed.
 *
 * THE TEMPO. The kit's walk is a short-stride shuffle (each foot travels 54
 * of 900 drawing units a step) at a fixed cycle, and matched to that stride
 * the V3 adult covers about 0.85 tiles a second: a room's width in nine
 * seconds, which reads as far too slow in the room. The kit has no rate
 * control, but its walk is CSS, so the room plays the cycle `WALK_TEMPO`
 * times faster (`index.css`, `--room-walk-tempo`, an `animation-duration`
 * override the kit's selectors do not touch) and moves the Blobbi `WALK_TEMPO`
 * times faster with it. Both come from this one number, so the foot stays
 * planted at any tempo; the stride itself (the kit's drawing) is unchanged.
 *
 * Seen from the front or the back the feet step in place and nothing can
 * slide; the same pace is kept, as the home keeps one pace per walk.
 */
import { gaitFor, walkCycleFor } from '@/features/home/scene/motion-contract';
import { CAMERA_ELEVATION, blobbiBoxTiles } from './room-geometry';

/**
 * How many times faster than the renderer's own cycle a walk plays in the
 * room, and so how many times faster the Blobbi moves. 2.35 puts the V3
 * adult at about two tiles a second.
 */
export const WALK_TEMPO = 2.35;

/** Lateral screen travel per walk cycle, in tiles of the scene's vertical unit. */
export function strideTilesPerCycle(stage: string, generation: string): number {
  return gaitFor(stage, generation).stride * blobbiBoxTiles(stage);
}

/** Seconds one walk cycle takes in the room: the renderer's cycle at the room's tempo (what the CSS override plays). */
export function walkCycleSecondsFor(generation: string): number {
  return walkCycleFor(generation) / WALK_TEMPO;
}

/** The walking speed along a tile path, in tiles per second, for a Blobbi of this stage and generation, at the room's tempo. */
export function walkSpeedFor(stage: string, generation: string): number {
  return (strideTilesPerCycle(stage, generation) * Math.cos(CAMERA_ELEVATION) * Math.SQRT2) / walkCycleSecondsFor(generation);
}
