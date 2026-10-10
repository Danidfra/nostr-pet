/**
 * What the 3D room paints on its walls and floor: the room's surfaces.
 *
 * The shape is the one the home already has (`rooms/surfaces.ts`, Ditto's
 * `room_layouts` v1 schema: a style, a validated palette, a variant, an
 * angle), so the registry's rooms are drawn as they are; the papercraft
 * textures (`scene/paper-textures.ts`) read exactly these fields. Nothing
 * here is new data: the layout of a room IS the registry's surfaces until a
 * later milestone reads a saved one.
 */
import type { RoomSurfaces, SurfaceLayout } from '@/features/home/rooms/surfaces';
import { roomById, type RoomId } from '@/features/home/rooms/rooms';

/** One painted surface (a wall or the floor). */
export type RoomSurfaceLayout = SurfaceLayout;

/** A room's wall and floor. */
export type RoomLayout = RoomSurfaces;

/** The layout the registry gives a room: the same object every time, so the scene rebuilds nothing. */
export function roomLayoutFor(roomId: RoomId): RoomLayout {
  return roomById(roomId).surfaces;
}
