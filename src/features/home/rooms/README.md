# Rooms: the 2D home's room definitions

The 2D home shows **one** space (`../space/home-space.ts`), built from this
module's definitions: the room registry (`rooms.ts`), Ditto-compatible
surfaces (`surfaces.ts`) and furniture (`furniture-registry.ts`, artwork under
`public/furniture/`), the layout schema and local store (`layout-schema.ts`,
`layout-store.ts`) and the storage key of toys an older build set down (`toy-store.ts`).

The living room's surfaces and decor are drawn by `RoomBackdrop`, furniture by
`FurnitureLayer`; the bed and the tub are brought out for a care moment by
their registry ids, and `approachSpot` says where the Blobbi stands to use
them. The 3D room (`src/features/room`) reuses the registry's room ids and
labels.

Nothing here reads or writes Nostr. Layouts are a local store behind the
`LayoutStore` interface; the Ditto profile extension keys (`room_layouts`,
`room_furniture` in the kind 11125 content) are parsed by `parseRoomLayouts`
and preserved opaquely by blobbi-kit, never written by this app.
