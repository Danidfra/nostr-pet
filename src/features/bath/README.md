# The care rituals (M15: the bath, refined)

A cleaning item (Soap, Bubble Bath, Shampoo, Soft Towel: every official
item whose care action is `clean`) is a small game, its RITUAL, played the
same over the 2D home's drawing and the 3D room's model, with ONE write at
its end.

```
Soap, Shampoo   wash    in place   lather (drag) → rinse (hold the shower) → commit → shake → done
Soft Towel      towel   in place   dry-rub (drag)                          → commit → done
Bubble Bath     soak    the tub    jump in → play (timed) → jump out        → commit → shake → done
any other clean item: the wash (the safe default)

commit ↘ failed → Try again (a tap) → commit (the same spend)
any stage before the write, and failed → cancelled (Stop, a change of room, a teleport, decorating, the page going)
```

## Contract (Agent A ↔ Agent B, M15 care refinement)

The types are frozen; later changes are additive only, announced in
`scratchpad/m15/CARE-HANDOFF.md` with a SHA.

- **`rituals.ts`**: `RitualId` (`wash | soak | towel`), `RitualStyle`
  (`soap | shampoo | bubbles | towel`, the look only), `RitualPlace`
  (`tub | in-place`), `RitualDef` (`id`, `style`, `place`, ordered `stages`:
  `{ id, kind: rub | rinse | dry-rub | timed | script, durationMs?, tool,
  guidance }`), `ritualFor(itemD)`.
- **`bath-frame.ts`**: `BathFrame`, everything a renderer may read: the
  ritual, style, place, `status`, the stage (`id`, `kind`, `index`,
  `count`), `progress` 0..1, the `grid` and its `cells` (`body`, `visible`,
  `foamed`, `wet`, `dry`, booleans), `outline` (feet, top), the `tool`
  (`kind`, `at` in box units, `pressed`), `wetness` 0..1, the ordered
  one-shot `cues` (`splash-in`, `splash-out`, `shake`, `rinse`, `done`,
  each with an id), `reducedMotion`, `revision`, `key`. Made by the pure
  `frameFromState(source, context)`.
