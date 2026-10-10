/**
 * The 3D furniture catalog: what the room can stand on its tiles, by
 * namespaced id, and how each piece meets the room.
 *
 * Ditto's registry, with its react-intl labels turned into plain strings.
 * Every `official:*` id has a model in `scene/official-models.ts`. The
 * home's 2D catalog (`rooms/furniture-registry.ts`, SVG art in canvas
 * units) stays what it is for the 2D home; this one describes the same ids
 * for the diorama (a mount, whether a piece is small enough to stand on a
 * table, whether it is a table). The `sno:` namespace (objects from the
 * network) is not resolved here yet: an unknown namespace is skipped.
 */

import type { RoomId } from '@/features/home/rooms/rooms';

export type FurnitureCategory = 'furniture' | 'decor' | 'plants' | 'clocks' | 'frames' | 'objects';

/**
 * How an item is mounted. `floor` items take up their footprint; `rug`s lie
 * flat under everything and only collide with other rugs; `wall` items hang
 * on either back wall.
 */
export type FurnitureMount = 'floor' | 'rug' | 'wall';

/** What tapping the item does outside the editor. */
export type FurnitureInteraction = 'fridge' | 'bed' | 'bath' | 'toys';

export interface FurnitureDefinition3D {
  /** Namespaced ID, e.g. "official:plant-small" */
  id: string;
  category: FurnitureCategory;
  label: string;
  mount: FurnitureMount;
  /** Small enough to stand on a `surface` item (a lamp on a table). */
  small?: boolean;
  /** Small items can be placed on top of it. */
  surface?: boolean;
  /** Which rooms this can be placed in (undefined = all rooms) */
  allowedRooms?: RoomId[];
  /** A picture frame that accepts an uploaded image (a later milestone). */
  isFrame?: boolean;
  interaction?: FurnitureInteraction;
}

const BEDROOM: RoomId[] = ['rest', 'home'];

export const OFFICIAL_FURNITURE_3D: readonly FurnitureDefinition3D[] = [
  // Furniture
  { id: 'official:bed-single', category: 'furniture', label: 'Bed', mount: 'floor', allowedRooms: BEDROOM, interaction: 'bed' },
  { id: 'official:bed-round', category: 'furniture', label: 'Round Bed', mount: 'floor', allowedRooms: BEDROOM, interaction: 'bed' },
  { id: 'official:bed-cushion', category: 'furniture', label: 'Cushion Bed', mount: 'floor', allowedRooms: BEDROOM, interaction: 'bed' },
  { id: 'official:bed-basket', category: 'furniture', label: 'Basket Bed', mount: 'floor', allowedRooms: BEDROOM, interaction: 'bed' },
  { id: 'official:fridge', category: 'furniture', label: 'Fridge', mount: 'floor', allowedRooms: ['kitchen'], interaction: 'fridge' },
  { id: 'official:oven', category: 'furniture', label: 'Oven', mount: 'floor', allowedRooms: ['kitchen'] },
  { id: 'official:bathtub', category: 'furniture', label: 'Bathtub', mount: 'floor', allowedRooms: ['care'], interaction: 'bath' },
  { id: 'official:toybox', category: 'furniture', label: 'Toy Box', mount: 'floor', interaction: 'toys' },
  { id: 'official:wardrobe', category: 'furniture', label: 'Wardrobe', mount: 'floor' },
  { id: 'official:sink', category: 'furniture', label: 'Sink', mount: 'floor', allowedRooms: ['care'] },
  { id: 'official:table-side', category: 'furniture', label: 'Side Table', mount: 'floor', surface: true },
  { id: 'official:cabinet-small', category: 'furniture', label: 'Small Cabinet', mount: 'floor', surface: true },
  { id: 'official:counter', category: 'furniture', label: 'Counter', mount: 'floor', surface: true, allowedRooms: ['kitchen'] },
  { id: 'official:shelf-books', category: 'furniture', label: 'Bookshelf', mount: 'floor' },
  { id: 'official:shelf-wall', category: 'furniture', label: 'Wall Shelf', mount: 'wall' },
  { id: 'official:shelf-floating', category: 'furniture', label: 'Floating Shelf', mount: 'wall' },

  // Decor
  { id: 'official:rug-round', category: 'decor', label: 'Round Rug', mount: 'rug' },
  { id: 'official:rug-rectangle', category: 'decor', label: 'Rectangle Rug', mount: 'rug' },
  { id: 'official:mirror', category: 'decor', label: 'Mirror', mount: 'wall' },
  { id: 'official:towel-rack', category: 'decor', label: 'Towel Rack', mount: 'wall' },
  { id: 'official:rug-runner', category: 'decor', label: 'Runner Rug', mount: 'rug' },
  { id: 'official:rug-paw', category: 'decor', label: 'Paw Rug', mount: 'rug' },
  { id: 'official:lamp-floor', category: 'decor', label: 'Floor Lamp', mount: 'floor' },
  { id: 'official:lamp-table', category: 'decor', label: 'Table Lamp', mount: 'floor', small: true },
  { id: 'official:lamp-wall', category: 'decor', label: 'Wall Sconce', mount: 'wall' },
  { id: 'official:lamp-string', category: 'decor', label: 'String Lights', mount: 'wall' },

  // Plants
  { id: 'official:plant-small', category: 'plants', label: 'Small Plant', mount: 'floor', small: true },
  { id: 'official:plant-tall', category: 'plants', label: 'Tall Plant', mount: 'floor' },
  { id: 'official:plant-cactus', category: 'plants', label: 'Cactus', mount: 'floor', small: true },
  { id: 'official:plant-fern', category: 'plants', label: 'Fern', mount: 'floor' },
  { id: 'official:plant-hanging', category: 'plants', label: 'Hanging Plant', mount: 'wall' },

  // Clocks
  { id: 'official:clock-wall', category: 'clocks', label: 'Wall Clock', mount: 'wall' },
  { id: 'official:clock-wall-modern', category: 'clocks', label: 'Modern Clock', mount: 'wall' },
  { id: 'official:clock-wall-cute', category: 'clocks', label: 'Cute Clock', mount: 'wall' },
  { id: 'official:clock-wall-digital', category: 'clocks', label: 'Digital Wall Clock', mount: 'wall' },
  { id: 'official:clock-wall-flip', category: 'clocks', label: 'Flip Wall Clock', mount: 'wall' },
  { id: 'official:clock-table', category: 'clocks', label: 'Table Clock', mount: 'floor', small: true },
  { id: 'official:clock-bedside', category: 'clocks', label: 'Bedside Clock', mount: 'floor', small: true, allowedRooms: BEDROOM },
  { id: 'official:clock-alarm', category: 'clocks', label: 'Alarm Clock', mount: 'floor', small: true, allowedRooms: BEDROOM },
  { id: 'official:clock-table-digital', category: 'clocks', label: 'Table Digital Clock', mount: 'floor', small: true, allowedRooms: BEDROOM },

  // Frames
  { id: 'official:picture-frame', category: 'frames', label: 'Picture Frame', mount: 'wall', isFrame: true },
  { id: 'official:picture-frame-gold', category: 'frames', label: 'Gold Frame', mount: 'wall', isFrame: true },
  { id: 'official:picture-frame-square', category: 'frames', label: 'Square Frame', mount: 'wall', isFrame: true },
  { id: 'official:picture-frame-oval', category: 'frames', label: 'Oval Frame', mount: 'wall', isFrame: true },
];

