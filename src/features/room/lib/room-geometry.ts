/**
 * Room Geometry — the shared coordinate system of a Blobbi room.
 *
 * A room is a square floor of ROOM_GRID × ROOM_GRID tiles with two back walls
 * meeting in a corner, seen from the opposite (open) corner like a diorama.
 * One world unit is one floor tile. The floor spans x ∈ [0, G], z ∈ [0, G];
 * the left wall stands in the plane x = 0 (running along z), the right wall in
 * z = 0 (running along x). Y is up.
 *
 * Furniture is placed in these units (see room-furniture-schema.ts), so
 * positions are stable across screen sizes and camera framing.
 */

/** The user's Blobbi, among the Blobbis in a room (the rest are guests, by d-tag). */
export const MAIN_BLOBBI = 'main';

/** Floor tiles per side. */
export const ROOM_GRID = 8;

/** Wall height in tiles. */
export const WALL_HEIGHT = 5;

/** Model units (centimetres, for the official furniture) per floor tile. */
export const MODEL_UNITS_PER_TILE = 30;

/** A Simple Nostr Object from the network fits within this many tiles on its longest side, at scale 1. */
export const SNO_FIT_TILES = 2;

/**
 * Blobbi art box size in tiles, by stage. The art has different margins per
 * stage: baby art fills about 73% of its box, adult art only 55–65% (adult
 * forms are drawn on a 200×200 canvas with room for petals, wings and
 * floating bits). Adults get a bigger box, so they stand clearly taller than
 * babies instead of looking smaller.
 *
 * The adult's box was 3.8 (Ditto's). Measured against the furniture it
 * stood about 3.2 tiles tall with its appendages, over the sink (2.7) and
 * the toy box (2.2) and two thirds of the fridge (4.5): a giant in its own
 * kitchen. 3.35 (12% less) puts it at about 2.8, level with the sink,
 * while the baby (1.9 tall in its 2.5 box) stays a clear two thirds of it.
 * Presentation only: the box scales the drawing, the 3D model, the
 * Blobbi's footprint, its tap target and its pace alike (`room-pace.ts`
 * derives the stride from it), never the genome or the morphology.
 */
const BLOBBI_HEIGHT_TILES = { egg: 1.7, baby: 2.5, adult: 3.35 } as const;

type BlobbiSizeStage = keyof typeof BLOBBI_HEIGHT_TILES;

/** Art box size in tiles for a Blobbi stage (unknown stages size as babies). */
export function blobbiBoxTiles(stage: string): number {
  return BLOBBI_HEIGHT_TILES[stage as BlobbiSizeStage] ?? BLOBBI_HEIGHT_TILES.baby;
}

/**
 * How far a Blobbi's body reaches from the point it stands on, as fractions
 * of its art box (the room scales them by `blobbiBoxTiles`): toward the two
 * back walls, and toward the open front edges of the floor. Measured, not
 * chosen: the 3D model is the kit's drawing in depth, so its outline (ink
 * line, arms, tails, ears) posed at every heading IS the visual footprint of
 * both renderers. Over 122 body shapes per stage (60 addresses, every trait
 * fixture, appendage pair and gene bound), the widest reached 0.370 of the
 * box for an adult in any direction; a baby 0.313 upright and 0.421 toward
 * the back walls when it leans back from the camera (`ROOM_LEAN`).
 * `room-reach.test.ts` holds every shape to these. The scene keeps a
 * standing point at least this far from each edge, so no body ever reaches
 * into a wall or hangs over the floor's edge.
 */
const BLOBBI_REACH = { egg: { back: 0.36, front: 0.36 }, baby: { back: 0.43, front: 0.32 }, adult: { back: 0.38, front: 0.38 } } as const;

export interface BlobbiReach {
  /** Toward the back walls (the x = 0 and z = 0 planes), in tiles. */
  back: number;
  /** Toward the open front edges (x = G, z = G), in tiles. */
  front: number;
}

/** A Blobbi's reach in tiles for its stage (unknown stages reach as babies). */
export function blobbiReachTiles(stage: string): BlobbiReach {
  const f = BLOBBI_REACH[stage as BlobbiSizeStage] ?? BLOBBI_REACH.baby;
  const box = blobbiBoxTiles(stage);
  return { back: f.back * box, front: f.front * box };
}

/** The reach fractions themselves, for the test that holds every body shape to them. */
export const BLOBBI_REACH_FRACTIONS = BLOBBI_REACH;

/** Keep a standing point at least `reach` from every edge of the floor (the middle, if the room is narrower than the body). */
export function clampToReach(v: number, reach: BlobbiReach, extent = ROOM_GRID): number {
  if (reach.back + reach.front >= extent) return extent / 2;
  return Math.min(extent - reach.front, Math.max(reach.back, v));
}

/** Clamp a floor coordinate so a footprint of `size` tiles stays inside the room. */
export function clampToRoom(center: number, size: number, extent = ROOM_GRID): number {
  const half = size / 2;
  return Math.max(half, Math.min(extent - half, center));
}

/**
 * Snap a center so a footprint `size` tiles wide lines up with the grid:
 * odd sizes sit on tile centers (k + 0.5), even sizes on tile edges (k).
 */
export function snapCenter(center: number, size: number): number {
  const offset = size % 2 === 1 ? 0.5 : 0;
  return clampToRoom(Math.round(center - offset) + offset, size);
}

/**
 * Where the camera looks from: the open (+x, +z) corner, at this azimuth,
 * this far above the floor. The scene frames the room with them; the
 * facing rule and the walking pace are derived from them (room-facing.ts,
 * room-pace.ts), so they live here, outside the three.js module.
 */
export const CAMERA_AZIMUTH = Math.PI / 4;
export const CAMERA_ELEVATION = (35 * Math.PI) / 180;
