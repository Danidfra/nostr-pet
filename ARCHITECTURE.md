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

@nostr-games/inventory    inventory / equipment protocol  →  standalone inventory surfaces (next milestone)
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
| **Standalone** | everyday home: current Blobbi, care, status / progress, inventory, companion experience, launch Island |
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

Inventory (`@nostr-games/inventory`, items, food effects, equipment, foreign
inventories) comes after the care loop. The dock and the condition panel are
laid out so an inventory surface can be added below the dock without
redesigning the page. Also deferred: relay settings, account switcher, social
interaction projection on the home, the companion runtime.

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
| Providers | `src/App.tsx` (home theme → logins → relay pool → query cache → router) |
| Relay pool | `src/components/NostrProvider.tsx`, relays in `src/config/relays.ts` |
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

1. **Inventory preview**: `@nostr-games/inventory` (same version as Island,
   `^0.5.0`) read-only browser of owned inventories; item-based care effects
   through the kit's `CatalogAdapter`; equipment later.
2. Relay settings (NIP-65) and account switcher, once `@blobbi/ui` exists.
