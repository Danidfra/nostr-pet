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
- auth / session wiring (which signers are offered, how logins persist).

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

The standalone does not duplicate Ditto's ceremony-heavy onboarding or the
Island's world runtime. "Your Blobbi lives here. The Island is where you go
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
| Facing | derived from travel direction in the model; the arrival facing is kept, nothing snaps to front | `facing` |
| Gaze | `useGazePolicy` (`gaze.ts`): hovering pointer followed over the scene, a tap holds attention briefly, idle glances are fixed offsets | `eyeOffset` (clamped −1..1, never negated: the renderer mirrors the left profile) |
| Reactions | `useReactionPolicy` + `reactions.ts`: feed/clean → happy, play → excited, wake → happy, a poke → happy; baseline from the kit's critical thresholds (energy → sleepy, else sad) | `expression` |
| Idle | `useIdleBehavior` + `idle.ts`: after `inactivityMs`, one small planned action per jittered beat (glance, turn, short stroll, rest); randomness injected | calls the three above |
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

1. **Equipment at home**: render the Island's kind 31634 placements for the
   current Blobbi (read-only) through the renderer's accessory inputs; equipping
   stays on the Island.
2. Relay settings (NIP-65) and account switcher, once `@blobbi/ui` exists.
