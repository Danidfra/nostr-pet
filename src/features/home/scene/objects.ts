import type { FloorPoint } from './geometry';

/**
 * Where things are in the home. Normalized floor points, so they hold at
 * every viewport. The bed is the one real object in this milestone.
 */

/** Where a Blobbi stands when it arrives home (awake). */
export const HOME_SPOT: FloorPoint = { x: 0.5, y: 0.6 };

/** The bed's spot: back right, out of the way of the dock. */
export const BED_POSITION: FloorPoint = { x: 0.78, y: 0.42 };

/** Where the Blobbi lies when it sleeps: on the bed, a little forward so it reads as "in" it. */
export const BED_SLEEP_SPOT: FloorPoint = { x: 0.78, y: 0.5 };
