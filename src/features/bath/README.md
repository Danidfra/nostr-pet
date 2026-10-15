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

## Rendering (Agent B, M15 care refinement)

What each renderer draws from the frame, and the rules it keeps. Nothing
here counts: what is drawn foamed is `foamed`, wet is `wet`, towelled is
`dry`, a cue is played once per id, and no renderer ever decides progress.

### 2D (`BathEffects2D.tsx`, `effects/body-shape.ts`, `bath.css`)

- **Clipped to the body.** Everything laid on the Blobbi is inside one SVG
  `clipPath` built from the frame's body cells: each grid row with a body
  cell gives a row from the leftmost cell to the rightmost (drawn in from
  their outer edges by `EDGE_INSET`, since a cell counts when its centre is
  in the silhouette), the lowest at the outline's feet and the highest at its top,
  rounded into a closed spline (`teleport/silhouette2d.ts`: `rowsPath`,
  with `outlineRows` beside it for a drawing's own silhouette). Off the
  body only what falls is drawn: the shower's rain, the falling half of
  each drop and its ground splash, and the cues' bursts.
- **The foam** is one bubble per foamed cell (a radial gradient, a pop-in);
  the shampoo's lather is tinted lavender and denser (a second, smaller
  bubble each). `bath-foam[data-count]` is the machine's count.
- **The sheen** is a glossy gradient clipped to the wet cells not yet dry,
  its opacity `0.18 + 0.32 × wetness`; a towel ritual (whose `wetness` is
  always 0) shows a damp sheen over every body cell not yet rubbed dry, and
  a soft fluff on each `dry` cell, so the rub is visible where it went.
- **The water**: up to four thin streams down the body's sides and belly
  (dashes flowing along a path through the rows) in step with `wetness`
  (all four under the shower), and up to six drops that start on the body,
  slide to the lowest body cell of their column, let go there (the clip
  cuts them off) and fall, outside the clip, to a ring on the ground at the
  outline's feet. One CSS cycle per drop (`--cycle`, `--slide-dy`,
  `--fall-dy`); about twenty nodes beyond the foam.
- **The rain** falls from the shower head to the body's top under each
  drop (the feet beside the body), with a splash where it lands, inside the
  clip.
- **The cues**: `splash-in` / `splash-out` draw a ring and drops flung up at
  the feet; `shake` flings a ring of drops out from the body's middle and
  mounts a `.bath-shake` marker in the layer for the burst's length. The
  stylesheet wobbles the drawing beside that marker with `:has()` (the 2D
  home's actor box, the room's Classic drawing); no host sets anything. A
  browser without `:has()` keeps the burst and skips the wobble. The
  memory is the last cue id; a new `key` starts it afresh.
- **The tub** (`BathTub2D.tsx`): during `play`, rings widen on the water
  behind the Blobbi and drops are flung up over the near edge, again and
  again (stage-driven, not a cue).
- **Reduced motion** (`frame.reducedMotion`, and the layer's
  `data-reduced`): no streams, no running or falling drops, no rain drops
  (a still spray from the head), no wobble; the foam and the sheen still;
  a burst fades in place. The state (which cells are foamed, wet, dry)
  stays legible.

### 3D (`room/lib/scene/bath-scene.ts`, `bath-fx/`)

- **The surface** (`bath-fx/surface.ts`): once per ritual (again if the
  Blobbi's size or what stands there changes, never mid-jump), every body
  cell is sampled by a ray from the camera's side onto the 3D model's
  meshes (the shadow caster's shape when the page draws the Blobbi; the
  plain dome where the ray meets nothing), giving a point and a normal in
  the actor's frame (across, up, out). The foam sits on those points; the
  drops run between them. The effects follow the actor each frame from
  those offsets.
- **The foam** is one instanced sphere per foamed cell on the surface,
  lifted by its radius along the normal; the shampoo's lather is tinted
  and has a second, smaller bead per cell. One draw call.
- **The water** (`bath-fx/droplets.ts`): a pool of 28 beads, as many
  running as `wetness` asks, each spawned near the top of a body column,
  running sample to sample down it, let go at the column's lowest body
  cell, falling under gravity and splashing on the floor (the tub's water
  when the Blobbi stands in the tub). Two draw calls (the beads, the
  rings), however many there are.
- **The wet look** (`bath-fx/wet-look.ts`): the model's standard materials
  have their roughness lowered toward 0.22 in step with `wetness` (and a
  clearcoat where a material has one), and are put back EXACTLY when the
  body dries, the bath ends or the layer is disposed. No material is
  created or replaced, so nothing recompiles.
- **The cues**: `splash-in` / `splash-out` fling beads up from the water;
  `shake` wobbles the model about its feet (a decaying roll post-multiplied
  on its root's quaternion each frame for `SHAKE_S`; the actor sets its
  turn afresh every frame, so nothing is left behind) and flings a ring of
  beads. Once per cue id; a new `key` starts afresh.
- **Reduced motion**: no beads, no bursts, no wobble, the rain still; the
  foam and the sheen stay.

### The room's two passes (the rules this layer keeps)

- With the page's drawing in the tub (Classic), only the tub's **near walls,
  rim and feet** go on the overlay pass (layer 1), over the drawing, the
  way the 2D home's front layer stands over its actor. The **water and the
  suds never do**: on the overlay they drowned the drawing; they stay on
  the main pass, behind it. Nothing laid on the body is drawn here then
  (`bodyFx` hidden): the DOM layer draws the same clipped effects over the
  drawing. A ritual in place with the drawing hides the whole layer.
- Every mesh that may go on the overlay pass receives shadows (the pass's
  standing rule: WebKit's GL rejects a draw there from a program compiled
  without shadow sampling). The overlay pass is skipped on a frame where
  the key light casts and its shadow map is not built yet
  (`RoomScene.renderFrame`), and a change of shadow quality is applied
  between the two passes, never before the overlay pass
  (`RoomScene.applyShadowQuality`).
- No new WebGL context, no fluid simulation: everything is instanced
  meshes and the stylesheet.
