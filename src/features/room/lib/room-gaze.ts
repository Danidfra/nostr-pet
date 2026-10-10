/**
 * Where a walking Blobbi's eyes go in the room: a glance the way it is
 * going, from the side it is drawn from. The home's `travelGlance` takes a
 * screen direction; in the room the direction on screen IS the facing
 * (room-facing.ts), so it is derived from that. The back has no face.
 */
import type { BlobbiFacing } from '@blobbi-kit/renderer';
import { travelGlance, type EyeOffset } from '@/features/home/scene/gaze';

const SCREEN_DIRECTION: Record<BlobbiFacing, { x: number; y: number } | null> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  front: { x: 0, y: 1 },
  back: null,
};

export function travelGaze(facing: BlobbiFacing): EyeOffset | undefined {
  const direction = SCREEN_DIRECTION[facing];
  return direction ? travelGlance(direction) : undefined;
}