const officialIndex = new Map<string, FurnitureDefinition3D>(OFFICIAL_FURNITURE_3D.map((def) => [def.id, def]));

/** Whether an ID names built-in furniture (as opposed to a network object). */
export function isOfficialFurnitureId(id: string): boolean {
  return id.startsWith('official:');
}

/** The definition for a namespaced furniture ID; undefined for unknown IDs and namespaces. */
export function resolveFurniture(id: string): FurnitureDefinition3D | undefined {
  return isOfficialFurnitureId(id) ? officialIndex.get(id) : undefined;
}

export function canPlaceInRoom(def: FurnitureDefinition3D, roomId: RoomId): boolean {
  return !def.allowedRooms || def.allowedRooms.includes(roomId);
}

/** Display labels for each category. */
export const CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  furniture: 'Furniture',
  decor: 'Decor',
  plants: 'Plants',
  clocks: 'Clocks',
  frames: 'Frames',
  objects: '3D Objects',
};

/** Display order for categories in the catalog (network objects come with a later milestone). */
const CATEGORY_ORDER: readonly FurnitureCategory[] = ['furniture', 'decor', 'plants', 'clocks', 'frames'];

export interface FurnitureCategoryGroup {
  category: FurnitureCategory;
  label: string;
  items: FurnitureDefinition3D[];
}

/** Every official piece that may stand in a room. */
export function getAvailableFurnitureForRoom(roomId: RoomId): FurnitureDefinition3D[] {
  return OFFICIAL_FURNITURE_3D.filter((def) => canPlaceInRoom(def, roomId));
}

/** The catalog for a room, grouped by category in display order; empty categories are left out. */
export function getAvailableFurnitureByCategory(roomId: RoomId): FurnitureCategoryGroup[] {
  const available = getAvailableFurnitureForRoom(roomId);
  const groups: FurnitureCategoryGroup[] = [];
  for (const category of CATEGORY_ORDER) {
    const items = available.filter((def) => def.category === category);
    if (items.length > 0) groups.push({ category, label: CATEGORY_LABELS[category], items });
  }
  return groups;
}
