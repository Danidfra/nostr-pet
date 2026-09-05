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

## The first vertical slice (this milestone)

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
| Providers | `src/App.tsx` (theme → logins → relay pool → query cache → router) |
| Relay pool | `src/components/NostrProvider.tsx`, relays in `src/config/relays.ts` |
| Session | `src/hooks/useCurrentUser.ts`, `src/hooks/useLoginActions.ts`, `src/components/auth/*` |
| Profile (11125) | `src/hooks/useBlobbonautProfile.ts` (thin cache over the kit's fetch) |
| Collection + current Blobbi | `src/hooks/useHomeBlobbi.ts`, `src/lib/select-current-blobbi.ts` |
| Renderer seam | `src/lib/blobbi-visual.ts`, `src/features/home/BlobbiHero.tsx` |
| Status | `src/features/home/BlobbiOverview.tsx`, `src/features/home/BlobbiStatusPanel.tsx` (presentational) |
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

1. **Care actions** (feed / play / clean / rest): kit-backed writes through a
   `PublishAdapter`, with fresh-read-before-write. Read path is already in place.
2. **Inventory preview**: `@nostr-games/inventory` (same version as Island,
   `^0.5.0`) read-only browser of owned inventories; equipment later.
3. **Set current companion**: publish `current_companion` on 11125 via the kit's
   merge helpers instead of the device-only pick.
4. Relay settings (NIP-65) and account switcher, once `@blobbi/ui` exists.
