/**
 * Editing a layout, as pure functions over a draft: every operation takes
 * placements and returns placements, already legal (`normalizePlacement`).
 * The hook (`useRoomEditor`) holds the draft and the selection; the
 * toolbar and the keyboard call these. Nothing here knows about pointers,
 * storage or React.
 */
import { FLOOR_LINE, type PlacementLayer, type RoomPoint } from '../space/room-space';
import { furnitureById } from './furniture-registry';
import { MAX_FURNITURE_PER_ROOM, MAX_SCALE, MIN_SCALE, PLACEMENT_LAYERS, normalizePlacement, type Placement } from './layout-schema';
import type { RoomId } from './rooms';

/** One arrow-key step, in canvas units; a tenth of the canvas with Shift. */
export const NUDGE_STEP = 0.01;
export const NUDGE_STEP_LARGE = 0.05;
export const SCALE_STEP = 0.1;

/** Where a newly added piece lands: on the wall or on the floor, centred. */
export function defaultPointFor(layer: PlacementLayer): RoomPoint {
  return layer === 'back' ? { x: 0.5, y: 0.34 } : { x: 0.5, y: 0.86 };
}

export function movePlacement(draft: readonly Placement[], index: number, point: RoomPoint, room: RoomId): Placement[] {
  return replaceAt(draft, index, (p) => normalizePlacement({ ...p, x: point.x, y: point.y }, room));
}

export function nudgePlacement(draft: readonly Placement[], index: number, dx: number, dy: number, room: RoomId): Placement[] {
  const p = draft[index];
  if (!p) return [...draft];
  return movePlacement(draft, index, { x: p.x + dx, y: p.y + dy }, room);
}

/** The next allowed layer for the piece, in back → floor → front order, wrapping. */
export function cyclePlacementLayer(draft: readonly Placement[], index: number, room: RoomId): Placement[] {
  return replaceAt(draft, index, (p) => {
    const def = furnitureById(p.id);
    if (!def) return undefined;
    const allowed = PLACEMENT_LAYERS.filter((l) => def.allowedLayers.includes(l));
    if (allowed.length < 2) return p;
    const next = allowed[(allowed.indexOf(p.layer) + 1) % allowed.length];
    // Crossing from the wall to the floor (or back) keeps the piece in view.
    const y = next === 'back' ? Math.min(p.y, FLOOR_LINE) : Math.max(p.y, FLOOR_LINE);
    return normalizePlacement({ ...p, layer: next, y }, room);
  });
}

export function scalePlacement(draft: readonly Placement[], index: number, delta: number, room: RoomId): Placement[] {
  return replaceAt(draft, index, (p) => {
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(((p.scale ?? 1) + delta) * 100) / 100));
    return normalizePlacement({ ...p, scale }, room);
  });
}

export function flipPlacement(draft: readonly Placement[], index: number, room: RoomId): Placement[] {
  return replaceAt(draft, index, (p) => normalizePlacement({ ...p, flip: !p.flip }, room));
}

export function removePlacement(draft: readonly Placement[], index: number): Placement[] {
  return draft.filter((_, i) => i !== index);
}

/** Add a catalog piece at its default spot; `null` when the room is full or the piece may not stand here. */
export function addPlacement(draft: readonly Placement[], id: string, room: RoomId): Placement[] | null {
  if (draft.length >= MAX_FURNITURE_PER_ROOM) return null;
  const def = furnitureById(id);
  if (!def) return null;
  const point = defaultPointFor(def.defaultLayer);
  const placement = normalizePlacement({ id, x: point.x, y: point.y, layer: def.defaultLayer }, room);
  if (!placement) return null;
  return [...draft, placement];
}

/** Whether two layouts are the same layout (order matters: it is paint order). */
export function sameLayout(a: readonly Placement[], b: readonly Placement[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => {
    const q = b[i];
    return p.id === q.id && p.x === q.x && p.y === q.y && p.layer === q.layer && (p.scale ?? 1) === (q.scale ?? 1) && !!p.flip === !!q.flip;
  });
}

function replaceAt(draft: readonly Placement[], index: number, update: (p: Placement) => Placement | undefined): Placement[] {
  const next = [...draft];
  const current = next[index];
  if (!current) return next;
  const updated = update(current);
  if (updated) next[index] = updated;
  return next;
}
