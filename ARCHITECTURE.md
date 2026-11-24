# Blobbi Standalone: architecture

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
keeps one rule of it: an account's first egg hatches right away, see
`src/features/lifecycle/first-blobbi.ts`) or the Island's world runtime. Since M13 the
2D home is where a first Blobbi is born and the default home; the 3D room is
opt-in (`src/lib/home-experience.ts`), its code in a lazy chunk. "Your Blobbi lives here. The Island is where you go
out into the world."

## Where things live

Each feature folder under `src/features/` owns one part of the game. The
larger ones carry their own README.

| folder | what it is |
| --- | --- |
| `home/` | the 2D home: the scene, the HUD, the sheets, care and poke reactions |
| `room/` | the 3D room (three.js, lazy chunk): rooms, decorating, walking, care in 3D |
| `care/`, `care-ui/` | care intents and plans (the formulas are the kit's) |
| `bath/` | the bath as a small game ([README](src/features/bath/README.md)) |
| `inventory/` | items, the starter kit, uses (the protocol is `@nostr-games/inventory`'s) |
| `lifecycle/` | egg, hatch, evolution ceremonies |
| `onboarding/`, `adoption/`, `guest/` | the way in: welcome, the first egg, play first and save later ([guest security](src/features/guest/SECURITY.md)) |
| `companion/` | the global current companion (below) |
| `progression/`, `journey/` | daily missions and XP, the chapters ([progression](src/features/progression/README.md), [journey](src/features/journey/README.md)) |
| `worlds/`, `teleport/`, `presence/` | the other Blobbi worlds, travel and presence ([worlds](src/features/worlds/README.md), [teleport](src/features/teleport/README.md), [presence](src/features/presence/README.md)) |
| `expression/` | faces and moods ([README](src/features/expression/README.md)) |
| `photo/` | the Blobbi Polaroid ([README](src/features/photo/README.md)) |
| `sound/` | the Blobbi's voice and the room's sounds, synthesised with Web Audio |

The history of how each part came to be is in the git log.


## Relays: transport and trust (audited 2026-09-24)

The home reads three kinds of relay knowledge and configures only one:

| Tier | What | Where | Used for |
| --- | --- | --- | --- |
| Primary relay (2026-11-11) | `PRIMARY_RELAY` (`wss://relay.blobbi.pet`) | `src/config/relays.ts` | asked first and written first for the Blobbi kinds it accepts (`PRIMARY_KINDS`); no other flow |
| Application relays | `BASE_RELAYS` (ditto, primal, nostr.band) | `src/config/relays.ts` | every read; a publish target of every write; the secondaries of a Blobbi flow |
| Ecosystem read hints | where Island and the Farm write inventories, spends, folds, equipment | `src/features/inventory/relay-hints.ts` | kinds 31633 / 1416 / 1417 / 31634 |
| Issuer relays | where each trusted issuer's definitions live | `TrustedIssuer.relays` (`issuers.ts`) | kind 31632 requests naming that issuer |

**The primary relay (2026-11-11).** `wss://relay.blobbi.pet` is the default
primary for the Blobbi kinds; the application relays are its secondaries.
The paragraphs below describe the tiers as audited on 2026-09-24 and still
hold for everything that is not a Blobbi kind (kind 0, NIP-46 kind 24133,
the Ditto theme kinds): those never reach the primary. For a Blobbi read the
pool asks each relay on its own and puts the answers together with the kit's
rules (`src/lib/blobbi-relay-routing.ts`, vendored from `@blobbi-kit/core`
until the release that contains it is installed): the NIP-01 winner across
relays, and "none" believed only when each of `ABSENCE_REQUIRED_RELAYS`
(primary, ditto, primal) reached EOSE, otherwise the read fails
(`RelayReadUnknownError`) and the home keeps what it had. A write resolves on
the first acceptance as before, and every destination's verdict goes to
`src/lib/relay-sync.ts`, which also carries the player's own events to a
relay of their flow that certainly lacks them (same id, same signature;
`SyncLedger` stops repeats). That carrying of EXISTING events is OFF until
the account turns it on (Account sheet, "Relays"; `src/lib/sync-consent.ts`,
per pubkey, for exactly the relays shown): opening the home or restoring a
sign-in sends no event. The same gate stands in front of the profile
redelivery (`profile-delivery.ts`) and world travel's repair
(`travel-relays.ts`); an event signed in the current visit passes it. Profile writes keep `PROFILE_REQUIRED_RELAYS`
(ditto, primal): the primary is asked and written, never required. World
travel: `src/features/presence/travel-relays.ts`.

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

## The global current companion (companion sync, 2026-10-15)

The Blobbi a player chooses is their companion in every Blobbi app
(Standalone, Blobbi Pixel, Ditto): the kind 11125 profile's
`current_companion`, the bare `d` of one of their own kind 31124 Blobbis. No
new kind, no new tag. Code: `src/features/companion/`.

```
select(d) ─► choice-store (per account, shown at once) ─► companion-sync (one write at a time, in the background)
                                                              └─► profile-write: complete read → build → sign → re-check → send → read back
profile (watched: focus, reconnect, every minute) ─┐
choice-store ──────────────────────────────────────┴─► choice-order ─► shown d  (adopted from elsewhere once no moment holds it)
                                                                    └─► a question when the two cannot be ordered
```

**Choice order v1** (`choice-order.ts`; Blobbi Pixel's `src/game/companion-order.ts`
carries the same rules and the same test vectors):

1. the same Blobbi on both sides: nothing to decide;
2. only one side usable (a profile counts only if valid and naming one of the player's own Blobbis);
3. a choice known to the network (published here, or adopted) against the profile: NIP-01 order (newer `created_at`, then lower id): a shared choice never blocks a later one;
4. adopted with a time only: `created_at` order, equal is ambiguous;
5. the device pick kept before choices were stamped (`legacy`): the profile wins (this app published every change);
6. a choice made here and not shared yet: made over the profile now seen or a newer one (`over`: the newest profile known when choosing), it wins; a profile written after it is never ignored: this device's clock against the profile's `created_at`, decided only by a gap over 60 s with both in the past; else ambiguous, and the player is asked (closing the question is not an answer).

Writers add one rule (`CHOICE_FRESH_MS`): the share that starts within 30 s of the choice is the player's latest act in real time, so it is written over whatever the relays hold without asking; only a later attempt (a retry, a choice kept offline) is ordered against what it finds. Two choices made in two apps within those seconds: the later write wins.

**Writing safely** (`profile-write.ts`). The profile is replaceable: a write
replaces it everywhere. So a replacement is built only from a COMPLETE read
(each of `PROFILE_REQUIRED_RELAYS`, relay.ditto.pub and relay.primal.net,
where every Blobbi app writes profiles, answered), over the newest valid
profile (11125 before 31125, NIP-01 order), changing only
`current_companion` (and listing the Blobbi in `has` if missing; nothing is
ever removed), content kept, `created_at` after the base's, checked by
`preservesProfile` before signing; the choice's own order is checked against
the base (a choice made clearly later elsewhere is never overwritten); a
second complete read just before sending (a profile written meanwhile is
built over, once); then saved only when read back from 2 relays,
relay.ditto.pub among them (Blobbi Pixel's policy). The signed event is
stored before it is sent, so every retry sends that very event; a stored
write superseded by a newer profile is dropped. No profile at all: nothing is
created (the choice stays on this device), with one exception below. The
account is checked again right before sending.

**One profile write at a time, never over an older profile** (follow-up audit,
2026-10-16). Every profile write this home builds runs in the account's
profile queue (`profile-queue.ts`): the companion choice, and, through
`writeProfileSafely` (`safe-profile-write.ts`), adoption's profile and the
daily award. `writeProfileSafely`: a complete read (else `unsafe`), the
caller's change over the newest profile, `created_at` after the base's,
signed by the account still signed in, a second complete read after signing
(a profile written meanwhile: nothing is sent, `stale`; never rebuilt, so the
signer is asked at most once), the account checked again, then sent. The
daily award is planned over that complete read (the pool's quick merged read
ends a moment after the fastest relay and could miss a newer profile), so it
can no longer restore a companion chosen a moment before.

**A first adoption's profile.** Adoption writes its profile with
`writeProfileSafely`, asking a silent required relay once more (a read only)
before giving up. If no profile was written and no complete read ever found
one, the choice is kept as `needs-profile` (with the name for a new profile);
the player sees Try again, which creates the profile only when a complete
read of every required relay confirms none exists. An incomplete read is
never taken for "no profile"; a profile that appeared meanwhile is built
over, never replaced.

**When it publishes**: only for the player's act (choosing, Try again,
answering the question), plus in-visit retries after a failure (when the
connection returns, then after 15 s, 60 s, 180 s). Never on load, refresh,
re-mount, an adopted choice, or the same Blobbi chosen again; after a reload
an unshared choice waits for Try again.

**Who is asked to sign**: only the player's own acts may ask the signer (an
extension or a remote signer shows the player every request). An automatic
retry only resends a write already signed; one that would need a new
signature stops (`needs-signature`) and the choice waits for Try again. A
choice made offline (never signed) is therefore shared by Try again.

**Who**: the signed-in account only, the Blobbi in its own collection; the
record is per account (`blobbi:companion:v1:<pubkey>`), a write stops before
sending if the account changed, and a signature for another key is refused.

**Moments**: a newer choice from elsewhere is applied only when no care
write, bath, dose, hatch theatre, ceremony, walk to an object, or departure
is on screen (`useCompanionSwitchHold`, 2D home and room).

**What the player sees** (`CompanionLayer`): nothing while it works; a small
card with Try again when a choice could not be shared ("Your other Blobbi
games don't know about Bo yet."); the question "Who's your companion?" with
both Blobbis when the order is unclear.

**Daily progress, safe and durable (blobbi-kit 0.10).** The kit's
`usePersistDailyProgress` runs in its safe mode for a signed-in player on
the relays (`useDailyXp`: this device's `localStorage` as the kit's
`StorageAdapter`, and `profileWriterFor`, the kit's `writeProfileSafely`
bound to this account). Progress is kept on this device per account the
moment it happens (public data only), merged back after a reload, saved
3 s after something done here over the NEWEST profile (complete read;
the companion, `has`, other tags and content kept; the profile's own
progress merged in), and cleared only once read back. It is never saved
by itself on load, on a tab hide, on unmount or after a failure: the
Journey says "Today's progress is kept on this device" with Save. A
finished day is the award's. The profile's missions are merged into this
page's (the kit's merge on load), never written over local progress.
Known limits of the kit's merge (no reroll history): two devices
rerolling the same day, or a reroll picking again a mission replaced
earlier that day; completed missions and paid XP are never lost.
`profile-queue.ts` and `safe-profile-write.ts` are now thin adapters over
the kit (one queue instance for the page). Until 0.10.0 is published the
dependency is a local tarball, not committed.

**Choice order v1.1 (proposed, deferred).** A confirmed write of ours
replaced within a short window (for example 10 minutes) by a profile naming
exactly the companion our write replaced would be put to the player instead
of followed silently: such a profile may be a stale writer restoring an old
profile, not a new choice. Both apps would ship it together, with the shared
vectors. No tag format change, no new kind. Not implemented.

**For the kit, later (not done here)**: `orderChoices`, `newestProfile`,
`buildCompanionProfile` and `preservesProfile` are pure and app-agnostic; a
future `@blobbi-kit/core` release could carry them (with the shared
vectors) so every app orders and writes choices the same way, and the kit's
`fetchFreshBlobbonautProfile` could gain the NIP-01 tie-break and a
"complete" flag.

