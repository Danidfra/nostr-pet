# The bath (M15, Track A)

A cleaning item (Soap, Bubble Bath, Shampoo, Soft Towel: every official
item whose care action is `clean`) is a small game, played the same over the
2D home's drawing and the 3D room's model, with ONE write at its end.

```
select an item → enter the tub → soap (drag) → rinse (hold) → dry (drag) → commit → done
                                                                           ↘ failed → Try again (a tap) → commit
any step before the write, and failed → cancelled (Stop, a change of room, a teleport, decorating, the page going)
```

## The pieces

| File | What it is |
| --- | --- |
| `bath-machine.ts` | The pure machine: a coarse 8×8 grid over the Blobbi's art box, masked by its silhouette; foam and wet per cell; the stages pass by coverage. `reduce(state, event)`; nothing mutated. |
| `body-mask.ts` | The grid's cells that are the body: read from the canonical drawing (`readDrawingOutline`), else the plain blob. |
| `useBathSession.ts` | The machine run as a script on an interaction director (`room/lib/room-interaction.ts`): cancel reasons, `protect` round the write, the Blobbi's reactions through the host (face, gaze, gesture, sound), the view once a frame. |
| `BathTouchLayer.tsx` | The surface over the Blobbi's box that takes every pointer (captured, `touch-action: none`) and hands it over in box coordinates; draws the foam, the wet, the rain and the tool in hand (off when the 3D model draws them). Arrow keys carry the tool; Space lifts it. |
| `BathToolBar.tsx` | One tool at a time in the dock, the guidance line, the progress, Stop and Try again. |
| `BathTub2D.tsx` | The 2D home's tub in two layers (back, front) round the Blobbi. |
| `bath.css` | Everything the bath draws; reduced motion stills every animation. |
| `room/lib/scene/bath-scene.ts` | The 3D room's bath: the hollow tub on the tub item's footprint, the water, instanced foam on the body, the rain, the tools as meshes; the near walls and the water on the overlay pass when the Blobbi is the page's drawing. |

## The hosts

- **2D home** (`home/BlobbiOverview.tsx`): the bath's session over the home's
  own `useUseItem` / `useStarterUse`; the Blobbi walks to the tub's spot and
  the two tub layers stand round it; the actor takes the bath's face, gaze
  and gesture over its presentation; the layer is the actor's child; the bar
  stands in the options slot. An egg is bathed on its nest, with no tub.
- **3D room** (`room/RoomPreviewPage.tsx`): the session runs on the room's
  director (`interactions.run('bathing', …)`, so the room knows the Blobbi
  is busy); the Blobbi walks to the tub item and is scripted onto its floor
  (`setActorScript`, `BATH_ELEV`); the scene is handed the bath to draw
  (`RoomControl.bath`); the layer stands in the Blobbi's overlay box; the
  room's own taps, strokes and swipes are locked (`inputLocked`); the write
  is the room's own offer (`care.place` + `begin`), placed only at the end.
  A room without a tub, the simple room, and an egg bathe where the Blobbi
  stands.

## The rules that matter

- Nothing is written, spent or persisted before the last stage: a cancel at
  any step, a refresh, leaving the room or switching homes writes nothing and
  consumes nothing, and the Blobbi is put back on the floor (the run's
  cleanup gives everything back).
- The write is the home's existing use path: an owned item signs one spend,
  ledgered and resumed on Try again (never a second one); a starter writes
  the 31124 and its 1124. A cancel asked during the write is held until it
  has landed or failed.
- A tap never passes a stage: the soap and the towel lay nothing until the
  pointer has travelled past a tap's slop; the shower works with time under
  its head; each stage needs most of the body covered.
- Hygiene already full refuses a bath with a word (no free play mode).
- Reduced motion keeps the faces and the eyes and drops the hops, the
  wiggles, the sparkles, the bobbing tools and the moving water.
- The bath is busy for as long as it is on screen, its celebration included
  (`active || view !== null`): the invitation to save and the home's own
  verbs wait for it; the room's needs HUD steps aside meanwhile.
- A cleaning item chosen while an earlier owned use is still open in the
  spend ledger is not bathed with: that use is resumed and finished first
  (the old way), so the bath's one write can only ever be its own.
