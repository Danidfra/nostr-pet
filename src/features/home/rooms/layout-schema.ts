/**
 * A room layout: where the furniture stands, as data the editor writes and
 * the room reads. The shape is Ditto's `room_furniture` v1 so a layout could
 * cross over later; the validation is stricter (a placement must be legal
 * for its furniture and its room, not only inside [0, 1]).
 *
 *   { v: 1, by_room: { [room]: [{ id, x, y, layer, scale?, flip? }] } }
 *
 * `x` is the object's horizontal centre and `y` its feet (bottom edge), as
 * fractions of the room canvas (`space/room-space.ts`).
 */
import { clampPlacement, floorFromRoom, roundRoomPoint, type PlacementLayer } from '../space/room-space';
import { canPlaceInRoom, furnitureById, type FurnitureDefinition } from './furniture-registry';
import { ROOM_ASPECT } from '../space/room-space';
import { isRoomId, type RoomId } from './rooms';

export const PLACEMENT_LAYERS: readonly PlacementLayer[] = ['back', 'floor', 'front'];
export const MAX_FURNITURE_PER_ROOM = 20;
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 2;

export interface Placement {
  id: string;
  x: number;
  y: number;
  layer: PlacementLayer;
  scale?: number;
  flip?: boolean;
}

export interface RoomLayouts {
  v: 1;
  by_room: Partial<Record<RoomId, Placement[]>>;
}

const NAMESPACED_ID_RE = /^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/;

/** The object's rendered extent in canvas units, for clamping. */
export function placementExtent(def: FurnitureDefinition, placement: Pick<Placement, 'layer' | 'scale'>): { layer: PlacementLayer; width: number; height: number } {
  const width = def.baseWidth * (placement.scale ?? 1);
  // Height as a fraction of canvas height: width (of canvas width) / aspect, converted through the canvas aspect.
  const height = (width / def.aspectRatio) * ROOM_ASPECT;
  return { layer: placement.layer, width, height };
}

/**
 * A placement made legal for its furniture and room: layer allowed, room
 * allowed, scale in range, anchor clamped with the object's extent. Returns
 * `undefined` for an unknown id or a room the piece may not stand in.
 */
export function normalizePlacement(raw: Placement, room: RoomId): Placement | undefined {
  const def = furnitureById(raw.id);
  if (!def || !canPlaceInRoom(def, room)) return undefined;
  const layer = def.allowedLayers.includes(raw.layer) ? raw.layer : def.defaultLayer;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number.isFinite(raw.scale ?? 1) ? (raw.scale ?? 1) : 1));
  const point = roundRoomPoint(clampPlacement({ x: raw.x, y: raw.y }, placementExtent(def, { layer, scale })));
  const out: Placement = { id: raw.id, x: point.x, y: point.y, layer };
  if (scale !== 1) out.scale = Math.round(scale * 100) / 100;
  if (raw.flip && def.flippable) out.flip = true;
  return out;
}

function parsePlacement(raw: unknown, room: RoomId): Placement | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !NAMESPACED_ID_RE.test(r.id)) return undefined;
  if (typeof r.x !== 'number' || !Number.isFinite(r.x) || typeof r.y !== 'number' || !Number.isFinite(r.y)) return undefined;
  if (typeof r.layer !== 'string' || !(PLACEMENT_LAYERS as readonly string[]).includes(r.layer)) return undefined;
  return normalizePlacement({ id: r.id, x: r.x, y: r.y, layer: r.layer as PlacementLayer, scale: typeof r.scale === 'number' ? r.scale : undefined, flip: r.flip === true }, room);
}

/** Layouts from untrusted JSON (a string or an already-parsed value). Never throws; unknown rooms and bad items vanish. */
export function parseRoomLayouts(input: unknown): RoomLayouts | undefined {
  let raw: unknown = input;
  if (typeof input === 'string') {
    if (!input.trim()) return undefined;
    try {
      raw = JSON.parse(input);
    } catch {
      return undefined;
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !r.by_room || typeof r.by_room !== 'object' || Array.isArray(r.by_room)) return undefined;
  const out: RoomLayouts = { v: 1, by_room: {} };
  for (const [key, value] of Object.entries(r.by_room as Record<string, unknown>)) {
    if (!isRoomId(key) || !Array.isArray(value)) continue;
    const placements: Placement[] = [];
    for (const item of value) {
      if (placements.length >= MAX_FURNITURE_PER_ROOM) break;
      const placement = parsePlacement(item, key);
      if (placement) placements.push(placement);
    }
    out.by_room[key] = placements;
  }
  return out;
}

/** A layout with every placement legal (defaults and editor drafts go through this too). */
export function normalizeRoomPlacements(placements: readonly Placement[], room: RoomId): Placement[] {
  const out: Placement[] = [];
  for (const p of placements) {
    if (out.length >= MAX_FURNITURE_PER_ROOM) break;
    const n = normalizePlacement(p, room);
    if (n) out.push(n);
  }
  return out;
}

/** Paint order for a placement: back on the wall, floor interleaved with the actor by depth, front over everything on the floor. */
export function placementZIndex(placement: Placement, def: FurnitureDefinition): number {
  const order = def.renderOrder ?? 0;
  if (placement.layer === 'back') return 1 + order;
  if (placement.layer === 'front') return 200 + order;
  return 10 + Math.round(floorFromRoom({ x: placement.x, y: placement.y }).y * 100) + order;
}
