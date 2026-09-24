/**
 * The furniture catalog: what can stand in a room, by namespaced id.
 *
 * Every entry ships with the app (the `official:` namespace, the same ids
 * and hand-made SVGs as Ditto's catalog, authored for this project, plus a
 * `home:` namespace for the standalone's own art). A definition says how
 * big a thing is in canvas-width units, where it may go (which layers, which
 * rooms), how it is shaded, and, for the few things a Blobbi can use, what
 * using it means. Definitions never carry positions: a placement does.
 */
import type { PlacementLayer } from '../space/room-space';
import type { RoomId } from './rooms';

export type FurnitureCategory = 'furniture' | 'decor' | 'plants' | 'rugs' | 'lights' | 'clocks';
export type FurnitureShadow = 'none' | 'narrow' | 'wide';

/** Something a Blobbi does with a piece of furniture on arrival. */
export type FurnitureUse = 'rest' | 'clean';

export interface FurnitureDefinition {
  id: string;
  category: FurnitureCategory;
  label: string;
  /** Asset path under public/. */
  asset: string;
  /** Intrinsic width / height. */
  aspectRatio: number;
  /** Width as a fraction of canvas width, before scale. */
  baseWidth: number;
  allowedLayers: readonly PlacementLayer[];
  defaultLayer: PlacementLayer;
  /** Rooms it may stand in; absent means any. */
  allowedRooms?: readonly RoomId[];
  flippable: boolean;
  /** Paint order within a layer; lower first. */
  renderOrder?: number;
  shadow?: FurnitureShadow;
  /** What a Blobbi does here, and where it stands to do it (floor units from the object's feet). */
  use?: { kind: FurnitureUse; approach: { dx: number; dy: number } };
}

const BEDS: readonly RoomId[] = ['rest', 'home'];
const REST_USE = { kind: 'rest' as const, approach: { dx: 0, dy: 0.12 } };

