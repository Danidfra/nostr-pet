# Blobbi standalone: architecture and rebuild notes

The standalone app is **the home of your Blobbi**. It is a consumer of the
shared Blobbi packages, never another source of Blobbi protocol, domain or
rendering truth.

```
@blobbi-kit/core          protocol + domain (kind 31124 / 11125, parsing, decay, progression, visual identity)
        ↓
@blobbi-kit/react         shared hooks (collection, projected state, care, missions)
@blobbi-kit/renderer      canonical Blobbi drawing from plain visual data
        ↓
Blobbi standalone         home UX (this repo)

@nostr-games/inventory    inventory / equipment protocol  →  standalone inventory surfaces (read; spends only)
```

## Who owns what

**Standalone owns**

- home UX: the hero, status panel, selector, loading / empty / error states;
- navigation and the app shell (router, header, theme);
- product presentation (copy, layout, branding, fonts, theme tokens);
- standalone-specific profile / settings surfaces;
- care interaction surfaces (buttons and flows; not the formulas);
- inventory presentation (not the inventory protocol);
- the "Enter Blobbi Island" exit and other ecosystem destinations;
- auth / session wiring (which signers are offered, how logins persist), and the way in (welcome, account creation with the ecosystem's primitives, profile setup, adoption).

**Blobbi Kit owns**

- the modern Blobbi protocol and domain model (`BlobbiCompanion`, `BlobbonautProfile`);
- parsing and classification of kind 31124 (`isModernBlobbiEvent`, `parseModernBlobbiEvent`, `classifyBlobbiEvent`);
- legacy policy (identify and ignore; no migration);
- visual identity, including persistent `visual_generation` (missing / invalid → v1, v1 → v1, v2 → v2);
- shared hooks (`useBlobbisCollection`, `useProjectedBlobbiState`, care / mission hooks);
- decay, thresholds, XP and level maths;
- canonical rendering (`BlobbiRenderer`).

**@nostr-games/inventory owns**

- the inventory / equipment event kinds and their parsing.

## Product role in the ecosystem

| App | Role |
| --- | --- |
| Ditto | egg adoption, incubation, ceremonies, social missions, evolution |
| **Standalone** | everyday home: first egg adoption, current Blobbi, care, items, lifecycle, status / progress, launch Island |
| Blobbi Island | social multiplayer world, economy, interoperability |

The standalone does not duplicate Ditto's ceremony-heavy onboarding (it
keeps one rule of it: an account's first egg hatches right away, see "The
first Blobbi hatches by itself") or the Island's world runtime. Since M13 the
2D home is where a first Blobbi is born and the default home; the 3D room is
opt-in (`src/lib/home-experience.ts`), its code in a lazy chunk. "Your Blobbi lives here. The Island is where you go
out into the world."

## Milestone 2: themes, the home, and the care loop

### Themes (standalone presentation, never protocol)

`src/theme/` is a data-driven registry (`themes.ts`): five `BlobbiHomeTheme`
entries, each with design tokens (the HSL variables Tailwind reads), an
environment (sky gradient, optional illustrated backdrop under
`public/environments/`, ground glow) and a swatch for the picker.
`applyThemeToDocument` writes them as custom properties plus
`data-blobbi-theme` and the `dark` class; no component branches on a theme id.
The choice persists under `blobbi:home-theme:v1` (device-local; a theme is
never published), and an unknown or removed stored id falls back to Cozy Home.
`ThemePicker` is a keyboard-operable radio group with swatch previews.

A theme changes the environment, surfaces, text treatment and buttons. It never
changes Blobbi state, traits, `visual_generation`, events or care maths, and
`care.test.tsx` pins that the renderer's body markup is identical across themes.

Recovered from the pre-nuke app: the warm "elegant" palettes (now Cozy Home and
Space's dark surfaces) and the Forest / Beach / Garden / Space backdrops the old
Polaroid feature shipped as unlockable backgrounds (re-encoded from PNG to
small JPEGs). Reinterpreted: the full-height hero with the Blobbi centred and
rings above it became an environment scene with the Blobbi on lit ground, its
mood line, and a care dock; the old sticky actions footer became the dock
(tapping is the action; no modal in between). Discarded: light/dark/system as
the whole theme system, the coin-gated background unlocks, the fixed
`--app-header-h` layout plumbing, the egg-only warm/check/sing/talk actions.

### Home composition

Top to bottom by importance: the scene (`BlobbiOverview` → `HomeScene` →
`BlobbiActor`, see milestone 3; the name and a `describeMood` line from the
kit's `getStatsNeedingAttention`), the care dock
(`CareDock`, fixed under the thumb on small screens, inside the scene on
larger ones), condition (`BlobbiStatusPanel`, rings with icon, value, badge and
`role="meter"`), progression (`ProgressionStrip`: Blobbi XP, level bar,
streak, last cared for), then the Island exit. Other Blobbis are round
portraits drawn by the canonical renderer (`BlobbiSelector`).

### Care write flow

```
button → useCareActions.perform(d, action)
  → fetchFreshEvent(kind 31124, author, #d)        kit fresh read; never the screen's copy
  → isModernBlobbiEvent / parseModernBlobbiEvent   modern only
  → availableCareActions                           stage/state gate
  → planCareAction (src/features/care/care-plan.ts) kit primitives only
  → PublishAdapter.publish                         sign (NIP-07/46) + relay fan-out
  → updateCompanionEvent                           cache = the published event
  → emitInteractionEvent (kind 1124, best effort)  as every other host
  → collection.invalidate                          relay-backed refetch
```

`care-plan.ts` composes: `applyBlobbiDecay`; the kit's per-action care effect,
obtained by running `consolidateSocialInteractions` on the interaction this
action emits (item-specific effects arrive with inventory via the kit's
`CatalogAdapter`); `calculateInventoryActionXP` + `applyXPGain` into
`experience`; `getStreakTagUpdates`; `statsToTagUpdates` + `updateBlobbiTags`
(unknown tags preserved, timestamps stamped). Rest has no dedicated kit
primitive: as in Ditto, it is the `state` tag flipping `active` ↔ `sleeping`
on a decayed republish; hibernation is never toggled here. Egg semantics
follow Ditto's item rules (clean only). No formula lives in this repo.

Nothing publishes on load. One action at a time; the button is disabled while
in flight. A failed publish is reported and the screen keeps relay state.

### PublishAdapter boundary

`usePublishAdapter` implements the kit's `PublishAdapter`: `finalizeTemplate`
(client tag, `published_at` preserved from `prev` or set on first publish),
`user.signer.signEvent`, pubkey check, `nostr.event`. It knows nothing about
Blobbis; `care-plan.ts` knows nothing about signing.

### Current companion

Selecting a Blobbi writes the device pick at once and, when the player has a
kind 11125 profile, publishes it through `useSetCurrentCompanion`: fresh
`fetchFreshBlobbonautProfile`, the kit's `updateBlobbonautTags` over the full
tag list (so `has`, `xp`, onboarding and unknown tags survive), `prev` set.
An unowned `d` is refused; with no profile nothing is created (adoption owns
profile creation) and the pick stays device-local.

### Still deferred

Inventory reading and item use arrived in M4 (see "Milestone 6"). Equipment
rendering (31634) is still read-only. Relay discovery for ecosystem data is
the read router below (no relay settings UI). Also deferred: account
switcher, social interaction projection on the home, the companion runtime.

## The 3D room, milestone 1 (preview, 2026-10-10)

The room Ditto draws on its `/blobbi` page (a three.js papercraft diorama:
an 8×8 tile floor, two back walls, a 45° camera from the open corner, paper
textures, soft shadows, furniture modelled as Simple Nostr Objects) is
being brought into this app one milestone at a time, as `src/features/room/`.
Milestone 1 is the foundation and lives behind a dev-only lazy route,
`/room` (`AppRouter`, gated on `import.meta.env.DEV`), so the production
bundle and the home at `/` are untouched until the room can carry the care
flows.

What is Ditto's, copied as it is: the engine (`lib/scene/RoomScene.ts`),
the textures, the SNO builder and the 45 official models, the facing rule
(`lib/room-facing.ts`, with its test) and the geometry. What is this
app's: `RoomShell` (Ditto's shell without i18n, haptics, arc chrome, poop
and guide pulses, over the existing room registry's ids, labels and order),
`RoomBlobbi` (the canonical `BlobbiRenderer` for V1, V2 and V3 alike,
standing on the renderer's own ground line from `describeBlobbiArtwork`
rather than Ditto's per-form table), a trusted-input SNO adapter
(`lib/scene/sno-object.ts`, the bundled models only; the network parser
comes with the milestone that places `sno:` objects), and the 3D catalog
(`lib/furniture-3d.ts`: mounts, surfaces, interactions). The room's
surfaces ARE the registry's (`roomLayoutFor` returns `roomById(id).surfaces`);
a sleeper is in the bedroom by the registry's `resolveRoom`.

Nothing is read from or written to Nostr for the room: the room choice is
the page's state and the furniture is Ditto's defaults, kept in Ditto's
`room_furniture_v2` placement shape so a saved room can be read later.
three.js (0.186) loads on demand with the scene; `RoomScene-*.js` is its
own chunk and absent from a production build.

**Milestone 2 (walking and the movement contract).** The M1 Blobbi hopped:
Ditto's engine bounces the whole anchor while a path remains (its own V1/V2
drawings have no walk) and the stage never told the renderer `walking`.
Both are gone. The shell reads `RoomScene.isWalking` beside `facingOf` in
its per-frame anchor pass and reports a CHANGE of `{ facing, motion }`
(`onActorChange`); `useRoomNavigation` holds it as state and `RoomBlobbi`
hands it to `BlobbiRenderer motion`, so the kit draws its own gait (the V3
adult on its legs, a baby with its hop, V1/V2 through the wrapper walk) from
the side the facing names. The pace is the home's gait table converted to
room tiles per second (`lib/room-pace.ts`: stride × box tiles × cos(camera
elevation) × √2 for the diagonal tile axes, over the renderer's cycle), set
per actor on the engine. Matched to the kit's short stride and fixed 0.62 s
cycle that is a shuffle of 0.85 tiles/s, which the review found far too
slow, so the room plays the kit's walk `WALK_TEMPO` (2.35) times faster
through a CSS `animation-duration` override keyed to `--room-walk-tempo` on
the stage, and moves the Blobbi that much faster with it: about 2 tiles/s,
a room's width in four seconds, the planted foot still planted because
cadence and pace come from one number. The kit has no rate prop and is
untouched; its keyframes, phase delay and reduced-motion rule still apply. The engine now
speaks the home's `WalkOutcome` contract: `requestWalk(id, x, z, 'to' |
'approach')` resolves `arrived | replaced | stopped | refused`, settled from
every place a path can end (arrival, a newer request including a floor tap,
`stopWalk`, a room change, decorating, going away, disposal; reduced motion
teleports and has arrived), and the shell's `RoomControl` exposes it as
promises. The gaze is the home's `useGazePolicy` over the room's own
elements, with a glance the way it walks (`lib/room-gaze.ts`). The engine
is tested for real in jsdom with three's renderer stubbed
(`RoomScene.walk.test.ts`).

**Milestone 3 (decorating).** Ditto's decorator is three layers: the
engine (the editing camera, the grid, picking, dragging on the floor and
wall planes, grid snapping, stacking on tables, overlap reporting, green
and red footprints), the shell (grab on `pointerdown`, drag past the slop,
report a valid drop, anchor the toolbar over the piece, dim the Blobbi,
disable the swipe, swap the HUD and dock for the editor's bars) and the
chrome. The first two came whole with M1; M3 adds the chrome and the
state. `components/RoomDecorator.tsx` is Ditto's overlay (cancel, title,
hint, Save held while pieces overlap; a tray of category tabs with 3D
thumbnails, wallpaper and flooring editors, "match my theme") and
floating toolbar (turn, size steps, put away; R, Delete, Escape, arrows),
without react-intl, toasts (a notice in the hint line instead), network
objects and picture uploads. `RoomSurfaceEditor.tsx` uses the browser's
colour input and the home's own `surfaceBackground` for the swatch.
Thumbnails are stills of the SNO models on one shared WebGL context
(`lib/scene/still-renderer.ts`, Ditto's `modelRenderer` without the file
loaders), cached by react-query, with a box icon without WebGL.
`hooks/useRoomDecorator.ts` holds what Ditto's page holds (the drafts, the
selection, the overlaps, the room pinned while decorating) and saves only
what changed by identity, so an untouched room keeps following its
defaults; a room change discards the draft, as on Ditto. What is saved
lives in `lib/room-session.ts`: React state, per room, for the session;
no localStorage, no Nostr, no new format (tested with spies). The pure
edits are `lib/placement-edit.ts`. All official furniture is offered in
the catalog, separate from any inventory; ownership is M4's. Verified for
real in jsdom with the GPU stubbed: overlaps, free spots, drag and snap,
blocked drops going back, a quarter turn's footprint, decorating stopping
walks; and with mouse and touch pointers over a faked scene. Next: M4 the
dock and items, M5 persistence and rooms, M6 replaces the home.

**The M3 regression (a lost WebGL context).** Entering the decorator made
the room vanish, leaving the DOM-drawn Blobbi, and sometimes fold back in
later. Not the camera (its transition is eased over rendered frames, now
pinned by `RoomScene.edit.test.ts`) and not React remounting the shell:
the catalog's thumbnails each probed `getContext('webgl2')` on a scratch
canvas and never released it; Chrome caps live contexts at about sixteen
and loses the OLDEST past the cap, the room's, so `useRoomScene` went
`unavailable`, unmounted its canvases and remade the scene two seconds
later (the "reappearing"). The fix is one page-wide probe,
`webglAvailable()` in `useRoomScene.ts`, taken once, released and cached,
which the thumbnails ask instead. `RoomShell.lifecycle.test.tsx` runs the
real hook lifecycle over a recording fake engine and pins that decorating
(entering, selecting, moving, re-laying out, saving, cancelling) reaches
ONE scene through setters, never disposes it, keeps the canvases in the
document, never replays the fold-in, and makes at most one WebGL probe;
`FurnitureThumbnail.test.tsx` pins the probe count over the whole catalog.

**The 3D Blobbi prototype (`lib/blobbi3d/`, `/room/3d-lab`).** A V3
Blobbi lofted from the kit's own geometry, through the renderer's
published `procedural` entry point (`buildBlobbiGeometry`,
`deriveMorphology`, `motionPose`; allowed by the import contract test as a
public subpath). Identity: `genomeOf` resolves the identity with the kit's
`normalizeBlobbiV3Visual` and generates the genome as the kit's
`blobbiV3Genome` does, pinned path-for-path against the kit's SVG in
`model.test.ts`; same `(pubkey, d)`, same model. Geometry: each height's
cross-section is the ellipse the front silhouette (`spanAt`) and the side
silhouette (`frontAt`/`backAt`) agree on; the face sits on that surface
where the front view places it; feet, arms, tuft and appendages hang where
the views attach them, with the side view's depth; the markings (belly,
spots, stripes, gradient, special mark, freckles) are painted into a
texture wrapped around the body (`skin.ts`) and drawn as a decal; an
inverted hull draws the ink line. One model unit is the art box's height,
so the room scales it by the same `blobbiBoxTiles(stage)` as the drawing.
Motion: `poseRig` applies the kit's `motionPose` for the front view
(across, up, roll) and the side view (forward, pitch) about the kit's
pivots, so idle, the walk and the hop are the drawing's; turning (smooth,
the short way) and blinking (a cadence from the seed) are the model's own.
Engine: `RoomScene.setActorModel(id, model)` stands an `ActorModel` in a
Blobbi's place, moved, scaled and turned each frame and told its motion,
heading and sleep; `RoomShell` takes `blobbiModel` and steps the DOM
`stage` aside; the Blobbi's position, path and facing are untouched, so
the two are interchangeable views of one walk. SNO was tried
(`sno-figurine.ts`: the same Blobbi as a `sno:` lathe-and-spheres object)
and judged unfit for a character: flat per-face colours, a 1/120 lattice,
no smooth normals, no rig; it stands beside the model on the lab's stage
for comparison. The lab (dev-only, gated like `/room`, never importing
`src/dev/`) shows three fixed addresses plus the signed-in V3 Blobbi as
the kit's drawing over the model from the front, side and back, a stage
with view (incl. a turntable), motion, sleep and figurine controls, and
the real room with a 2D/3D switch. Nothing is published or stored. Tests:
`svg-path`, `model` (determinism under a different random stream, no
clock, kit-matched height/width/depth, parts per morphology, baby, views,
identity), `rig` (rest, breath, walk antiphase, lids, turn, blink, actor,
reduced motion), `sno-figurine`, `RoomScene.model.test.ts` (engine hook),
the lifecycle test's model case, `RoomLabPage.test.tsx` (route gate, three
identities, views, controls, 2D/3D switch, signed-in Blobbi, no writes).
Known approximations: the body between the two silhouettes, the side
face, shaded lighting, and the special-mark glyph outlines restated from
the kit.

**The fidelity pass (eyes, arms, the rear, the baby).** The first eyes
were wrong for three reasons, all found by measuring the kit: (1) the eye
was an ellipsoid turned to the skin's normal (±25° on an adult, ±31° on a
baby) with the iris and pupil as discs at a fixed depth on it, so the
kit's resting inward pupil offset, meant for a flat drawing, came out
skewed and the whites showed as crescents, which reads as cross-eyed;
(2) the kit's side view paints the eye INSIDE the silhouette (its depth is
not a 3D position at all), so no eye orientation can satisfy both views
and the front has to win; (3) the baby's "simple" eye is one big disc in
the iris gradient (`babyEyeLight`/`babyEyeDark`) with a highlight, never a
black pupil, and the baby's body is painted in `babyLight/Mid/Dark`. Now
(`eyes.ts`, `surface.ts`) every feature is a STICKER: the kit's ellipse
sampled in the picture plane and each sample projected onto the body
(`Surface.at`), so its rim is on the skin wherever the body curves, with
the white's dome and the layers on it raised toward the viewer (+z) rather
than along the normal, so seen from the front every point is exactly where
the drawing has it: level eyes, mirrored resting pupils, no clipping, no
floating, and consistent under rotation because nothing is turned on its
own. The gaze slides the inner eye along the surface's tangents by the
kit's `travel`; a blink squeezes the open eye flat and draws the kit's
closed-lid line. The arms are lofted (`loftRings`) from the front paddle's
outline (width and place at each height) and the side paddle's (depth and
place), hung from the shoulder: rounded limbs with the kit's corner-to-
corner limb gradient and an ink hull, posed as before. The body's
cross-section is a superellipse (`SUPER` = 2.4): the front and side
silhouettes stay exactly the kit's and the diagonals are fuller, and the
body gradient turns smoothly from the front view's to the back view's
round the sides. The baby is scaled into its own box (`BABY_BOX`, the
kit's stage viewBox for it, `rootPerBox`), so it fills the room's baby
box as the drawing does. The lab gained a comparison matrix (nine
addresses as adults and babies, the kit's drawing beside three 3D stills
drawn through ONE WebGL context, `stills.ts`) and a gaze switch (resting,
or following the pointer). Tests: `eyes.test.ts` (centres on the kit's
centres on the surface, both stages; mirrored resting pupils at the kit's
offsets; layered vs simple eyes and their proportions; attachment: never
under the skin, never further out than the dome; the gaze's travel),
`limbs.test.ts` (arm size against both paddles, shoulder attachment,
smoothness; twelve addresses as adults and babies build whole, finite,
deterministic models with the morphology's parts).

**The general-purpose pass (coverage, appendages, gaze).** The generator
is split by concern: identity (`identity.ts`: the kit's identity
normaliser and genome API, no second genome algorithm), coverage and
compatibility (`compat.ts`: a table of every trait kind the kit publishes
and how it is drawn; `unknownKinds()` compares it with the kit's own
`HORN_KINDS`/`EAR_KINDS`/`TAIL_KINDS`/`PATTERN_KINDS`/`MARK_KINDS` and
algorithm/genome versions, `assertSupported` throws in a dev build on any
unknown kind or primitive part, so a new trait is a loud failure, never a
quiet wrong character), the surface (`surface.ts`, with an eye mound: the
skin under each eye raised 70% of the way to the eye's tangent plane,
depth only, so big baby eyes no longer wrap round a narrow head), the
face (`eyes.ts`, flat unshaded fills as in the drawing), appendages
(`appendages.ts` + `sweep.ts`), materials, motion (`rig.ts`, `actor.ts`)
and scene integration (`RoomScene.setActorModel`). Antennae, horns, ears
and the curl tail are swept, tapered tubes along the quadratic centreline
the kit draws each around: `sweep.ts` reads the centreline and widths back
out of the kit's `stalk`/`horn`/`softCone` outlines (refusing any other
structure), and `appendages.ts` combines views (across and up from the
front, forward from the side; a forehead horn, drawn end-on from the
front, and the tail, absent from the front, take their curve from the
side view and their across position from the back view). Ears are flat
leaves (depth a third of their width, the kit draws no ear depth) with the
inner ear on the front face. Nub and leaf tails are balls from the side
drawing, as wide as the back drawing. Cheeks the kit hangs past the
outline (the baby's) are moved inside the face. The gaze is a point in
the world (the pointer's ray on a plane in front of the face on the lab's
stage); the actor turns it into the kit's offset in the Blobbi's own
frame, clamps it to the unit disc, eases every change (~10/s), keeps the
moving inner eye on the white's dome, and fades it to rest as the face
turns away (nothing is looked at with the back of the head). A still pose
never blinks. The 3D walk (`WALK_TEMPO_3D` 1.08) plays the kit's cycle 8%
faster and the engine moves a model-driven actor 8% faster with it
(`ActorModel.pace`); the 2D drawing's room walk is unchanged. Coverage
fixtures (`coverage.ts`) use only the kit's genome API: one per trait kind,
every antenna x horn, horn x ear and ear x tail pair, and every gene at
-1 and +1 with every appendage present. The lab gained a trait-fixture
picker, matrix sets (identities, every trait, pairs, gene bounds), and the
coverage table. The kit gives a baby no tail (its development is 0), so
none is drawn.

## Milestone 14: play first, save later (guest mode)

A newcomer meets their Blobbi before any account exists: welcome → the egg
(on this device) → the hatch under their taps → care → one invitation to
save → the key, a profile, the Blobbi published. `src/features/guest/`.

**Identity.** A V3 Blobbi is its address: the kit derives its whole look
from `SHA-256(domain ‖ owner pubkey ‖ d)` and no tag carries a seed. So the
only way a guest Blobbi can later be published as the very same Blobbi is
for its owner's key to exist before the egg does. The key is RESERVED when
the guest egg is made (`reserveGuestIdentity`, the same primitive as any new
account's) and used for nothing but the address while the player is a guest:
no event is signed with it, none is sent, it never enters the login store, a
log, a URL or a request. It is given to the player, with the facts about it,
only when they choose to save (`SaveCeremony` → `KeyGift`, the M12.3 key
scene unchanged). Under an account the player already has, the guest Blobbi
cannot keep its look (a different key is a different Blobbi): it is kept on
the device, said once (`GuestConflictSheet`), never merged.

**The guest world.** One versioned document, `blobbi:guest:v1`
(`guest-store.ts`): the identity, the records (the Blobbi's 31124, the
11125, the 1124 receipts, in event shape but UNSIGNED, `sig: ''`), the care
count, the invitation's rest, the save's stage, the accounts told. Read
defensively (an unreadable record is quarantined, never deleted); written
whole on every change; a browser that refuses storage keeps it in memory and
the player is told. `guest-world.ts` answers filters as a relay would.

**The transport.** `GuestTransport` (inside `NostrProvider`, while a guest
plays) hands the app a composite pool (`guest-pool.ts`): a filter whose
authors are all the guest is answered from the guest world; anything else
goes to the real pool (and is answered empty if it fails); a guest record is
stored locally and never offered upstream; an unsigned record never leaves.
`useCurrentUser` reads the guest after the dev fixture and before the login
store (a login always wins). Every kit hook runs unchanged.

**Limits.** One Blobbi. Evolving waits for a saved Blobbi (its missions are
Ditto's), said in the details instead of a button; the worlds are "Save to
visit"; the Island door is the way to save; no owned items, no kind 0, no
sign out. Daily XP and the Journey run over the guest world and travel in the
11125 at the save.

**Saving** (`guest-migration.ts`, `SaveCeremony.tsx`): intro → key (the stage
is remembered before the sign-in, so a refresh resumes) → profile (optional,
the existing kind 0 path) → the Blobbi then the profile, each from a template
of the record (tags verbatim, `created_at` now), each checked against the
relays first (found: not published again) → read back → done. The record
stays until the relays hold both; a refusal stops with Try again; a refresh
after a landed save is confirmed by the home at mount (`useFinishSave`).
Not published: the guest days' 1124 receipts (the care is in the 31124 tags).

**The hatch never waits forever** (`HatchTheater`): a signer timeout in the
publish adapter, a ceiling over the write, a bounded wait for the baby, a
re-read, then an honest "saved but not showing" with Check again and Reload.

## Milestone 14.1: reliability, mobile controls, the first minutes

What M14 left on a desktop test: Save my Blobbi and I already have an
account did nothing from the 3D room. The room's menu set the guest
request (`GuestUi`) but only the 2D `Home` page rendered the ceremony, the
sign-in sheet and the conflict sheet; a player whose device remembered the
room never saw them. The layers now live above both pages (`GuestLayers`,
mounted beside the router's `Routes`), so a request made in either home is
answered wherever the player is, and the ceremony survives the change of
page that a save causes (signing in with the reserved key moves the room
to the home while the Blobbi is published; a saved Blobbi may move the
home to the room). `useGuestScene` decides what the layers show; the pages
only read it to keep out of the way (the home does not send a player to
the room under an open ceremony).

**One switch for the two homes.** The three controls that chose a home
(Explore in 3D, 2D home, Open in 3D) are one vertical toggle in the upper
right of both homes, 2D over 3D β (`ModeToggle`, `useModeSwitch`). Choosing
is going there, and the choice is the device's default from then on
(`blobbi:home:experience`, as before). The first 3D on a device asks first
(`ModeIntro`: experimental, the 2D home one tap away, some things still
being built; Try 3D or Stay in 2D), then never again
(`blobbi:home:3d-intro:v1`). New players still open in the 2D home.

**The room's controls.** The dock is the room's one set: the Blobbi on the
left (its sheet: numbers, lifecycle, the other Blobbis, items), the
carousel between, the room on the right (decorating; Back when a piece of
furniture opened a shelf). The HUD keeps the room switcher and the needs.
The room's own settings (how the Blobbi is drawn, graphics quality, the
view) moved from a HUD button into the game menu, the one settings entry
(`RoomSettings` as a section of `MenuSheet`); sound is there as before.

**Account.** The menu's account block is a tile that opens its own screen
(`AccountSheet`): the profile editor (the standard kind 0, nothing written
until Save), the secret-key backup for a key kept on this device, Sign out,
the way to Ditto. A guest sees Save my Blobbi and I already have an account
instead.

**The first minutes.** The kit's hatch plan writes every stat at 100; this
app publishes the hatch with a newborn's needs instead (`lifecycle/newborn.ts`:
hunger 80, happiness 86, hygiene 88, energy 84, health 100; all within the
schema and above the kit's baby warning line of 65), so the first care is
wanted but nothing is in distress. The kit is untouched: the template it
planned is adjusted by this app before the same publish. The care flame in
the HUD lights only after real care (`flameDays`): the kit's egg template
carries a streak of 1 and a hatch keeps it, so a flame for that would mean
nothing; a streak of 2 or more is real care by definition, and 1 counts
once a kind 1124 receipt exists (`journey/care-receipts.ts`, one read shared
with the Journey; a guest's local world answers it like a relay) or care
landed on this visit. Guest and registered hatches write the same needs.

**The fridge.** A tap on the kitchen's refrigerator opens its door over the
room (`FridgeSheet`): a fridge drawn in CSS, its light on, shelves with the
food and drink the player has (the shelf's own entries, `shelfEntries`),
how many of an owned item are left; choosing one hands it over through the
room's own use path (the same write, spend and ledger as the carousel's
Use). The closet says Coming soon as part of the game (`RoomBottomBar`);
no clothing system was added.

**Quieter relays.** The connection chip said "Some relays down" whenever
one application relay logged a retry, which a phone does every time a
backgrounded tab's socket is dropped and reconnects; on a real iPhone it
kept coming back. Degraded (some relays failing, the rest serving) is a
small dot now, with no word and nothing to press; the pill with Try again
shows only when every application relay is failing or the browser is
offline, and only once that has lasted `OFFLINE_HOLD_MS` (4 s). A failed
write still says so where it was asked. A guest's room shows no chip at
all (the 2D home already did not).

**Sound on by default.** Nothing stored means on; a stored off stays off.
The voice engine no longer schedules into a suspended AudioContext (a
sound asked for outside a tap would otherwise queue and burst out with
every other one at the first tap): it asks the context to resume, once at
a time, and plays nothing until it runs; the next pointer or key event
resumes it. No new audio library.

Verified in Chrome (Playwright, phone 390×844, 320×568, landscape, desktop):
the room's menu opens the ceremony and the sign-in sheet; the toggle sits
under the menu button in both homes without overlapping it, the room
switcher or the needs (the needs' arc moves left under 360 px); the fridge
fits a phone; no console errors. Not verified: a real device.

## Milestone 13: MVP release readiness (M11)

The pass that turns the M10 home into something that can be put in front
of players. No new systems; each stage removes a doubt.

**No floating sleeper, no speech.** A Blobbi asleep in the bed and an egg
on its nest are `inBed`: the bed is the ground, the actor casts no shadow
of its own and stands still (`nested` and `sleeping` modes force
`'still'`). Every line of Blobbi speech is gone (`SpeechBubble`,
`needLine`, `roomGreeting`, the annoyed lines); the Blobbi communicates
with its face, its body and its voice.

**A procedural voice** (`src/features/sound/`). The one Blobbi sound the
ecosystem already had is Ditto's feeding sound
(`ditto/src/blobbi/ui/lib/munchSound.ts`: sine pops and a triangle hum,
four chewing cycles with a per-cycle decay, a lowpass at ~1.9 kHz, an
18 ms delay, a master gain, a lazily created `AudioContext`). The
standalone's vocabulary is derived from it: `blobbi-voice.ts` holds
RECIPES as data (layers of `wave / offsetMs / durationMs / hz / gain /
attack / hold`), `eat` being Ditto's munch cycle for cycle and the others
(clean, poke, happy, excited, upset, sleepy, hatch, evolve) the same blocks
in other shapes. `voice-engine.ts` is the only module that touches Web
Audio: it creates the context lazily, resumes it after a user gesture,
schedules a recipe, and never throws. `sound-policy.ts` maps gameplay
events (a care result, a poke reaction, a reveal) to a `BlobbiSoundId`;
gameplay code asks for a meaning, never a frequency. `SoundProvider`
owns the engine and the mute (device-local). Sounds never touch Nostr;
a failed audio initialisation is silent, not fatal. The mp3 assets are
gone.

**Visual fixtures** (`src/dev/`). `?fixture=egg|baby|adult|adult-v2` with
`&state=sleeping`, `&low=<stat>` and `&expression=<preset>` mounts the real
app over an in-memory pool and a fixture signer: every stage and state
can be looked at without an account, a relay or a write. Only a dev
build behind `VITE_BLOBBI_DEV_TOOLS` contains it (a lazy import behind a
`DEV &&` gate; `env-contract.test.ts` pins that).

**Connection resilience without a relay manager.** nostrify already
reconnects: `NRelay1` uses `websocket-ts` with an exponential backoff from
1 s and closes idle sockets after 30 s; `NPool` opens a relay on first use.
What nostrify does not do is tell the interface. `src/lib/relay-health.ts`
is a small store fed by the pool's `log` option (`relay.ws.state`,
`relay.ws.retry`, `relay.ws.error` per relay) and by the browser's
online/offline events; it resolves `healthy | degraded | offline` over the
application relays. `ConnectionChip` in the top strip shows it, with a
retry that forgets past failures and refetches. Nothing new is stored,
routed or trusted: transport reporting only. (`hooks/useRelayHealth.ts`
holds the context and hook.)

**A signer app by QR or deep link** (NIP-46 `nostrconnect://`).
`useLoginActions().nostrconnect.start()` generates the ephemeral client key
and the URI with the application relays; the sign-in screen draws it as a
QR (`qrcode`, as Ditto does) and offers it as a link and a copy;
`.wait()` resolves the `NLogin.fromNostrConnect` login or aborts. The
client secret lives in memory for the handshake and is dropped; nothing
is logged, no key ever goes into a URL of ours, and a bunker login and a
local key are different login types in the same nostrify store. The
bunker path stays as "paste a bunker address".

**Onboarding polish.** One purpose per step: the welcome introduces, the
account step creates or connects, and adoption opens on the egg itself
(M12.3: no profile step, no "No Blobbi lives here yet" screen; the profile
is the menu's Account).

**Care is item-driven.** The plain Feed / Play / Clean actions are gone. A
verb opens the items that answer it: the **starter kit** and **owned
items**. `CareChoice` is `owned | starter`; an owned use is the M4 path
(a kind 1416 spend, the `blobbi_op` marker, the use ledger); a starter use
(`useStarterUse`) is the kit's care effect with `spendId: null`: no spend,
no marker, no inventory, no balance, and it is never shown as owned. Rest
stays bed-driven. The seam for a real economy is the `CareChoice` type:
a later milestone can require ownership by removing the `starter` branch.

**The starter kit is the whole official catalog, discovered.** A read-only
relay audit (2026-09-25; relay.ditto.pub answered, dreamith timed out)
found 39 kind 31632 events by the one trusted issuer
(`9efb8d30…63a9`, the same pubkey Island trusts), 19 of them care
consumables, all valid, no duplicates. `useHomeInventory` now queries
`kinds:[31632], authors:[OFFICIAL_ITEM_ISSUER]` and keeps only events whose
`pubkey` is the issuer; `resolveStarterEntries` merges them over the
bundled snapshot (`official-catalog-snapshot.ts`, generated by
`scripts/refresh-official-catalog.mjs`, header says NOT LIVE NOSTR DATA,
dated). Live definitions replace snapshot rows by address; a snapshot row
is marked `definitionSource: 'builtin'` and the chooser says so. An event
from anyone else can never replace a snapshot identity. `catalogStatus`
is `loading | live | snapshot`.

**One sleep cue; one expression prop.** The sleeping Blobbi showed two
"Zzz": the home's animated one and one baked into the V1 sleeping drawings
by the renderer. Ownership: the renderer draws the creature asleep
(closed eyes); an environmental cue is the host's. `@blobbi-kit/renderer`
0.4.0 (published; this app consumes `^0.4.0` from the registry) adds
`sleepIndicator: 'artwork' | 'none'` (removing exactly the label and the Z
texts of the artwork's Zzz block, never the block to the next comment: in
seven adult forms the gradients follow it) and an expressive V1 baby face
(`artwork/baby/v1/expression.ts`: rules over the one authored face; the
baby has no brows, so `brows` is not drawn). `BlobbiActor` passes
`sleepIndicator="none"` and draws the one animated Zzz itself. Between the
kit commit and its publication the app carried `lib/renderer-capabilities.ts`,
a capability shim that read the feature from the renderer's exports so the
home was correct against 0.3.0 and 0.4.0 alike; it is gone with the bump.
`expression-parity.test.tsx` pins exactly one sleep cue, and that the same
`expression` reaches every stage with the renderer saying which faces can
show it (the V1 baby and V2 adults yes, the V1 adults no). The purity test
refuses stage-specific SVG manipulation here.

**The dev panel (after M11).** Fixture mode grew from "look at a URL's
world" into a testing environment. `src/dev/fixture-world.ts` describes the
fixture Blobbi as a `FixtureSpec` (stage, generation, state, stats, streak,
xp, progression, mission counts) and builds the kind 31124 from it with the
test builders and the kit's own mission lists (`createHatchMissions`,
`createEvolveMissions`), born at a fixed time so the seed, the colours and
the seed-derived adult form never change between rebuilds; `createFixtureStore`
is the in-memory relay plus the handle that rewrites it. `fixture-controller.ts`
is the one writer: `setSpec` patches the spec the world currently says
(read back through `parseModernBlobbiEvent`), rebuilds the event, clears the
kit's session copy of the missions and notifies; presets derive every number
from `CRITICAL_THRESHOLDS`, `EVOLVE_STAT_THRESHOLD` and the mission targets.
`DevFixture` (still the lazy module behind the flag) provides the fixture
user, the pool, a `SceneSettingsProvider` carrying the panel's presentation
pins, and mounts `DevPanel`. The panel reaches the running app through the
same seams a relay does: `updateCompanionEvent` on the collection cache plus
invalidation of the task queries, so nothing remounts and nothing reloads;
its "Perform" buttons run the real `useLifecycle` (the kit's hooks over the
fixture pool) and show the kit's acceptances and refusals verbatim, while
the mission-gated ceremony stays the dock's. Two production-side changes
made this possible without dev branches: `SceneSettings` gained
`baselineExpression` and `facing` pins (the `?expression=` URL read left
`BlobbiOverview` for `src/dev`), and the home now puts a Blobbi whose
authoritative state turns to `sleeping` into its bed even when the change
did not come through the Rest walk (a refetch, another client, a fixture).
`App.tsx` mounts the query cache above the transport so the panel can use
it. Boundaries, enforced: the panel, the controller and their stylesheet
live in `src/dev/` and are never imported statically outside it
(`env-contract.test.ts`), production code never reads the fixture query
string, and the built bundle carries none of it (checked by grep at
release). `fixture-controller.test.ts` pins the model (a spec round-trips
through the kit parser; "hatch ready" is ready by `useHatchTasks`; nothing
opens a socket); `dev-panel.test.tsx` pins the behaviour over the real
home (a typed stat changes the same actor node; sleeping goes to bed at
once; pins override and clear; a kit refusal is shown; reset restores the
URL's world).

**Visual generation V2 (after M11).** A new Blobbi is born V2. The rule is
the kit's, not this app's: `buildEggTags` (core 0.7.0) writes
`visual_generation: v2` by default (`NEW_BLOBBI_VISUAL_GENERATION`), so
`eggTemplate` in `adoption-plan.ts` changed nothing and now produces a V2
egg (`adoption-plan.test.ts`, `adoption.test.tsx` pin it). Reading is
unchanged: an event without the tag is V1, every existing Blobbi stays what
it is, and no hatch or evolve writes or drops the tag (the kit pins that at
the hook level). The test fixtures (`src/test/fixtures.ts`) are EXISTING
Blobbis, so `blobbiEvent` builds V1 unless a test asks for `visualGeneration:
'v2'`; the dev fixture spec carries the generation explicitly.

**One gait per artwork, one shadow per world (renderer 0.5.0).** The home
says `motion="walking"` and nothing else; the renderer draws the gait the
artwork has: V1 and the baby bob as before, the V2 adult walks on its leg
groups. The home's ground shadow follows the gait by a rule on data it
already has: `BlobbiActor` carries `data-generation` from the Blobbi's
event, and `index.css` gives a walking V2 shadow a slight settle
(`actor-shadow-step`) instead of the V1 pulse, on the same cycle
(`motion-contract.test.ts`). The V2 drawings' baked ground shadow, which
made two shadows under a walking V2 adult, is off by the renderer's default
(`groundShadow: 'none'`), so the actor passes nothing and casts exactly one
shadow (`BlobbiActor.test.tsx`); the home never names a `data-part`.

**Visual generation V3: procedural Blobbis (kit core/react 0.8.0, renderer
0.6.0, consumed at kit commit `f3acbf4`, the pass that pinned what
`visual_algorithm = 1` means).** A Blobbi adopted here is born V3. V3 has no authored drawing per
Blobbi: the renderer generates each one from its identity, as an egg, a
baby and an adult, from every side. Everything about that is the kit's; this
app adds four small things, each in one place.

- **The creation rule** is one constant, `ADOPTION_VISUAL_GENERATION` in
  `adoption-plan.ts` (`'v3'`). The kit's own default
  (`NEW_BLOBBI_VISUAL_GENERATION`) is still V2, so this is this app opting
  in. `eggTemplate` hands `buildEggTags` the renderer's creation rule
  (`createBlobbiV3Identity`), and core writes the identity onto the event in
  plain, generation-independent tags: `visual_generation = v3`,
  `visual_algorithm = 1`, the colours in `base_color`, `secondary_color`,
  `eye_color` and `accent_color`, its anatomy in `antenna`, `horns`, `ears`,
  `tail`, and its surface in `pattern` (the body's one pattern: `solid`,
  `spotted`, `striped` or `gradient`), `special_mark` (`none`, `star`,
  `heart`, `sparkle` or `moon`), `belly` and `freckles`. There is no `spots`
  tag, and a V3 event carries neither `size` nor `adult_type`. The seed
  decides them at that moment and never again. Nothing here derives a seed, a colour or a trait.
  The preview the player sees IS that event, parsed.
- **The seam** is still `toBlobbiVisual`: it passes `identity.v3` through.
  For V1 and V2 the field is absent and they are handed exactly what they
  were before (`v3.test.tsx` compares the drawings byte for byte).
- **Persistence is the event's.** A V3 Blobbi is its seed (micro-geometry)
  and its stated identity (colours, trait kinds); there is no app state
  behind its appearance. The kit carries the identity through every
  republish (care, hatch, evolve), so the egg, its baby and its adult are
  one individual. On V3 the three colour tags are that identity and are never
  rewritten; on V1 and V2 the same three tags are still mirrors of the seed,
  rewritten on every republish, exactly as before (the kit decides which by
  `visual_generation`; this app never looks). An identity that states an
  algorithm version the renderer does not implement is drawn as a flagged
  stand-in, never as another version.
- **The gait.** A V3 drawing moves by its own rig, so the renderer does not
  wrap its body in the bob; the home still says only `motion="walking"`.
  The shadow follows the same way it follows V2: `motion-contract.ts` pins
  the V3 cycle (`RENDERER_V3_WALK_CYCLE_S`, verified against the kit's V3
  stylesheet), `BlobbiActor` carries `data-stage` beside `data-generation`,
  and `index.css` gives a walking V3 adult the settling shadow (it walks on
  its legs) and leaves a V3 baby the bob's (it hops).

What is still OPEN: V3 is the development default of this branch, not a
production decision. A client that predates V3 treats the three colour tags
as mirrors and would rewrite a V3 Blobbi's colours from its seed on any
republish, so every client that writes to Blobbis must understand V3 before
this app mints them for real accounts. `ADOPTION_VISUAL_GENERATION = 'v2'`
restores the previous birth exactly and never affects an existing Blobbi.

Dev tooling: `?fixture=egg-v3|baby-v3|adult-v3`, a V3 column in the quick
fixtures and the generation switch, V3 rows in the expression sheet, the V3
identity in the inspector (colours, traits, algorithm, anything missing),
and a "V3 population" sheet in the Dev Lab (`V3Sheet.tsx`) that draws,
through the renderer alone, either the kit's twelve reference Blobbis (the
identities algorithm 1 is pinned with, copied literally into
`src/dev/v3-reference.ts`: dev fixture data, nothing derived) or real seeds
for a label, as the kit's creation rule makes them, or one seed pasted from
an event. A V3 seed is canonical (64 lower-case hexadecimal digits,
`canonicalBlobbiV3Seed`): the renderer refuses anything else, so every dev
seed is a real one (`deriveBlobbiSeedV1`), never a label hashed into shape.

What keeps a V3 identity stable is the kit: creation states it once
(`buildEggTags` + `createBlobbiV3Identity`), every republish goes through
`updateBlobbiTags` and the transitions through the kit's hatch and evolve
pipelines, none of which rewrites a V3 tag from the seed, and this app
builds no kind 31124 tag list of its own. `src/__tests__/v3-identity.test.tsx`
pushes a deliberately unusual identity through every writing path here
(adoption, each care action, rest, an item, hatch, evolution, the tag repair,
a reload between each) and fails if one tag of it moves.

**The first Blobbi hatches by itself** (`src/features/lifecycle/first-blobbi.ts`,
`useFirstBlobbiHatch.ts`). A newcomer's first egg does not wait for the hatch
missions: a moment after it is on its nest, the hatch ceremony starts on its
own and the egg becomes a baby. This is an onboarding rule, not a lifecycle
or a visual one, and Ditto and the Island hold the same one (Ditto's
`decideFirstHatch`):

- **The rule reads the account, and nothing else.** An egg qualifies while
  the account owns no hatched Blobbi (no baby, no adult). No tag marks a
  "first" Blobbi and nothing is remembered on the device; the answer is
  recomputed from the kind 31124 collection every time, so it ends itself
  the moment the first egg hatches. Every later egg keeps the mission gate
  (`useHatchTasks`) exactly as before. It reads stages only: V1, V2 and V3
  eggs are treated alike.
- **Two reads, as in Ditto.** The decision comes from the collection the
  home already holds; right before the ceremony a fresh, lenient relay read
  confirms it (any kind 31124 with a `d` and a hatched stage counts, legacy
  shapes included, since the home's collection is modern-only). The read
  must have answered about the account (it holds the egg itself) and is
  retried a little; if it cannot confirm, nothing happens and the egg stays
  an egg (fail closed). A read that finds a hatched Blobbi ends the
  qualification for that egg.
- **The hatch is the kit's.** The ceremony performs `useBlobbiHatch` (the
  kit's `planHatchTransition`): the same `d`, the same seed, `stage = baby`,
  full stats, the egg's incubation and missions cleaned up, evolution
  started. Missions are a host gate in the kit, so skipping them is this
  app's decision and needs no kit change. `first-blobbi.test.tsx` compares
  the published event with the kit's own plan tag for tag, and the V3
  identity tags of the baby with the egg's.
- **Once per visit, never behind the player's back.** The automatic start
  waits for a quiet home (no item on its way, no care write out), an awake
  egg and a profile. A hatch that fails says so and is not retried by
  itself; the Hatch button stays (the panel shows "no missions needed"
  instead of the mission list), and the next visit tries again because the
  egg still qualifies.

The hatch itself (first or later) is a small story, `HatchBeat` in
`useLifecycleCeremony.ts`: the intact shell stirs, cracks appear and grow
through the renderer's four shell drawings (`eggCrack` none → light → medium
→ heavy), the last crack holds, light bursts out while the egg → baby write
is on its way, and the light clears off the baby when it landed. The rocking
and the light are the home's, on its own box around the renderer
(`gestures.ts` `hatchRock`, `.scene-actor__hatch-burst`), so they are the
same for every generation's egg and nothing was added to any artwork. Under
reduced motion nothing rocks and no light bursts: the shell still cracks
step by step, and a caption (`role="status"`) says each beat in words.

What it does NOT do: it does not set `blobbi_onboarding_done` on the
Blobbonaut profile (Ditto sets it at the end of its ceremony, and repairs it
for any account that owns a hatched Blobbi), and it has no naming or
dialogue step after the reveal (the name is asked at adoption here).

**The scene and the V3 body** (three things the home used to guess):

- **Facing.** A Blobbi that is not walking faces the viewer. The rule is in
  the locomotion model, so every way a walk ends goes through it; idle no
  longer plans a turn (it glances), and the scene controller has no `turn`.
  The Dev Lab's view buttons are the facing PIN, a presentation override.
- **Pace.** A walk covers a set amount of floor per cycle of the renderer's
  own walk animation, and the walking speed is that distance over the
  cycle, never a number chosen on its own. The table is `GAITS` in
  `motion-contract.ts`, one gait per stage and generation, and the two
  directions are calibrated separately:
  - ACROSS the room, `stride` is MEASURED on the drawing (boxes of the
    drawing per cycle). The V3 adult plants each foot for half a cycle and
    carries it 54 units back at a constant speed, twice a cycle, in a
    drawing 900 units square: 0.12 of a box per cycle, read off the kit's
    own keyframes by `motion-contract.test.ts` (the V2 adult's 28 of 238
    viewBox units likewise). The floor passes under the body exactly that
    fast, at every depth (the stride scales with `depthScale`), so a planted
    foot stays on its spot. The home used to move a Blobbi 0.28 floor widths
    a second whatever its legs did, 3.3 times its stride. Drawings with no
    legs (every baby, V1) have nothing to slide and keep the adults' pace.
    The cost is stated plainly: crossing the room takes about nine seconds
    now, not three. Going faster without sliding is the renderer's to give
    (a longer stride or a quicker cadence), not the home's to take.
  - UP AND DOWN the floor, `depth` is how it looks (floor depths per
    cycle): the feet step in place there and nothing is planted. 0.21 per
    cycle for V3 (about a third of the floor's depth a second), a fifth
    quicker than the first calibration and well under half the on-screen
    speed of the original, which slid.
  A diagonal takes as long as its two components together demand
  (`walkSeconds`). `SceneSettings.walkSpeed` is an OVERRIDE for tests and
  harnesses; it has no default, because a default silently replaced every
  gait (it did, once).
- **Shadow.** The renderer measures its own drawing
  (`describeBlobbiArtwork(...).boxAnchors`: the ground line and the
  footprint), and `BlobbiActor` puts the home's shadow there (`shadowFor`):
  under an adult's feet, small under a floating baby, each individual's own
  width. The stylesheet's fixed shadow (set by eye for older artwork) sat a
  tenth of the box below a V3 adult's feet and was wider than a V3 baby; it
  still serves V1 and V2, whose artwork carries no measured footprint.

Dev tooling: fixture worlds state the account's history, because that is
what the rule reads. Every stage fixture is an **established** account by
default (an older adult is in the world), so eggs can be looked at at rest;
`&account=first` or the panel's account switch removes it, and a fixture egg
then hatches by itself. `?fixture=fresh` is an account with nothing in it:
the real adoption flow, then the automatic hatch; what the app publishes
there is kept for the tab (session storage), so a reload finds the baby the
way a reload of the real app finds it on the relays.

**Consuming an unpublished kit.** As with core/react 0.7.0 and renderer
0.5.0 before it, this app depends on kit versions that are committed in
blobbi-kit but not yet on the registry. The method is the one already in
use: `npm pack` the three kit packages from the kit checkout, `npm cache
add` the tarballs, and record in `package.json` the semver range and in
`package-lock.json` the registry URL with THE PACKED TARBALL'S integrity.
`npm install` then resolves from the local cache by integrity, with no
`file:` path and no sibling checkout in the manifest; once the same build is
published, nothing here changes. Until then a clean machine cannot `npm ci`
this branch, and a re-pack of a changed kit means a new integrity in the
lockfile.

**The Dev Lab (`/dev`).** The same fixture infrastructure as the panel (the
controller, the in-memory pool, Set versus Perform, presets, pins, reset),
composed as an engineering page: `App.tsx` treats `/dev` as fixture mode
under the same lazy dev gate and hands `AppRouter` a `devLab` element that
is `null` (and so Not Found) everywhere else; `DevFixture` shares the
controller through `FixtureControllerContext` and mounts the floating panel
only when no page provides its own surface. `DevLab.tsx` lays out the
shared control sections (`sections.tsx`, hooks in `dev-home.ts`) beside the
real `<Home />`. Three production-side seams serve it, none a dev branch:
`SceneSettings` gained `gaze` and `motion` pins next to the existing face
and facing pins, and an `onController` callback through which
`useBlobbiPresentation` hands its scene controller (now also exposing
`destination`) to whoever provides the settings; the movement
lab drives that controller, the debug overlay portals into the real room
canvas (`data-testid="room-canvas"`) and draws in its percentage
coordinates, the expression lab is isolated renderer previews with the
fixture's seed, and the sound lab plays the voice's recipes through the
same `useSound`. Safety: `env-contract.test.ts` pins the lazy gate and the
router's ignorance of `src/dev`, `dev-lab.test.tsx` pins that `/dev` is Not
Found without a lab and that nothing opens a socket, and the built bundle
carries none of it (grep at release).

**Production configuration.** The app reads exactly two build variables
(`VITE_BLOBBI_ISLAND_URL`, validated to an absolute `http(s)` URL with
`https://island.blobbi.pet` as the default, the origin Island's own tests
name; `VITE_BLOBBI_DEV_TOOLS`, dev builds only). Every dev switch is gated
on `import.meta.env.DEV` on the same line; the fixture world is a lazy
import behind that gate; the production bundle carries neither. The build
copies `index.html` to `404.html` for SPA hosting. `.env.local` is
git-ignored (`*.local`). `env-contract.test.ts` enforces the contract.

**Not in this milestone.** Themes, the room editor, a relay data manager,
minigames, shops, currencies, picture frames, dialogue, new event kinds.

**A finding from the dev panel, not changed.** The kit's `useBlobbiEvolve`
writes neither `visual_generation` nor `adult_type`: `updateBlobbiTags`
carries the baby's managed tags over and the repair pass only recovers
required or previously present ones. An egg born here (`eggTemplate` →
`buildEggTags`) carries no `visual_generation`, which core parses as `v1`,
so a Blobbi born and evolved in this app is an **Adult V1**; only a state
event that already says `v2` (another producer's) evolves into a V2 adult.
The adult *form* is not a tag decision at all: `parseModernBlobbiEvent`
derives `adultType` from the seed whenever a seed is present.

## Milestone 12: one home, care intents, the way in (M10)

A product simplification over the M9 engineering, plus the way in. The
active product is ONE Blobbi space; the way in is WELCOME → CREATE or USE
AN ACCOUNT → PROFILE → ADOPT → home.

**One space** (`src/features/home/space/home-space.ts`): the living room
from the M9 registry (its surfaces, decor and door, four fixed pieces)
drawn by `RoomBackdrop` and `FurnitureLayer`. No room navigation, no
editor, no paintbrush, no hotbar, no desktop rail. The rest of the M9
room system is dormant, not deleted: `src/features/home/rooms/README.md`
says what is still imported (backdrop, furniture layer, `approachSpot`,
surfaces, `roomById`, the `Placement` type) and what is asleep (registry
order, navigation, layout store and editor, drag engine, placed toys);
`rooms/dormant.css` holds their styles, not imported; unit tests keep them
working (`rooms.test.ts`, `layout-edit.test.ts`, `room-space.test.ts`).
Desktop is the same column, capped at 40rem and centred over a soft
background, not a wider room.

**Care intents** (`src/features/home/care-model.ts`): the bottom row is
FEED / PLAY / CLEAN / REST with the bag BESIDE them. A verb is an intent:
tapping it opens a strip right above the row (`shell/CareOptions.tsx`)
with the owned items that answer it (from the verified inventory read,
mapped by care action: feed and boost → Feed, play → Play, clean and
medicine → Clean; cosmetics never) and one plain way that needs nothing,
so a player with an empty inventory can always care. Every option ends in
an existing path: an item option in the M4 optimistic use (spend + care,
`MIN_USE_MS` floor, refusal changes nothing), a plain option in the kit's
care effect. Rest is one tap: the bed (`home:bed-pet`) comes out at a
fixed spot, the Blobbi walks to it and sleep is written only on arrival;
the bed stays while it sleeps and leaves a moment after waking. Clean's
plain way brings the tub out the same way. Food is set down at the offer
spot, a toy at the toy spot; both leave after use. A floor tap on the way
cancels: nothing written, the piece goes away. A failed write puts the
piece away too. A sleeper opens the home in its bed.

**Feedback**: the HUD chip carries one condition dot per stat with the
kit's status (`getStatStatus`: normal, warning, critical), no numbers; the
exact numbers, XP, level, lifecycle, other Blobbis and the Island link are
in the sheets. A need becoming critical is said once in the Blobbi's
words (`needLine`). The streak is never computed here: the home reads
`care_streak` from the authoritative event and only animates when it went
UP between two versions of the same Blobbi (`streak.ts`,
`detectStreakIncrease`); the pill bumps and the Blobbi says a line; the
milestone days (3, 7, 14, 30, 60, 100, 365) get a card
(`StreakMoment.tsx`). A page load never celebrates; the kit's rule (a new
local day, yesterday cared for → +1, else reset to 1, same day → no
change) is untouched.

**The way in** (`src/features/onboarding/`): `resolveOnboardingStep` is
pure over what is read (login store, collection) and one session fact (the
door chosen, `OnboardingSession`, held by the page so it survives the read
that follows signing in: M12.3 found that a flow holding it itself was
unmounted during that read and started again), so a refresh in the middle
lands on the same step and an existing player with a Blobbi never sees any
of it. Creating an account: nostr-tools `generateSecretKey` + `nip19`
(what Ditto's and Island's signup call), then nostrify `NLogin.fromNsec`
into the `NostrLoginProvider` store both apps share (`nostr:login`; no new
storage here). The key is given as a scene (`KeyScene.tsx`, M12.3) with
four plain facts before any action (it IS the account; whoever has it gets
in; losing it can mean losing the Blobbi; no recovery), no npub, copied or
downloaded as Island's `blobbi-nostr-key-backup-<npub8>.txt` through a
revoked object URL (never a `data:` URL), and a deliberate "I saved my
secret key somewhere safe." gate, shown once a way to keep it was chosen,
stands before sign-in; a download is reported as asked, never done. Never
logged, never in a relay payload, never in a URL; the menu can show it
again for a backup, hidden until asked. Existing accounts: NIP-07
extension and NIP-46 bunker first, a secret key (pasted or the backup
file) behind a fold. The profile (the menu's Account, `ProfileForm`)
publishes a standard kind 0, only on Save, that keeps every existing field
(fresh read, `mergeProfileMetadata`), signed by the current signer, with
an optional Blossom upload to Ditto's application servers
(`config/blossom.ts`). It is never asked for on the way in, and nothing is
published for skipping it. Adoption is the M6 flow unchanged (preflight,
idempotency); the profile name is suggested for the Blobbonaut profile.
`onboarding.test.tsx` runs the whole way in with the real login store and
real signing and asserts the secret never reaches a relay payload, a
query, the URL or the console.

**M10.1 polish.** The default room is wall, floor, window, door and the
Blobbi: `HOME_SPACE.furniture` is empty (it had copied the registry's
living-room defaults), and the home never reads the M9 layout, room or
toy stores, which `home-composition.test.tsx` proves by seeding them. The
door is a wall fixture (`wall: true`, floor point `y: 0`, no depth scale,
z below the floor range) so its bottom meets the horizon at every
viewport; the bed is scaled (`scale: 1.7`) with its use spot on the
cushion (`dy: -0.22`, `renderOrder: -40` so the sleeper is drawn in front
of the back rim), the tub's use spot is inside it. The care chooser is
positioned (`absolute; bottom: 100%` of the dock), so opening it never
resizes the scene. The shadow follows the renderer's walk through a
verified contract (`scene/motion-contract.ts`: the cycle pinned against
the kit's exported stylesheet by a test, the phase from
`blobbiMotionPhase`); the body gets no transform from the home; the kit
did not change. Sheets are gone: `GameOverlay` is the one primitive (full
viewport on a phone, a centred bounded panel above 600px, fixed header,
scrolling body, focus trapped and restored, Escape and backdrop close,
reduced motion), and the inventory (shelves derived from the care action
and the definition's `category`, a responsive grid), the menu (a few
large controls) and the Blobbi's details are built on it.
`css-contract.test.ts` pins the layout rules jsdom cannot see. A dev-only
`?preview=bed|tub` (behind `VITE_BLOBBI_DEV_TOOLS`) shows the composition
without a write.

**M10.2 polish.** Overlays are layers of the game, not modals: `GameShell`
renders them inside the game column, so `GameOverlay` rises from the
bottom of the game surface (the viewport on a phone, the rounded column on
a desktop) with a rounded top, a handle, a dimmed but visible world above,
and a `size` per screen (`tall` for the inventory, `medium` for the menu
and the details). The inventory tiles carry the artwork, a count pill and
a clear selected state. The window hangs by canvas fractions
(`WINDOW_DECOR`, pinned by a test) with a light no wider than itself. The
second ground circle under the Blobbi (`.scene-actor__ground`, the M3
environment's `groundGlow` token from the M1 hero's "patch of light") is
gone; the walking shadow is the one ground effect. Pokes are a
standalone-owned policy (`personality.ts`, `pokeReaction`: stage, state,
condition, patience) applied by the presentation layer as a face and a
body gesture (`gestures.ts`, Web Animations on the actor's own box, never
the renderer's root) under the behaviour mode's `pokes` policy: an egg
wiggles, a sleeper stirs, a walk shows a face only (the renderer owns the
body while walking), a well Blobbi bounces, a hungry or hurt one recoils
upset, a tired one is sleepy, too many pokes annoy. No write, no kit
change; `poke.test.tsx` covers it. An egg lives on the nest: the same
bed placed at the room's centre (`STAGE_OBJECTS.nest`), always out while
the stage is `egg`, the egg on its use spot, never wandering (the
`nested` mode); Rest for an egg performs where it lies. In bed (an egg on
the nest, a sleeper in the bed) the actor renders no shadow of its own.
Nothing about it is written: the nest is derived from the stage.

**Themes: prepared, not started.** The ecosystem's theme representation
is Ditto's, re-implemented by Island (`ditto/src/lib/themeEvent.ts`,
`blobbi-island/src/lib/nostr-theme.ts`): kind 36767 (addressable, a named
shareable theme definition, many per user) and kind 16767 (replaceable,
the active theme, one per user, `a` tag to the definition when there is
one); colours as `c` tags `[c, <hex>, <role>]` with roles background /
text / primary; fonts as `f` tags with a body/title role; backgrounds and
titles in further tags. Nothing of this is implemented here. What the
theme milestone needs from this app: the home already paints from tokens
(`--wall`, `--floor`, `--sky` and the room surfaces from data), the menu
already owns "how the home looks" (the Island clock appearances), and the
scene never reads theme state from Nostr. A future theme feature would be
a read of 16767/36767 through the existing pool (read hints, trust as
data), a mapping from the three colour roles to the home's tokens, and no
new event kind. No theme format is invented here.

**Tests**: `care-intent.test.tsx` (single home, no navigation or editor,
verbs and options, no-inventory fallback, rest → bed → sleep, cancel, tub,
egg, optimistic vs authoritative, toy, bag), `streak-hud.test.tsx`,
`onboarding.test.tsx`, unit tests for the care model, streak, key helpers,
step resolver, profile merge and the dormant layout ops; the care,
lifecycle, scene, protocol-boundary and render-cost suites adapted to the
two-tap model (`src/test/care-ui.ts`).

## Milestone 11: rooms after the Ditto audit (M9)

A room system that can carry an editor, built after a read-only audit of
Ditto's current implementation (`src/blobbi/rooms/**` at 89aaa5d8).
Reused conceptually: normalized coordinates over a 4:5 canvas with a
declared floor line, sizes as fractions of canvas width, layer bands
back/floor/front, Ditto's placement shape `{ id, x, y, layer, scale?, flip? }`
with namespaced ids, its surface schema (style, hex palette, variant,
angle, generated CSS only), its furniture catalog and 39 SVGs (authored
for this project), its room set and circular order. Corrected: Ditto's
canvas is width-driven and squashes on desktop, has no floor model, and
gives the Blobbi no coordinates.

**The space** (`src/features/home/space/room-space.ts`): a `RoomPoint` is
a fraction of a fixed 4:5 canvas; `FLOOR_LINE` 0.72; a `FloorPoint` (the
walking space) is depth within the floor band; `fitCanvas` is the one
transform to a screen (contain, bottom-centred; extra viewport space is
bleed the backdrop paints with the horizon fixed). `clampPlacement` keeps
an object legal with its extent in room units. CSS mirrors the constants
in container units (`--room-aspect`, `--floor-line`; a test pins them).

**The registry** (`src/features/home/rooms/`): five rooms as data (care
room, kitchen, living room, bedroom, closet; wrapping order), each with
surfaces, decor, fixtures, default furniture, an entry, activities (the
hotbar filter) and copy. Furniture definitions carry sizes, layers, rooms,
shadows and, for a bed or the tub, a `use` with an approach offset; the
sleep spot is derived from the bed's placement. Layouts go through a
`LayoutStore` (local storage today, Ditto's v1 shape; Ditto keeps its own
in the kind 11125 content, which is its private extension schema, so it
is neither read nor written here). Every placement is re-validated on
read: unknown id, wrong room → dropped; wrong layer → default; scale
bounded; anchor clamped with extent.

**Decorating**: a paintbrush by the room pill; the dock becomes a toolbar
(add from a per-room catalog, layer, scale, flip, remove, reset, cancel
with confirmation, apply-if-dirty); select by tap; move by one drag engine
(pointer capture, ref-based, one paint per frame, slop, Escape), by arrow
keys, or by a nudge pad. The Blobbi stands and watches (`editing` mode).

**Inventory in the world**: rooms filter the hotbar by activity; the
closet lists what can be worn and marks what is worn (kind 31634), never
a give. Picking an item is acknowledged before any write; a use stays
visible `MIN_USE_MS` and settles on the authoritative result; a refused
spend changes nothing. A held toy tapped onto the floor is set down (a
local placement, no spend) and drawn only while the verified inventory
holds one; playing with it is the item use path from where it lies. The
verbs route to the room: rest to the bed, clean to the tub, play to a toy
lying here, feed to the food in hand, otherwise the kit's plain care.
Four quick pokes earn an upset face; a room that answers a need gets one
line on entry.

**Protocol boundary**: rooms, positions, gaze, decorating, toy placement,
the item in hand and reactions never write or read Nostr
(`protocol-boundary.test.tsx`); care writes 31124 + 1124; an item use
writes 1416 + 31124 + 1124. No new event kind.

**Performance**: the furniture layer, backdrop, dock and rail are
memoized and the presentation controller's callbacks are stable across
walk frames, so a walk re-renders the actor only (`render-cost.test.tsx`);
gaze updates once per frame, not once per pointer move.

## Milestone 10: the game shell (M8)

A gameplay layer over systems that already work. Nothing about the
protocol, the inventory pipeline, trust, equipment, adoption, relays or the
renderer changed; what changed is how the player reaches them.

**The audit.** Ditto's `/blobbi` page keeps a single focused item docked
under the thumb, treats rooms as verb filters over a fixed-aspect canvas,
and reacts before the network answers; it has no inventory (items are a
free catalog) and no walking. The pre-rebuild standalone had no rooms (the
page was the room), a 4–6 tap item flow, and a few ideas worth keeping
(sleep by arriving at the bed, toys that stay, a written voice). The
standalone before this pass needed three taps and a walk to use an item,
crammed five dock buttons edge to edge at 360px, and drew the Blobbi at a
third of the width against an empty wall.

**Rooms** (`src/features/home/rooms/`): three on a line, garden ← living
room → bedroom, defined as data (`rooms.ts`: furniture, entry spot, sleep
spot, which consumables the hotbar shows). Device-local per player and
Blobbi (`useRoom`, `blobbi:home:room:v1:<pubkey>:<d>`); never published;
never part of the Blobbi's identity or 31124 state. Moving is a chevron,
a dot, or a swipe on the scene (`HomeScene.onSwipe`; the trailing click
is swallowed so a swipe never walks, sleeps or pokes). Coming into a room
places the Blobbi at the entry (`locomotion.placeAt`, no walk; a pending
walk resolves `stopped`). A sleeper is always in the bedroom, in the bed;
rest from any room enters the bedroom first and walks to the bed. The
garden is the Island sky, hills, a fence and grass, from the same phase
tokens (`grass`, `grassEdge`, `hill` per phase).

**The hotbar** (`shell/ItemHotbar.tsx`): the room's usable consumables
from the same read as the sheet (`useHomeInventory`), one tile each with
artwork and quantity, the bag first (the sheet keeps every item, details
and refresh). Cosmetics, currency and unknown items never enter it. Using
is two deliberate taps: pick a tile (the item is "in hand", the tile
lifts, the dock says "Tap Brook to give the Apple", the Blobbi gets an
invite ring and its tap becomes Give), then tap the Blobbi or the tile
again. Giving is the unchanged M4 offer flow (set down, walk, spend, care
write through `useUseItem`). A floor tap or a room change puts it back;
nothing is written until it is given.

**The shell** (`shell/GameShell.tsx`): a column of top HUD, scene and
dock, plus a rail on wide screens (`useWideScreen`, the 900px CSS
breakpoint) with condition, progression, rooms and the Island link. The
dock is in the flow at the front edge of the floor (its background
continues the floor, grass in the garden), so it never covers the Blobbi:
lifecycle pill, hotbar, then the four care verbs as a compact row. The
Blobbi is 44% of the scene width (9.5–17rem). Room dots keep a 28px hit
area. Verified in the browser at 360, 390, 600 and 1456px, by day and by
night.

**Deliberately not built:** persisted per-room hotbar focus, drag-to-mouth,
minigames, furniture placement, toys that stay in the room, a camera, a
relay manager (proposal kept local), a component library.

## Relays: transport and trust (audited 2026-09-24)

The home reads three kinds of relay knowledge and configures only one:

| Tier | What | Where | Used for |
| --- | --- | --- | --- |
| Application relays | `BASE_RELAYS` (ditto, primal, nostr.band) | `src/config/relays.ts` | every read; the ONLY publish targets |
| Ecosystem read hints | where Island and the Farm write inventories, spends, folds, equipment | `src/features/inventory/relay-hints.ts` | kinds 31633 / 1416 / 1417 / 31634 |
| Issuer relays | where each trusted issuer's definitions live | `TrustedIssuer.relays` (`issuers.ts`) | kind 31632 requests naming that issuer |

The pool (`src/lib/home-pool.ts`) has two routers that share nothing.
Reads go through `routeReadFilters` (`src/lib/relay-routing.ts`, pure): every
filter to every application relay, and a filter a hint covers (same kind,
and the hint's author when it names one) to the hint's relays as well, only
that filter. Writes go to the application relays. A hint can therefore never
become a publish target, and the kit's own reads (31124, 11125) stay on the
application relays. URLs are normalized (`wss:` only, no credentials, host
lower-cased, no trailing slash) and deduplicated before they reach a socket;
a malformed entry vanishes at policy build time; `MAX_RELAYS_PER_READ` caps a
read at eight relays with application relays never dropped. There is no
relay UI, no NIP-65, no crawler, no event-carried relay hints followed.

Failure is nostrify's: `NPool.query` waits for the first relay to finish,
gives the rest one second, then returns what arrived. An offline, hanging or
slow hint costs its own answer and nothing else (`relays.test.tsx`).

Trust does not move. A relay being asked says nothing about its answers:
`NRelay1` verifies every signature; the issuer table, the address ↔ issuer
check, the owner check on 31633/31634, the fold chain, the spend ledger and
the artwork allow-list all run after transport, the same for a hinted relay
as for an application relay. `relays.test.tsx` serves a look-alike
definition from the issuer relay and pins that it is never believed.

Why it was needed: `TrustedIssuer.relays` existed since M4 but nothing read
it, so ecosystem discovery rested on relay.ditto.pub happening to be an
application relay. Live on the audit day: ditto served every ecosystem kind;
primal served none of them (a caching relay that does not index these
kinds, although the Farm names it as its hint); dreamith served the official
definitions and one Island inventory; nostr.band refused every connection.

## Ecosystem canon (audited 2026-09-23)

What the live ecosystem actually does, checked in the Ditto checkout
(`feat/blobbi-canonical-renderer`), Blobbi Island (`b1a70c3`),
`@nostr-games/inventory` 0.5.0 and blobbi-kit `main`. The standalone follows
this, not its own history.

- **Lifecycle tags (kind 31124).** `stage` egg | baby | adult; `state`
  active | sleeping | hibernating; `progression_state` none | incubating |
  evolving with `progression_started_at`; `seed` is stable for life and the
  six trait tags plus `adult_type` are re-derived from it on every republish
  by the kit's `updateBlobbiTags`. Mission progress is NOT in `task` tags: it
  lives in the event `content` JSON as `evolution[]` (kit `missions`).
  `incubation_time` / `start_incubation` are legacy markers; an event carrying
  them is dropped from collections. Time plays no part in hatching.
- **Hatch gate.** The kit's `HATCH_MISSIONS`: a theme (kind 36767, authored
  in Ditto), a colour moment (kind 3367, espy) and 7 care interactions
  (tallied by the host into `content.evolution`). Evolve: 3 themes, 3 colour
  moments, 21 interactions, a profile edit (kind 0 or 16769) and all stats
  at 80 or more. Two of the three hatch missions are completed outside the
  standalone; the panel links to them.
- **Transitions.** Start/stop incubation and evolution, and baby → adult, are
  kit hooks. Egg → baby was Ditto-local until this milestone; it is now the
  kit's `useBlobbiHatch` (react 0.6.1), the same tags Ditto publishes: stats
  to 100, streak, egg tags cleaned, `evolving` with fresh missions, content
  reset, same `d`, same `seed`.
- **Adoption.** Ditto creates eggs (`buildEggTags` semantics, born
  incubating); Island creates babies directly. Neither writes
  `visual_generation`, so new Blobbis are V1.
- **Visual identity.** `getBlobbiVisualIdentity` (core 0.6): stage,
  generation, adult form, colours, pattern, mark, size. The creature `theme`
  tag exists only for the Divine crossover; Island ignores it.
- **Environments and themes.** There is NO shared environment registry.
  Island's places are Island-local art keyed by `LocationId` (its explicit
  home is `home` "Cozy Home", the only room with a bed); Ditto's rooms are
  CSS rooms (home, kitchen, care, rest, closet). Kind 36767 is a Ditto UI
  theme, not a creature or environment theme. Island has two UI palettes
  (`cozy-day`, `lantern-night`) and a shared 2-hour day/night clock. The
  standalone's five themes (Cozy, Forest, Beach, Garden, Space) are its own
  invention from old Polaroid backdrops and are NOT ecosystem canon.
- **Inventory and equipment.** `@nostr-games/inventory`: 31632 definitions
  (official issuer `9efb8d30…63a9` on relay.ditto.pub + relay.dreamith.to;
  Farm `f47aaf2e…9fb4` on relay.primal.net + relay.ditto.pub), 31633
  inventories (Island `blobbi:island`, Farm `farm:main`), 31634 placements
  (Island `blobbi-island:character:<d>:equipment`, slots headwear, eyewear,
  back, neckwear, handheld, face-mark, aura, color-overlay), 1416 spends and
  1417 folds. Effects for Blobbi items live in `content.effects["game:blobbi"]`.
  A foreign writer never rewrites a 31633; it spends (1416) and marks the
  31124 with `blobbi_op`. Ditto has no inventory at all.
- **Interactions.** Kind 1124 with `action` feed | play | clean | medicate |
  boost (no `pet`), `source` per app, optional `item`.
- **Links.** Standalone → Island is a plain URL; Island has no link back;
  Island ignores URL parameters; identity travels through the signer.

## Milestone 9: release hardening (M7)

An audit pass, no new features. Findings and what changed:

- **Security.** Lifecycle task links: `external_link` targets render only as
  absolute http(s) URLs and `navigate` targets only as root-relative Ditto
  routes (`taskLink`, tested). Every `target="_blank"` carries
  `rel="noopener noreferrer"`. No `dangerouslySetInnerHTML`, no
  `window.open`, no remote markup anywhere; item artwork stays behind the
  M4 allow-list; the renderer's bundled SVG is untouched.
- **Nostr boundary.** Confirmed by the suites: coordinates, gaze, facing,
  temporary expressions, idle decisions, animation state, the environment,
  sounds, sheets, offers and the use ledger never appear in a published
  event (`scene.test.tsx` zero-publish, `care.test.tsx` identical markup
  day/night, `ecosystem.test.tsx` zero-publish for equipment).
- **Accessibility.** Scripted audit over the room, both sheets and the
  night look at 390 px: every control has an accessible name, focus order
  is chip → menu → floor → door → bed → poke → dock → items; two touch
  targets were under 44 px (the items refresh button, the lifecycle
  start/stop buttons) and now are not. Dock label contrast: 7.2:1 by day;
  light on dark by night.
- **Responsive.** Tall first-run cards scroll on short phones; 320/390/430
  and desktop re-checked during M4–M6.
- **Performance.** rAF pauses in hidden tabs by itself; idle and clock
  timers are cleaned on unmount (tested); reads are queries with stale
  times, no subscriptions. The single 910 kB bundle is now four chunks
  (app 127 kB, react 204 kB, nostr 236 kB, blobbi 346 kB) so a deploy
  invalidates only what changed.
- **Dead code.** Two empty directories removed; no orphan modules.
- **Kit.** Nothing in blobbi-kit was removed.

## Milestone 8: first run and adoption (M6)

A newcomer understands, adopts an egg, and sees it in the room, without
leaving the home. `src/features/adoption/`:

```
adoption-plan.ts   pure: newEggPreview (generatePetId10 → getCanonicalBlobbiD → deriveBlobbiSeedV1),
                   eggTemplate (buildEggTags + progression_state incubating + progression_started_at +
                   createHatchMissions() in the content; created_at PINNED to the preview),
                   profileTemplate (buildBlobbonautTags + name for a new profile; otherwise the FRESH
                   profile's full tags through updateBlobbonautTags with has merged and current_companion),
                   normalizeBlobbiName, isOwnedBlobbiEvent (lenient: any 31124 with d + stage)
useAdoptEgg.ts     preflight (fresh 31124 by author, lenient) → fresh 11125 → publish the egg →
                   exactly one profile write → device pick, caches, refetch
AdoptionFlow.tsx   intro (three lines: what a Blobbi is) → the egg (renderer preview, name) → Adopt
```

Canon followed: Ditto's egg (incubating from the first event) and Island's
order (egg first, one profile write). Ownership is the 31124 collection,
never the profile, as both apps hold: a profile write that fails leaves a
real egg that any later selection repairs; a Blobbi found by the preflight
(another device adopted meanwhile) is brought home and nothing is minted.
The preview is generated once and is the source of truth for what is
published; the seed depends on `created_at`, so the template pins it.
The signed-out home carries the same three lines. `adoption.test.tsx` pins
the events, their order, the profile preservation, the preflight, both
failure modes and the keyboard path.

## Milestone 7: ecosystem cohesion (M5)

**The Island, from the room.** Leaving for the Island is the door (walk to
it, a real link appears there) and, for keyboards and screen readers, the
menu entry. Island stays a separate app; nothing of it is embedded.

**What the Island dressed, the home draws.** `useWornEquipment` reads the
kind 31634 document the player authored that targets this Blobbi
(`31124:<owner>:<d>`, so any game's naming works) and `resolveWornEquipment`
applies Island's own gates before anything reaches the renderer: author is
the owner, mode `equip`, official issuer by FULL address, definition known,
the issuer's declared `visual.slot` equals the entry's slot, owned (quantity
≥ 1 in the resolved balances), `visual.forms` includes the stage, 2D-percent
frame, last entry wins a slot. Wearables become `AccessoryPlacementInput`s
(artwork per facing from the definition's marked images, allow-listed) and
visual-effect items (`visual.kind = blobbi-effect`) become renderer effects
when their id and slot are the renderer's. Read-only: equipping stays on
the Island; the sheet marks worn cosmetics "Worn". Eggs wear nothing.

**Foreign inventories.** Farm produce is food at home (M4); Farm was not
touched. Every foreign inventory is spend-only.

**Many Blobbis.** The selector lives in the Blobbi sheet. `BlobbiOverview`
keys the whole home on the Blobbi's `d`, so a switch unmounts everything
scene-local (position, walks, gaze, reactions, speech, ceremony, an offered
item, the open sheets) and the newcomer starts at home, idle, neutral.
`ecosystem.test.tsx` pins it, including that an abandoned offer wrote
nothing.

## Milestone 6: items, inventory and world interactions (M4)

The player's items come from real Nostr state through `@nostr-games/inventory`
0.5.0 (the ecosystem's inventory protocol; no parallel format), in
`src/features/inventory/`:

```
issuers.ts          trust: an issuer-pubkey table (official Blobbi issuer; Nostr Farm as partner)
sources.ts          a 31633 `d` → a label ("Blobbi Island", "Nostr Farm"); the home writes no inventory
item-model.ts       policy over a 31632: official items read effects["game:blobbi"] + metadata.action/stages;
                    partner raw produce is food by home policy (+25 hunger); anything else is unknown;
                    image URLs only https on an allow-list, else the emoji, else a category glyph
inventory-state.ts  balances = resolveGameInventoryState(snapshot, folds, spends) (+ this device's spends);
                    an unresolved fold chain means NO balance: shown, never usable
spend-ledger.ts     the device-local record of a use in flight (signed → established → applied)
item-use-plan.ts    the care effect through the kit's consolidation with the item's effects;
                    `['blobbi_op', spendId]` on the 31124; a 1124 receipt with `['e', spendId, '', 'inventory-spend']`
useHomeInventory    read-only: 31633/1416/1417 by author, 31632 per trusted issuer; grouped by source
useUseItem          the one write path (below)
InventorySheet      tiles per source, one detail row: what, how many, from where, usable now?
```

**Consistency model (documented; non-atomic by nature).** The home owns no
inventory, so it is a foreign writer everywhere: never a 31633 rewrite,
never a 1417 fold, exactly one kind 1416 per use. Order: fresh 31124 and
fresh balance → sign the spend once → write the ledger row → offer the
bytes → *established* (a relay accepted, or the id is found) | *unconfirmed*
(silent relays: stop, retry the SAME event) | refused (row dropped, safe to
sign anew) → fresh 31124; if it already carries `blobbi_op = spendId` the
effect landed; else republish with the marker → on failure *effect-pending*
(stop; the next tap for this Blobbi finishes it first). Residuals: "spent,
effect pending" is never silent (the sheet says "Finish earlier use"); a
spend may later be voided by the owner's fold if another device took the
last unit. Island's `useConsumeExternalItem` follows the same shape.

**The world.** A care item is not a button: it is set down in the room
(`offeredItemObject`, one more `SceneObjectDef` of kind `item`), the Blobbi
walks to it, and only on arrival does the semantic use start. A tap
elsewhere while walking puts it away (nothing written). An egg cannot walk,
so it uses the item where it lies. Failure leaves the item with "Try again"
and "Put away". The dock stays as the fallback for plain care (kit fallback
effects, no item, no spend); the bag button opens the sheet with a count of
what this Blobbi could use now. Equipment/placement (31634) is read-only for
now: cosmetics say "Equip on the Island".

## Milestone 5: the home as a game screen (M3)

The page became one screen. `GameShell` is a `100dvh` frame with the room
filling everything between two thin HUD strips (`HudTop`: the Blobbi's chip
and the menu; `ActionBar`: the care dock and, when the kit says a lifecycle
moment is ready, one pill). Details live in two sheets (`Sheet`: a bottom
drawer on phones, a side panel on wide screens; labelled modal, focus
kept inside, Escape and backdrop close): `BlobbiSheet` (badges, rings,
progression, lifecycle missions, other Blobbis) and `MenuSheet` (home
lighting, sound, the Island, the account). Nothing scrolls; nothing covers
the Blobbi.

Principles (from the virtual-pet research): the pet and its room are the
screen; needs are said by the pet (`NeedBubbles`, worst two, above its
head) not by a panel; primary actions sit under the thumb; everything else
is one tap away in a sheet; settings and account are not gameplay.

The room (`SceneBackdrop`) is layers lit by CSS custom properties: wall,
window onto the Island sky with stars, a lamp at night, floor and rug.
Objects are a small registry (`objects.ts`: definition, floor point,
approach spot) drawn by `SceneObjectView`; the door to the Island is the
world affordance for leaving (walk to it, then a real link appears at the
door), the bed is rest. Speech (`SpeechBubble`) and hearts carry care
moments; four recovered sounds play only if turned on (`SoundProvider`,
device-local, never blocking).

**Environment, not themes.** The five standalone themes were not ecosystem
canon and are gone. The home is one place lit by the Island's shared clock
(`src/environment/island-clock.ts`, a port of Island's: two real hours per
island day from a fixed UTC epoch, phases dawn 0–10, day 10–75, sunset
75–90, night 90–120). `PHASE_LOOKS` holds the tokens per phase; an
appearance preference (`island` | `day` | `night`, device-local) can lock a
phase. The rule stands: the environment never touches the Blobbi
(`care.test.tsx` pins identical markup under day and night), and
`BlobbiVisualIdentity.theme` is never read.

## Milestone 4: the lifecycle (M2)

Egg → baby → adult for an existing Blobbi, on the kit's own primitives, in
`src/features/lifecycle/`:

```
useLifecycle          wires useHatchTasks / useEvolveTasks (the gates),
                      useStartIncubation / useStopIncubation / useStartEvolution / useStopEvolution,
                      useBlobbiHatch (react 0.6.1) / useBlobbiEvolve, through the app's PublishAdapter
                      and the kit's fresh-read step; folds them into one LifecycleView
lifecycle-view.ts     pure: stage + process + kit tasks → next action, progress, egg crack
mission-tally.ts      the "care N times" tally: hydrate the kit store from the event, +1, and
                      serialize into the SAME care republish (care-plan `evolution` option)
useLifecycleCeremony  building (3 beats) → publishing (the one semantic write) → revealing | failed
first-blobbi.ts       pure: an egg is the account's first Blobbi while the account owns no hatched one
useFirstBlobbiHatch   that decision over the home's collection + the relay read that confirms it
LifecyclePanel        the missions as the kit reports them, links to Ditto/espy, Hatch / Evolve
```

Behaviour modes gained `ceremony` (exclusive: no walks, taps, idle, gaze or
reactions; body still) and `nested` (an egg: stands where it is, no taps),
resolved `ceremony > sleeping > nested > user-walk > free`. Rest on an egg
publishes directly, since an egg cannot walk to the bed.

Eggs draw as eggs: renderer 0.3.0's egg artwork with `eggCrack` from the
mission progress (`eggCrackForProgress`), and the ceremony overrides it beat
by beat under a warm glow (`solar-radiance`); evolution gathers a
`celestial-aura`; every reveal sparkles. A failed publish returns the scene
to what it was and shows the error; nothing ever pretends a stage changed.

Dev-only: `VITE_BLOBBI_DEV_TOOLS=true` under `npm run dev` adds "Force
hatch/evolve" buttons that run the same ceremony without the mission gate.
Production builds never read the flag.

The kit is consumed from `vendor/blobbi-kit/*.tgz` until core/react 0.6.1
and renderer 0.3.0 are published (see the chore commit).

## Milestone 3: the scene and the behaviour layer

The Blobbi no longer sits centred on a backdrop; it stands somewhere on a
floor, walks where you tap, looks at you, reacts on its face and sleeps in
its bed. All of that is **application behaviour**; the renderer only ever
receives the resulting words. Built on `@blobbi-kit/renderer` 0.2.0
(`facing`, `eyeOffset`, `expression`, `motion`, `isSleeping`) and core/react
0.6.0.

### Layers (`src/features/home/scene/`)

```
sky + far environment   .home-scene background (theme) + vignette
floor                   .scene-floor    the tappable band (a real <button>)
objects                 Bed.tsx         the one object in this milestone
actor                   BlobbiActor.tsx the Blobbi, anchored at its feet
foreground              feedback and UI over the scene (chips, errors)
```

Objects and the actor share one layer so depth can interleave them: paint
order is the floor `y`.

### Normalized floor coordinates (`geometry.ts`)

A floor point is `{ x, y }` in 0..1: `x` across the floor, `y` from the
horizon (0) to the front edge (1). The floor band occupies a fixed fraction
of the scene box (`FLOOR_BAND`), so placement is `left: x%`, `top: band%`,
independent of viewport size. Distances weigh `y` by `DEPTH_WEIGHT` so a walk
looks the same speed in every direction, and things at the back are drawn a
little smaller (`depthScale`, 12% at most). Pure helpers: clamp, distance,
direction, facing from direction, placement, scene fraction → floor point.

### Who owns what

| Concern | Owner | Output |
| --- | --- | --- |
| Position, destination, walking, arrival | `useBlobbiLocomotion` (pure model in `locomotion.ts`; one rAF loop that runs only while walking) | `position`, `motion: idle \| walking` |
| Facing | one rule, in the model (`locomotion.ts`): standing still it faces the viewer; walking it is drawn the way it goes (profile sideways, its back going up the floor, its front coming down it); however a walk ends it faces the viewer again | `facing` |
| Gaze | `useGazePolicy` (`gaze.ts`): hovering pointer followed over the scene, a tap holds attention briefly, idle glances are fixed offsets | `eyeOffset` (clamped −1..1, never negated: the renderer mirrors the left profile) |
| Reactions | `useReactionPolicy` + `reactions.ts`: feed/clean → happy, play → excited, wake → happy, a poke → happy; baseline from the kit's critical thresholds (energy → sleepy, else sad) | `expression` |
| Idle | `useIdleBehavior` + `idle.ts`: after `inactivityMs`, one small planned action per jittered beat (glance, short stroll, rest; it never turns its body away); randomness injected | calls the three above |
| Sleeping | protocol `companion.state` | `isSleeping` |
| Composition | `useBlobbiPresentation` → `composePresentation` | one `BlobbiPresentation` |

Precedence is a mode (`behavior-mode.ts`), resolved once per render in
`useBlobbiPresentation`: `sleeping > user-walk > free`. `BEHAVIOR_POLICY`
says what each mode allows (who may start a walk, idle clock, gaze,
reactions, floor taps, forced motion); every gate reads that table and
`composePresentation` applies it (sleeping: still, eyes shut, neutral;
any walk: eyes on the road; temporary reaction > baseline when reactions
are allowed). Locomotion keeps one rule of its own, in `beginWalk`: an
idle walk never replaces a user walk in progress. A future exclusive mode
(a lifecycle ceremony) is one word and one table row.

### Rest is walk-then-sleep

`rest` on an awake Blobbi is a user walk to `BED_SLEEP_SPOT`. `walkTo`
returns a promise that resolves with how the walk ended (`arrived`,
`replaced`, `stopped`, `refused`); `BlobbiOverview` awaits it and sleeps
only on `arrived`, only if the Blobbi is still awake by then (live ref), and
through a `perform` that checks a live in-flight flag rather than the
pending state captured when Rest was pressed. Nothing is published before
arrival; a tap elsewhere replaces the walk and the sleep never happens.
Under reduced motion arrival is immediate, so the action runs at once. Wake
is the existing action; the Blobbi stays in the bed, awake. No new protocol
event exists for movement.

### Boundaries

- Movement, gaze, facing, expression and position are local presentation
  state. `src/__tests__/scene.test.tsx` pins that walking, looking, idling,
  turning and reacting publish nothing and read nothing.
- The renderer draws; the body's idle breath and walking bob are its
  `motion` states. The app keeps only one-shot feedback animations (the hop
  after care, floating chips, the sleeping zzz) and no wrapper sway.
- Settings for the behaviour layer (`SceneSettingsProvider`: reduced motion
  override, scripted random, idle timing, walk speed) exist so tests are
  deterministic; the app uses the defaults and persists nothing.

## The first vertical slice (milestone 1)

```
open standalone
→ session resolved (NIP-07 extension or NIP-46 bunker, via @nostrify/react/login)
→ useBlobbisCollection(undefined, pubkey)          modern 31124 only, legacy dropped in the kit
→ useBlobbonautProfile(pubkey)                     kind 11125 via the kit's fetchFreshBlobbonautProfile
→ selectCurrentBlobbi(companions, [device pick, profile current_companion])
→ BlobbiRenderer visual={toBlobbiVisual(companion)}  the kit's getBlobbiVisualIdentity projection
→ stats from useProjectedBlobbiState + getVisibleStats / getStatStatus
→ Enter Blobbi Island (new tab)
```

Key files:

| Concern | File |
| --- | --- |
| Room space | `src/features/home/space/room-space.ts` (canvas, floor line, transforms, clamping) |
| Rooms | `src/features/home/rooms/` (registry, surfaces, furniture catalog, layouts and store, editor, drag, toys) |
| Dock and hotbar | `src/features/home/shell/ActionBar.tsx`, `ItemHotbar.tsx`, `HomeRail.tsx`, `CareDock.tsx` |
| Providers | `src/App.tsx` (home theme → logins → relay pool → query cache → router) |
| Relay pool | `src/components/NostrProvider.tsx` → `src/lib/home-pool.ts`; application relays in `src/config/relays.ts`, read routing in `src/lib/relay-routing.ts`, ecosystem hints in `src/features/inventory/relay-hints.ts` |
| Session | `src/hooks/useCurrentUser.ts`, `src/hooks/useLoginActions.ts`, `src/components/auth/*` |
| Profile (11125) | `src/hooks/useBlobbonautProfile.ts` (thin cache over the kit's fetch) |
| Collection + current Blobbi | `src/hooks/useHomeBlobbi.ts`, `src/lib/select-current-blobbi.ts` |
| Renderer seam | `src/lib/blobbi-visual.ts`, `src/features/home/scene/BlobbiActor.tsx` |
| Status | `src/features/home/BlobbiOverview.tsx`, `src/features/home/BlobbiStatusPanel.tsx` (presentational) |
| Themes | `src/theme/*` |
| Care | `src/features/care/*` (planner, publish adapter, mutations) |
| Island exit | `src/config/ecosystem.ts`, `src/features/home/EnterIslandButton.tsx` |

### Current Blobbi selection

Presentation-side only, never published: the first of (device pick stored
under the kit's `getSelectedBlobbiKey(pubkey)`, the profile's
`current_companion`) that names an owned modern Blobbi; else the only Blobbi;
else the most recently cared-for. Publishing a new `current_companion` is a
later, kit-backed write.

### Kind 11125 vs 31124

The player's global profile (11125: `has`, `current_companion`, `xp`, `level`)
and a Blobbi's state (31124) are different events and are never conflated.
The standalone reads the profile through the kit's `fetchFreshBlobbonautProfile`
and only uses `current_companion` and `xp` from it.

### Renderer boundary

The standalone decides which Blobbi, what size, which facing, and whether it
is sleeping. `@blobbi-kit/renderer` decides what it looks like. No Nostr reads
or care state live near the renderer; only the public barrel is imported
(`src/__tests__/no-duplicate-domain.test.ts` enforces this and the other
"no duplicate domain" rules).

### Island entry

`BLOBBI_ISLAND_URL` defaults to `https://island.blobbi.pet` (the ecosystem's
`*.blobbi.pet` convention; no sibling repo carries a deploy-time Island URL)
and can be overridden per build with `VITE_BLOBBI_ISLAND_URL` (absolute
http(s) only; anything else falls back to the default). Island opens in a new
tab; there is no iframe or embedding.

## Recovery matrix (pre-nuke history, read-only reference)

Audited commits: `54d413f` (last full app), `2281fb1` (pre-nuke parent),
`093d65d` (nuke), `6ce569c` (merge, HEAD at start).

| Bucket | What | Notes |
| --- | --- | --- |
| A. Reused as-is | `useCurrentUser`, `useAuthor`, `ThemeProvider`, relay list (`BASE_RELAYS`), Vite/Tailwind/tsconfig shape, eslint config, test setup, Comfortaa font, logo/branding assets, warm "elegant" theme tokens | Session infra is the MKStack pattern Island also uses |
| B. Adapted | `useLoginActions` + login dialog (nsec path removed; extension + bunker only), `GlobalHeader` → `AppHeader`, `CircularStatusIndicators` → `BlobbiStatusPanel` (now controlled/presentational), `NostrProvider` (fixed relay list, no NIP-65 manager), provider stack in `App.tsx` (all Blobbi providers removed), landing copy → signed-out home | Visual identity kept, local domain logic stripped |
| C. Replaced with kit | `lib/blobbi-events.ts` (31124/11125 parsing, 1.8k lines), `types/blobbi.ts`, `blobbi-decay`, `blobbi-svg-resolver`, `BlobbiVisual`, baby/adult SVG assets and customizers, `useUserBlobbis`, `useCurrentCompanion`, `useBlobbonautProfile` (old), XP/streak helpers | `@blobbi-kit/core`, `/react`, `/renderer` |
| D. Not restored | legacy 31125 → 11125 migration hook, auto-repair, on-load decay publisher, fake status/inventory contexts, PiP / floating companion / draggable bed, tour / spotlight, games, community feed, shop / coins / Lightning, PWA service worker, push, NIP-65 relay manager UI, dev editor pages, nsec paste / upload login, signup key generation + download | Obsolete protocol workarounds, old event semantics, or out of product scope |
| E. Future shared candidates | floating companion runtime (movement, drag, bounds, idle) → `@blobbi/companion`; account switcher, relay settings, dialog/toast primitives → `@blobbi/ui` | Kept out of this milestone; nothing local recreated |

## Security notes from recovery

- The old app persisted nsec logins in `localStorage` through the login store.
  This milestone offers only NIP-07 and NIP-46 sign-in, so no identity key is
  ever entered into or stored by this origin. `useCurrentUser` still resolves an
  `nsec` login type if one exists, so adding it back later is a UI decision.
- The old signup flow generated a key in the page and downloaded it as a text
  file. Not restored.
- No secrets in URLs, query params or logs; the Island link is validated to an
  absolute http(s) URL before it is rendered.

## Deferred (next milestones)

1. **A real item economy**: require ownership for care by removing the
   `starter` branch of `CareChoice`; the starter kit is a free, unowned
   catalog on purpose until then.
2. Relay settings (NIP-65) and account switcher, once `@blobbi/ui` exists.
3. The dormant M9 rooms (see `src/features/home/rooms/README.md`).
