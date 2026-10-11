# Room persistence on Nostr — design (not implemented)

Status: **proposal only**. Nothing in this document is implemented. The room
saves to this device only (`src/features/room/lib/room-store.ts`, milestone 5).
Publishing rooms needs an explicit go-ahead. This document invents no event
kinds and changes no schemas.

## 1. What already exists on Nostr

Ditto, the ecosystem's reference client, already keeps rooms in the player's
**Blobbonaut profile, kind 11125**. This is a replaceable event, one per
pubkey. Rooms live in its JSON `content`:

| content key          | shape                                                        | owner module (Ditto)                          |
|----------------------|--------------------------------------------------------------|-----------------------------------------------|
| `room_furniture_v2`  | `{ v: 2, by_room: { <roomId>: FurniturePlacement[] } }`      | `src/blobbi/rooms/lib/room-furniture-schema.ts` |
| `room_furniture`     | version 1 (legacy; read and converted, never written by v2)  | same                                          |
| `room_layouts`       | `{ v: 1, by_room: { <roomId>: { wall, floor } } }`           | `src/blobbi/rooms/lib/room-layout-schema.ts`  |

The room ids (`home`, `kitchen`, `care`, `rest`, `closet`) are the same in
both apps. So is the placement shape:

- `id`: namespaced, e.g. `official:plant-small`.
- `at`: `floor`, `left` or `right`.
- `x` and `y`: tile positions.
- `rot`: 0–3 quarter turns.
- `scale`: 0.5–2.
- `content.imageUrl`: https only.

The surface shape matches too (style, a validated palette of 1–4 hex colours,
variant, angle). This was intentional: `room-furniture.ts` and
`room-layout.ts` were ported to Ditto's v2/v1 shapes.

Ditto's invariants, which we keep:

- At most 20 pieces per room.
- Coordinates are clamped to the room.
- Malformed items are dropped one at a time; parsing never throws.
- Unknown fields, rooms and namespaces are kept when **writing**.
- A save rewrites only the room being saved.
- When the stored `v` is newer than the client knows, the client refuses to
  save (`RoomFurnitureTooNewError`).
- `rebaseRoomDraft(base, draft, latest)` merges a draft with changes made
  elsewhere.

**Decision:** sync to these existing keys. Do not invent a new kind, a new
key, or a per-app copy. A room decorated in Ditto then shows up in Blobbi,
and the other way round.

## 2. Ownership and scope

- **Who writes:** the profile owner only. The event is signed by the player's
  key, and this app never writes another pubkey's profile.
- **Scope mismatch to resolve first:** Ditto's rooms belong to the
  **player** (one profile, `by_room`). The local store belongs to the
  **(player, Blobbi)** pair (`blobbi:room3d:<pubkey>:<d>`).
  - Proposal: once synced, rooms belong to the player, as in Ditto. This
    matches what the profile can hold without a schema change.
  - Per-Blobbi rooms would need a new key such as `by_blobbi`. That is a
    schema change and is out of scope; it would need agreement with Ditto.
  - On migration, the device keeps its per-Blobbi documents untouched as a
    backup. The *current companion's* rooms are the ones offered for upload
    (§6).
- **What is never written:** care and inventory (31124, 1124, 1416) are
  separate and already exactly-once. Room sync never piggybacks on them.
  Presence or teleport state is never written either (see
  `src/features/teleport/README.md`).

## 3. Write path (when enabled)

The path matches the one this app already uses for `current_companion`
(`useSetCurrentCompanion`, `adoption-plan.profileTemplate`):

1. **Fresh read** of 11125 (`fetchFreshBlobbonautProfile`). Never use a
   cached profile.
2. If the stored `room_furniture_v2.v > 2` or `room_layouts.v > 1`, refuse:
   show "saved by a newer app" and keep the room local.