export const FURNITURE: readonly FurnitureDefinition[] = [
  // ─── Beds: the one thing a Blobbi uses on its own ──────────────────────
  { id: 'official:bed-single', category: 'furniture', label: 'Bed', asset: '/furniture/bed-single.svg', aspectRatio: 4 / 3, baseWidth: 0.3, allowedLayers: ['floor'], defaultLayer: 'floor', allowedRooms: BEDS, flippable: true, shadow: 'none', renderOrder: -10, use: REST_USE },
  { id: 'official:bed-round', category: 'furniture', label: 'Round Bed', asset: '/furniture/bed-round.svg', aspectRatio: 1.6, baseWidth: 0.27, allowedLayers: ['floor'], defaultLayer: 'floor', allowedRooms: BEDS, flippable: false, shadow: 'none', renderOrder: -10, use: REST_USE },
  { id: 'official:bed-cushion', category: 'furniture', label: 'Cushion Bed', asset: '/furniture/bed-cushion.svg', aspectRatio: 1.5, baseWidth: 0.25, allowedLayers: ['floor'], defaultLayer: 'floor', allowedRooms: BEDS, flippable: true, shadow: 'none', renderOrder: -10, use: REST_USE },
  { id: 'official:bed-basket', category: 'furniture', label: 'Basket Bed', asset: '/furniture/bed-basket.svg', aspectRatio: 1.3, baseWidth: 0.22, allowedLayers: ['floor'], defaultLayer: 'floor', allowedRooms: BEDS, flippable: true, shadow: 'none', renderOrder: -10, use: REST_USE },
  { id: 'home:bed-pet', category: 'furniture', label: 'Pet Bed', asset: '/objects/bed.webp', aspectRatio: 560 / 315, baseWidth: 0.3, allowedLayers: ['floor'], defaultLayer: 'floor', allowedRooms: BEDS, flippable: false, shadow: 'none', renderOrder: -10, use: REST_USE },
  // ─── Furniture ──────────────────────────────────────────────────────────
  { id: 'official:table-side', category: 'furniture', label: 'Side Table', asset: '/furniture/table-side.svg', aspectRatio: 0.9, baseWidth: 0.1, allowedLayers: ['floor', 'front'], defaultLayer: 'floor', flippable: true, shadow: 'wide' },
  { id: 'official:cabinet-small', category: 'furniture', label: 'Small Cabinet', asset: '/furniture/cabinet-small.svg', aspectRatio: 70 / 90, baseWidth: 0.12, allowedLayers: ['floor', 'front'], defaultLayer: 'floor', flippable: true, shadow: 'narrow' },
  { id: 'official:shelf-wall', category: 'decor', label: 'Wall Shelf', asset: '/furniture/shelf-wall.svg', aspectRatio: 2.5, baseWidth: 0.19, allowedLayers: ['back'], defaultLayer: 'back', flippable: false, shadow: 'none' },
  { id: 'official:shelf-books', category: 'decor', label: 'Bookshelf', asset: '/furniture/shelf-books.svg', aspectRatio: 0.5, baseWidth: 0.12, allowedLayers: ['back'], defaultLayer: 'back', flippable: false, shadow: 'none' },
  { id: 'official:shelf-floating', category: 'decor', label: 'Floating Shelf', asset: '/furniture/shelf-floating.svg', aspectRatio: 3, baseWidth: 0.18, allowedLayers: ['back'], defaultLayer: 'back', flippable: false, shadow: 'none' },
  // ─── Plants ─────────────────────────────────────────────────────────────
  { id: 'official:plant-small', category: 'plants', label: 'Small Plant', asset: '/furniture/plant-small.svg', aspectRatio: 0.7, baseWidth: 0.1, allowedLayers: ['floor', 'front'], defaultLayer: 'front', flippable: true, shadow: 'narrow' },
  { id: 'official:plant-tall', category: 'plants', label: 'Tall Plant', asset: '/furniture/plant-tall.svg', aspectRatio: 0.5, baseWidth: 0.11, allowedLayers: ['floor', 'front'], defaultLayer: 'front', flippable: true, shadow: 'narrow' },
  { id: 'official:plant-cactus', category: 'plants', label: 'Cactus', asset: '/furniture/plant-cactus.svg', aspectRatio: 0.5, baseWidth: 0.08, allowedLayers: ['floor', 'front'], defaultLayer: 'front', flippable: false, shadow: 'narrow' },
  { id: 'official:plant-fern', category: 'plants', label: 'Fern', asset: '/furniture/plant-fern.svg', aspectRatio: 0.8, baseWidth: 0.13, allowedLayers: ['floor', 'front'], defaultLayer: 'front', flippable: true, shadow: 'narrow' },
  { id: 'official:plant-hanging', category: 'plants', label: 'Hanging Plant', asset: '/furniture/plant-hanging.svg', aspectRatio: 0.7, baseWidth: 0.11, allowedLayers: ['back'], defaultLayer: 'back', flippable: true, shadow: 'none' },
  // ─── Rugs ───────────────────────────────────────────────────────────────
  { id: 'official:rug-round', category: 'rugs', label: 'Round Rug', asset: '/furniture/rug-round.svg', aspectRatio: 1.8, baseWidth: 0.32, allowedLayers: ['floor'], defaultLayer: 'floor', flippable: false, shadow: 'none', renderOrder: -20 },
  { id: 'official:rug-rectangle', category: 'rugs', label: 'Rectangle Rug', asset: '/furniture/rug-rectangle.svg', aspectRatio: 1.6, baseWidth: 0.35, allowedLayers: ['floor'], defaultLayer: 'floor', flippable: false, shadow: 'none', renderOrder: -20 },
  { id: 'official:rug-runner', category: 'rugs', label: 'Runner Rug', asset: '/furniture/rug-runner.svg', aspectRatio: 3, baseWidth: 0.38, allowedLayers: ['floor'], defaultLayer: 'floor', flippable: false, shadow: 'none', renderOrder: -20 },
  { id: 'official:rug-paw', category: 'rugs', label: 'Paw Rug', asset: '/furniture/rug-paw.svg', aspectRatio: 1, baseWidth: 0.22, allowedLayers: ['floor'], defaultLayer: 'floor', flippable: false, shadow: 'none', renderOrder: -20 },
  // ─── Lights ─────────────────────────────────────────────────────────────
  { id: 'official:lamp-floor', category: 'lights', label: 'Floor Lamp', asset: '/furniture/lamp-floor.svg', aspectRatio: 0.3, baseWidth: 0.075, allowedLayers: ['floor', 'front'], defaultLayer: 'front', flippable: false, shadow: 'narrow' },
  { id: 'official:lamp-table', category: 'lights', label: 'Table Lamp', asset: '/furniture/lamp-table.svg', aspectRatio: 0.6, baseWidth: 0.065, allowedLayers: ['floor', 'front'], defaultLayer: 'front', flippable: false, shadow: 'narrow' },
  { id: 'official:lamp-wall', category: 'lights', label: 'Wall Sconce', asset: '/furniture/lamp-wall.svg', aspectRatio: 0.6, baseWidth: 0.065, allowedLayers: ['back'], defaultLayer: 'back', flippable: true, shadow: 'none' },
  { id: 'official:lamp-string', category: 'lights', label: 'String Lights', asset: '/furniture/lamp-string.svg', aspectRatio: 4, baseWidth: 0.32, allowedLayers: ['back'], defaultLayer: 'back', flippable: false, shadow: 'none' },
  // ─── Clocks (still art here; Ditto animates them) ───────────────────────
  { id: 'official:clock-wall', category: 'clocks', label: 'Wall Clock', asset: '/furniture/clock-wall.svg', aspectRatio: 1, baseWidth: 0.09, allowedLayers: ['back'], defaultLayer: 'back', flippable: false, shadow: 'none' },
  { id: 'official:clock-wall-cute', category: 'clocks', label: 'Cute Clock', asset: '/furniture/clock-wall-cute.svg', aspectRatio: 1, baseWidth: 0.1, allowedLayers: ['back'], defaultLayer: 'back', flippable: false, shadow: 'none' },
  { id: 'official:clock-alarm', category: 'clocks', label: 'Alarm Clock', asset: '/furniture/clock-alarm.svg', aspectRatio: 100 / 115, baseWidth: 0.09, allowedLayers: ['floor', 'front'], defaultLayer: 'front', allowedRooms: BEDS, flippable: false, shadow: 'narrow' },
];

const BY_ID = new Map(FURNITURE.map((def) => [def.id, def]));

export function furnitureById(id: string): FurnitureDefinition | undefined {
  return BY_ID.get(id);
}

export function canPlaceInRoom(def: FurnitureDefinition, room: RoomId): boolean {
  return !def.allowedRooms || def.allowedRooms.includes(room);
}

export function furnitureForRoom(room: RoomId): FurnitureDefinition[] {
  return FURNITURE.filter((def) => canPlaceInRoom(def, room));
}

export const FURNITURE_CATEGORY_LABEL: Record<FurnitureCategory, string> = {
  furniture: 'Furniture',
  decor: 'Shelves',
  plants: 'Plants',
  rugs: 'Rugs',
  lights: 'Lights',
  clocks: 'Clocks',
};
