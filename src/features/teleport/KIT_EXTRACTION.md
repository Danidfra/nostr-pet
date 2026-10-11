# Teleport → blobbi-kit: the extraction plan

Status: **plan only**. This milestone does not touch blobbi-kit. The move
happens in a separate session, once the Standalone effects are signed off.

## 1. What the kit has today (audited read-only, 2026-10-11)

| package | what it is | engine / peers |
|---|---|---|
| `@blobbi-kit/core` 0.9 | events, kinds 31124/1124/11125, parsing, progression | none (`@noble/hashes`) |
| `@blobbi-kit/react` 0.9 | React hooks over core and Nostr | react, @nostrify/react, react-query |
| `@blobbi-kit/renderer` 0.6 | the SVG `BlobbiRenderer`; `./procedural` holds the genome, morphology, key face poses and silhouettes | react |
| `@blobbi-kit/3d` 0.1 | the **game** Blobbi (used by Blobbi Rumble): a procedural character on **Babylon.js** with a rig (`root`, `body`), an animator and a face | @babylonjs/core |

The Standalone's pet-room Blobbi is a separate procedural model on
**three.js** (`src/features/room/lib/blobbi3d`). The two are built from the
same `renderer/procedural` identity, but they serve different purposes and
use different engines. **Their geometry is not merged.**

That is why the teleport cannot have "the 3D adapter". It needs a core with
no engine in it, plus a thin adapter per engine. Each adapter is written
against a small contract that any compatible character satisfies, not
against one Blobbi mesh.

## 2. The proposed package: `@blobbi-kit/teleport`

```
@blobbi-kit/teleport            the core: no React, no DOM, no engine
  timeline        journeyFrame, DEPART/ARRIVE/REDUCED, CUES, cut and time inverses, journeyShadow
  particles       motesAt (with ceiling, bornBefore), moteLayers (the handover on reversal), TRAIL_MS
  presence        createPresenceController (present, departing, absent, arriving; reversible, cancellable)

@blobbi-kit/teleport/svg        DOM only (no React): any drawing, masked and composited
  silhouette2d    readDrawingOutline, outlineFromAlpha
  paint2d         the 2D painter (mask, squash, glow, edge, motes with trails, sky measurement)

@blobbi-kit/teleport/react      peer react
  usePresence, TeleportFrame2D  (a thin wrapper over svg/paint2d)

@blobbi-kit/teleport/three      peer three
  createTeleport3D({ root, figure }, tint)  → apply(frame, kind, t, { skyY | ceiling, layers }) / rest / dispose

@blobbi-kit/teleport/babylon    peer @babylonjs/core (written in the kit session, for @blobbi-kit/3d)
  the same contract over Babylon: per-material clip planes, a particle mesh, the lit-inside back faces
```

The **3D contract** that every engine adapter honours (and that both
Blobbis satisfy without knowing about the teleport):

- `root` is where the host stands, turns and scales the character.
- `figure` is the body under it. The adapter squashes it about the ground
  (y = 0 in `root`).
- The adapter reads the meshes' own vertices to find the outline. It
  assumes no particular geometry: any mesh with positions will do.
- It changes materials only through clipping, clip-shadows, side,
  transparency, opacity and emissive, and puts back exactly what it found.
- It adds only its own objects (motes, trails, cap) and removes them on
  `dispose`.
- The host decides when to call it: frame by frame, from a
  `PresenceController` snapshot.

Nothing in any of these modules imports from routes, inventory, Nostr,
furniture, rooms, navigation, auth or the presence coordinator. That is
true of the modules as they stand: their only imports are each other,
`react` and `three`.

## 3. Exactly what moves, and what stays

**Moves** (from `src/features/teleport/`):

| file | to | changes first |
|---|---|---|
| `timeline.ts` | core | none |
| `particles.ts` | core | none |
| `presence.ts` | core | none |
| `silhouette2d.ts` | `/svg` | none |
| `react/TeleportFrame2D.tsx` | `/react` + `/svg/paint2d.ts` | **split**: move `measureSky`, `sizeCanvas`, `paint` and the sprite cache into a framework-free `paint2d.ts`; the component keeps the effect loop only |
| `react/usePresence.ts` | `/react` | none |
| `three/teleport3d.ts` | `/three` | none (already generic over `{ root, figure }`) |
| the `.teleport-2d*` rules in `src/index.css` | inline styles in `paint2d` / `TeleportFrame2D` | so the package needs no stylesheet |
| `teleport.test.ts` | core tests | none |
| `adapters.test.tsx` | `/react` + `/three` tests | swap the Standalone's `buildBlobbiModel` fixture for a plain three.js figure (a capsule and two spheres) |

**Stays in the Standalone:**

- how the room drives a journey (`RoomScene.setActorJourney`, `skyAbove`,
  `journeyBefore`, the shadow fade, `actor.ts`);
- the page's wiring (faces, sounds, gestures, the playground);
- the mapping of cues to the app's own sounds;
- `RoomTeleport.test.tsx`.

The future presence coordinator (`README.md` §3) also stays out of the
package, as a separate concern that drives the controller.

## 4. Order of work (the kit session)

1. In the Standalone: split `paint2d` out of `TeleportFrame2D` and inline
   the CSS. Behaviour stays identical; the existing tests prove it.
2. In the kit: create `packages/blobbi-teleport` with the four subpaths,
   copy the modules and their tests, and add a manifest test (exports and
   peers, as `@blobbi-kit/3d` has).
3. Write `/babylon` against `@blobbi-kit/3d`'s rig (`root`, `body`, its
   meshes), using the same contract and the same core tests.
4. Publish nothing until both the Standalone and a Rumble build consume it
   from a local link.
5. Then the Standalone switches its imports and deletes its copies.

## 5. The expression system (the same boundary, later)

`src/features/expression` is kept in the Standalone this milestone. Its
extraction boundary is already clean:

- `faces.ts` maps names (curious, worried, affectionate…) onto the kit's
  own expression vocabulary. It belongs next to that vocabulary, in
  `@blobbi-kit/renderer` (named compositions over `BLOBBI_EMOTION_PRESETS`).
- `controller.ts` is the priority stack. It is engine- and framework-free
  and could share the presentation package with the teleport core.
- `react/useExpression.ts` belongs in `/react`.
- The 3D side (`BlobbiModel.setFace`) stays with each 3D model. The
  Standalone builds face variants from the kit's procedural face;
  `@blobbi-kit/3d` already has its own `setExpression`.