- **The anchor** (`BathAnchor`): `box` for the 2D home and the room's
  Classic drawing (the effects are mounted in the Blobbi's art box, which
  moves with the actor; its size in px); `world` for the 3D scene
  (`RoomScene.setBath(frame, anchor)`: the main actor, followed each frame
  as it moves, and the tub item's index or null for a ritual in place).
- **Who draws what**: `BathTouchLayer` (A) is input only: the art box plus
  `HIT_PAD_PX` round it, box coordinates, the box measured in px.
  `BathEffects2D` (B) draws the frame in the box. `bath-scene.ts` (B) draws
  it in 3D.
- **The rule**: renderers never decide progress. What is drawn foamed is
  exactly a cell's `foamed`; a cue is played once per id; a `shake` cue
  only ever follows a landed write.

## The pieces

| File | What it is |
| --- | --- |
| `rituals.ts` | The ritual table: which game each cleaning item is, its place and its stages in order. |
| `bath-machine.ts` | The pure machine: walks the ritual's stages; a coarse 8×8 grid over the Blobbi's art box, masked by its silhouette; foamed, wet and dry per cell (booleans: drawn equals counted); each stage passes by its own rule (coverage, time, the host's script). `reduce(state, event)`; nothing mutated. |
| `bath-frame.ts` | The render model every renderer reads, and the anchor. |
| `body-mask.ts` | The grid's cells that are the body: read from the canonical drawing (`readDrawingOutline`), else the plain blob. |
| `useBathSession.ts` | The machine run as a script on an interaction director (`room/lib/room-interaction.ts`): cancel reasons, `protect` round the write, the Blobbi's reactions through the host (face, gaze, gesture, sound), the view once a frame. |
| `BathTouchLayer.tsx` | The surface over the Blobbi's box (and 24 px round it) that takes every pointer (captured, `touch-action: none`) and hands it over in box coordinates; measures the box in px. Arrow keys carry the tool; Space lifts it. Draws nothing: `BathEffects2D` is its child when the page's drawing is on screen. |
| `BathEffects2D.tsx` | The ritual drawn on the 2D drawing from the frame: the foam, the wet, the rain, the tool. |
| `BathToolBar.tsx` | One tool at a time in the dock, the guidance line, the progress, Stop and Try again. |
| `BathTub2D.tsx` | The 2D home's tub in two layers (back, front) round the Blobbi. |
| `bath.css` | Everything the bath draws; reduced motion stills every animation. |
| `room/lib/scene/bath-scene.ts` | The 3D room's bath: the hollow tub on the tub item's footprint, the water, instanced foam on the body, the rain, the tools as meshes; the near walls and the water on the overlay pass when the Blobbi is the page's drawing. |

## The hosts

- **2D home** (`home/BlobbiOverview.tsx`): the ritual's session over the
  home's own `useUseItem` / `useStarterUse`; a wash or a towelling is played
  where the Blobbi stands; a soak walks to the tub's spot, jumps in (the
  actor's hop, the two tub layers round it), plays, jumps out and steps
  toward the viewer; the actor takes the session's face, gaze and gesture
  over its presentation; the layer is the actor's child; the bar stands in
  the options slot. An egg soaks on its nest, with no tub.
- **3D room** (`room/RoomPreviewPage.tsx`): the session runs on the room's
  director (`interactions.run('bathing', …)`, so the room knows the Blobbi
  is busy); the scene is handed every frame on the main actor
  (`RoomControl.bath(frame, anchor)`: `tubIndex` null in place); a soak walks
  to the tub item and is scripted onto its floor (`setActorScript`,
  `BATH_ELEV`) and back out over its near rim; the layer stands in the
  Blobbi's overlay box; the room's own taps, strokes and swipes are locked
  (`inputLocked`); the write is the room's own offer (`care.place` +
  `begin`), placed only at the end. A room without a tub, the simple room,
  and an egg soak where the Blobbi stands.

## The rules that matter

- Nothing is written, spent or persisted before the last stage (a soak's:
  the jump out): a cancel at any step, a refresh, leaving the room or
  switching homes writes nothing and consumes nothing, and the Blobbi is put
  back on the floor (the run's cleanup gives everything back).
- The write is the home's existing use path: an owned item signs one spend,
  ledgered and resumed on Try again (never a second one); a starter writes
  the 31124 and its 1124. A cancel asked during the write is held until it
  has landed or failed. A wet Blobbi shakes itself dry only after a landed
  write (the `shake` cue).
- A tap never passes a stage: the lather and the towel lay nothing until the
  pointer has travelled past a tap's slop (at least 5 px); the shower works
  with time under its head; each stage needs most of the visible body
  covered (lather 0.75, rinse 0.85, towel 0.7), and the last two cells
  finish themselves. Only visible body cells count, and what is drawn is
  exactly what is counted (booleans).
- Measured in px on screen: the brush is at least 24 px across, the
  shower's column at least 18 px, its head 26 px above the finger (so the
  finger never hides it or the face) and it still reaches the body from the
  top of the touch margin; the touch surface is the art box and at least
  24 px round it. A cell under the middle of the stream rinses in 0.35 s.
- Nothing is rubbed before the body's outline is known (or 0.7 s have
  passed and the plain body stands in): what is laid is never thrown away.
- Hygiene already full refuses a ritual with a word (no free play mode).
- Reduced motion keeps the faces and the eyes and drops the hops, the
  wiggles, the sparkles, the bobbing tools and the moving water.
- The ritual is busy for as long as it is on screen, its celebration
  included (`active || view !== null`): the invitation to save and the
  home's own verbs wait for it; the room's needs HUD steps aside meanwhile.
- A cleaning item chosen while an earlier owned use is still open in the
  spend ledger is not played with: that use is resumed and finished first
  (the old way), so the ritual's one write can only ever be its own.
- Medicine is not a ritual (`home/medicine`): a short moment where the
  Blobbi stands, on the home's item path, never the bath and never the tub.
