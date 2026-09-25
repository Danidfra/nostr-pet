# Rooms: dormant since M10

This module is the M9 room system: a registry of five rooms (`rooms.ts`),
Ditto-compatible surfaces (`surfaces.ts`) and furniture (`furniture-registry.ts`,
artwork under `public/furniture/`), a versioned layout schema and store
(`layout-schema.ts`, `layout-store.ts`, `useRoomLayout.ts`), pure layout
operations (`layout-edit.ts`), the editor (`useRoomEditor.ts`,
`useFurnitureDrag.ts`, `RoomEditorBar.tsx`, `FurnitureCatalogSheet.tsx`),
room navigation (`RoomNav.tsx`, `useRoom.ts`) and toys set down in a room
(`toy-store.ts`, `usePlacedToys.ts`).

Since M10 the product shows **one** space (`../space/home-space.ts`), built
from this module's definitions: the living room's surfaces and decor drawn by
`RoomBackdrop`, furniture drawn by `FurnitureLayer`, the bed and the tub
brought out for a care moment by their registry ids, and `approachSpot` for
where the Blobbi stands to use them.

What the active app imports from here: `RoomBackdrop`, `FurnitureLayer`,
`approachSpot`, `surfaceBackground`, `roomById`, the `Placement` and
`RoomDefinition` types. Everything else is dormant: no screen renders it,
`dormant.css` (its styles) is not imported, and it stays covered by unit tests
(`rooms.test.ts`, `layout-edit.test.ts`, `../space/room-space.test.ts`) so it
keeps working. Bringing rooms back is a matter of rendering `RoomArrows`,
`RoomIndicator`, `RoomEditorBar` and `FurnitureCatalogSheet` again from the
overview and importing `dormant.css`.

Nothing here reads or writes Nostr. Layouts are a local store behind the
`LayoutStore` interface; the Ditto profile extension keys (`room_layouts`,
`room_furniture` in the kind 11125 content) are parsed by `parseRoomLayouts`
and preserved opaquely by blobbi-kit, never written by this app.
