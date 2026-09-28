# Blobbi

**The home of your Blobbi.** The standalone Blobbi app for
[blobbi.pet](https://www.blobbi.pet/): one room where your current Blobbi
lives. Check on it, feed it, play with it, clean it, put it to bed, hatch
and evolve it, and step out to [Blobbi Island](https://island.blobbi.pet)
when you are ready.

It is a consumer of the shared Blobbi packages (`@blobbi-kit/core`,
`@blobbi-kit/react`, `@blobbi-kit/renderer`) and of `@nostr-games/inventory`.
[ARCHITECTURE.md](./ARCHITECTURE.md) says what lives here and what lives in
the kit, milestone by milestone.

## What it is

- **A Nostr client.** Everything durable is a signed Nostr event on public
  relays; the app keeps no server of its own. Your Blobbi is a replaceable
  event under your key, readable by every Blobbi app in the ecosystem.
- **One home.** A single living room, drawn at a fixed 4:5 canvas that fits
  any phone, with the Blobbi walking, looking, reacting and sleeping in it.
  No rooms to manage, no editor, no shop.
- **Care by items.** Feed, Play and Clean each open a strip of the items
  that answer them: the official starter kit (free, unlimited, not owned)
  and what you own on the Island (spent when used). Rest is the bed.
- **The lifecycle at home.** An egg hatches into a baby and a baby evolves
  into an adult here, through the kit's missions and ceremonies.
- **Sound, small and procedural.** A short Web Audio voice derived from the
  ecosystem's feeding sound. Nothing is downloaded, nothing is published,
  and audio only starts after you touch the page. There is a mute.

## Signing in

The app never asks for your secret key by hand and never sends it anywhere.

- **Browser extension** (NIP-07): the extension signs, the key stays in it.
- **Signer app by QR or link** (NIP-46 `nostrconnect://`): show a QR code or
  open a deep link to a signer app such as Amber, Nostrsigner or nsec.app.
  A throwaway client key lives in memory for the handshake; your own key
  stays in the signer app.
- **Bunker address** (NIP-46 `bunker://`): paste one from a remote signer.
- **A new account**: a fresh key generated on your device, shown once and
  gated behind a backup step, then a Nostr profile and your first egg.

Local-key accounts and remote signers are kept apart in the session store
and told apart in the interface, so you always know which you are using.

## Nostr events used

These kinds come from the shared kit and the games that write them. They
are the ecosystem's conventions, **not** accepted NIPs; nothing in this
list is standardised beyond the projects that share it.

| Kind | Meaning | Here |
| --- | --- | --- |
| 31124 | Blobbi state (one replaceable event per Blobbi) | read, written by care and the lifecycle |
| 11125 | Blobbonaut profile (the player's Blobbis and current companion) | read, written on adoption |
| 1124 | Blobbi interaction log | written with care |
| 31632 | Item definitions (official catalog by the trusted issuer) | read |
| 31633 | Inventory snapshots, written by the games as the player | read, never written |
| 1416 / 1417 | Inventory spends and folds | spends written for owned items only |
| 31634 | Equipment placements from the Island | read |
| 0 | Nostr profile | written once on account creation |

Relays: reads and writes go to the application relays in
`src/config/relays.ts`; read-only hints add the relays where the games and
the item issuer are known to publish. A profile picture, the one upload,
goes to the Blossom servers in `src/config/blossom.ts`.

## Development

```bash
npm install
npm run dev        # http://localhost:8080
```

Dev-only switches, honoured by `npm run dev` only and excluded from a
production build:

| Switch | What it does |
| --- | --- |
| `VITE_BLOBBI_DEV_TOOLS=true` in `.env.local` | enables the switches below and the force-hatch / force-evolve buttons |
| `?fixture=egg\|baby\|adult\|adult-v2` | a fixture world in memory, with the dev panel: no account, no relay, no write |
| `&state=sleeping`, `&low=<stat>`, `&expression=<preset>` | the fixture's starting variation: asleep, a critical stat, a pinned face |
| `?preview=bed\|tub` | the bed or the tub out on load, to look at proportions |

**The dev panel** (bottom right of a fixture; collapsed on a phone) rewrites
the fixture while the app runs, without a reload: stage and state, every
stat (sliders, exact values, condition presets), streak and xp, the
progression and its mission counts, whole-Blobbi presets (fresh egg, hatch
ready, critical baby, evolution ready, …), presentation pins (a face, a
facing, reduced motion, lighting) and a Reset. Two vocabularies are kept
apart on purpose: **Set** rewrites the in-memory world (the Blobbi simply
*is* that now); **Perform** runs the kit's real lifecycle hooks (start
incubation, hatch, start evolution, evolve) against the in-memory pool and
shows what the kit accepts or refuses. The app's own mission-gated ceremony
is still the dock's Hatch! / Evolve! button. Nothing in fixture mode ever
reaches a relay, and none of it is in a production build
(`src/dev/`, lazy behind the flag; `src/__tests__/env-contract.test.ts`).

## Configuration

Copy `.env.example` to `.env.local`. The app reads exactly two variables:

| Variable | Required | Meaning |
| --- | --- | --- |
| `VITE_BLOBBI_ISLAND_URL` | no | where "Enter Blobbi Island" goes; must be an absolute `http(s)` URL, otherwise the default `https://island.blobbi.pet` is used |
| `VITE_BLOBBI_DEV_TOOLS` | no | dev builds only; ignored by `vite build` |

The contract is enforced by `src/__tests__/env-contract.test.ts`. The build
is a static single-page app: `npm run build` writes `dist/` and copies
`index.html` to `404.html` so hosts that serve `404.html` for unknown paths
(GitHub Pages and similar) route every path to the app. Assets are served
from the site root.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check      # all of the above
```

Two more scripts matter for releases:

- `node scripts/refresh-official-catalog.mjs` regenerates the bundled
  snapshot of the official item catalog (`src/features/inventory/
  official-catalog-snapshot.ts`) from the relays, read-only. The snapshot is
  the fallback when the relays are unreachable and is marked as such in the
  interface; live definitions from the trusted issuer always win.
- The learning journal in `scratchpad/learning/` is a local, git-excluded
  maintainer notebook and is never part of a release.