3. **Rebase** the draft onto the fresh room (`rebaseRoomDraft` semantics,
   ported as a pure function with Ditto's tests mirrored). Pieces added
   elsewhere are kept. Pieces removed elsewhere stay removed unless the
   draft moved them.
4. Build the content as `{ ...parsedContent, room_furniture_v2: { ...stored,
   by_room: { ...stored.by_room, [room]: placements } } }`:
   - Every other content key is kept byte-for-byte: missions, unknown keys,
     legacy `room_furniture`.
   - Every tag is kept (`profile.allTags`).
   - Layouts are handled the same way under `room_layouts`.
5. Publish with `prev` set to the fresh event, through `usePublishAdapter`.
6. **No automatic retry.** A replaceable write is idempotent in content but
   not in ordering. On an ambiguous failure (timeout), re-read:
   - If the relay copy contains our placements, it succeeded.
   - Otherwise, offer "Try again". This repeats steps 1–5, so it rebases
     again.
   - This is the same rule as for spends: nothing ambiguous is replayed
     blindly.
7. **When it writes:** on **Save** in the decorator only, as today. Dragging
   never writes. If saves come in bursts (several rooms in a row), coalesce
   them into one publish after the last Save, with a debounce of about 2 s.
   Each publish carries every room saved in the session.

## 4. Conflicts and multiple devices

- **Replaceable semantics:** the newest `created_at` wins on relays. The rebase
  in step 3 covers both cases:
  - Two devices saving *different* rooms: each write carries the other's
    room, because it was read fresh.
  - Two devices saving the *same* room: the later save wins for that room,
    but pieces the earlier save added are kept.
- **Clock skew:** if the fresh read returns an event whose `created_at` is
  later than our planned one, set our `created_at` to `stored + 1` so the
  write still replaces it.
- **Other 11125 writers** (adoption, companion switch, Ditto's own profile
  edits) also read fresh and keep content. A room write that loses a race to
  one of them loses nothing except its own rooms. A re-read after publishing
  checks this and offers to save again.
- **Read path:** the room shows the profile's rooms when they exist. Otherwise
  it shows this device's saved rooms, and otherwise the defaults. While a
  decorator draft is open, a profile update does not replace the draft. On
  Save it is rebased (step 3).

## 5. Validation (read and write)

- Read with the existing defensive parser in `room-store.ts`. Ditto's
  `parseRoomFurnitureContent` has the same rules:
  - Drop unknown ids: keep them in what is written back, but don't render
    them.
  - Drop pieces outside the room, a surface the piece cannot mount on, or a
    scale outside 0.5–2.
  - Drop `imageUrl` unless it is https.
  - Cap each room at 20 pieces.
- Before writing, validate our own output against the same parser. A
  round-trip must be the identity on the pieces we placed.
- Never write a room this client parsed as *empty because invalid*. Only a
  room the player emptied is written as `[]`.

## 6. Migrating from localStorage

- On the first sync-enabled visit, for each room in the *current
  companion's* local document (`blobbi:room3d:<pubkey>:<d>`, v1):
  - If the profile has nothing for that room, offer to upload it, once, with
    explicit consent: "Keep this room on your profile?".
  - If both exist, the profile wins, and the local room is kept as a backup
    under the same key.
- The local document is never deleted by migration.
- A per-pubkey flag such as `blobbi:room3d:migrated:<pubkey>` stops the
  offer from repeating.
- Rooms saved by signed-out visitors (`anon`) are never uploaded.

## 7. Rollout and tests (when approved)

1. Read-only first: render the profile's rooms when present. This needs no
   writes.
2. Write behind a setting, off by default: "Keep my rooms on Nostr".
3. Tests to add:
   - The pure content builder keeps every unknown key and tag.
   - Refuses newer versions.
   - Rebase cases ported from Ditto's `room-furniture.test.ts`.
   - Exactly one publish per Save burst.
   - No publish on a drag.
   - An ambiguous failure triggers no retry.
   - Protocol-boundary test: only kind 11125, and only the `room_*` keys
     change.

## Non-goals

- New kinds.
- Per-Blobbi rooms on Nostr.
- Publishing teleport or presence state.
- Any change to 31124, 1124 or 1416.
