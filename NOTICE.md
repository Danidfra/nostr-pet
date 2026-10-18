# Notices

Blobbi Home (this repository)
Copyright (C) 2025-2026 Daniel Filemon and the contributors listed below.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any
later version. See [LICENSE](LICENSE).

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

## Contributors

- Daniel Filemon (filemon, danidfra)
- Patrick Reis

The Git history is the full record of who wrote what.

## Code from Ditto

Parts of this program are derived from **Ditto**
(<https://gitlab.com/soapbox-pub/ditto>), by Soapbox and the Ditto
contributors, licensed under the GNU Affero General Public License v3.0 or
later. The Ditto authors of the derived code include Chad Curtis and Alex
Gleason. Their code is used here under that license.

The 3D room was ported from Ditto's room diorama, starting in commit `a563823`
(2026-10-10). Daniel Filemon has modified it since, and the Git history records
each change. The files that contain code derived from Ditto are:

- `src/features/room/lib/scene/RoomScene.ts`
- `src/features/room/lib/scene/official-models.ts`
- `src/features/room/lib/scene/sno-builder.ts`
- `src/features/room/lib/scene/sno-three.ts`
- `src/features/room/lib/scene/sno-object.ts`
- `src/features/room/lib/scene/still-renderer.ts`
- `src/features/room/lib/scene/paper-textures.ts`
- `src/features/room/lib/scene/prop-art.ts`
- `src/features/room/lib/room-furniture.ts`
- `src/features/room/lib/room-geometry.ts`
- `src/features/room/lib/furniture-3d.ts`
- `src/features/room/hooks/useRoomScene.ts`
- `src/features/room/hooks/useRoomItemDrag.ts`
- `src/features/room/hooks/useFurnitureModels.ts`
- `src/features/room/components/RoomShell.tsx`
- `src/features/room/components/RoomDecorator.tsx`
- `src/features/room/components/RoomActionButton.tsx`
- `src/features/room/components/RoomBlobbi.tsx`
- `src/features/room/components/FurnitureThumbnail.tsx`
- `src/features/care-ui/ItemCarousel.tsx`

The furniture drawings in `public/furniture/*.svg` are Daniel Filemon's own
work. The same files were also contributed to Ditto.

## Other components

- **MKStack** (<https://gitlab.com/soapbox-pub/mkstack>), the template this
  project started from, is dedicated to the public domain by its authors.
- **Comfortaa** font, through `@fontsource-variable/comfortaa`: Copyright 2011
  The Comfortaa Project Authors (<https://github.com/alexeiva/comfortaa>), with
  Reserved Font Name "Comfortaa". It is licensed under the SIL Open Font
  License 1.1 (included in that package).
- Other dependencies are under their own licenses, listed in
  `package-lock.json`.
- Artwork generated with AI tools is described in [ASSETS.md](ASSETS.md).
