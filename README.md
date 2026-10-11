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
  into an adult here, through the kit's missions and ceremonies. An
  account's first egg hatches by itself, a moment after adoption, with no
  missions; every later egg earns its hatch.
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

On this branch a Blobbi adopted here is born into the procedural generation
(`visual_generation = v3`): its kind 31124 states its colours (`base_color`,
`secondary_color`, `eye_color`, `accent_color`), its anatomy (`antenna`,
`horns`, `ears`, `tail`) and its surface (`pattern`, `special_mark`,
`belly`, `freckles`) explicitly, with `visual_algorithm`, and everything
else about its looks derives from its `seed`. A V3 event carries no `size`
and no `adult_type`. The representation is the kit's (see `ARCHITECTURE.md`, "Visual
generation V3"); whether production adoption mints V3 is not decided yet.
Blobbis born earlier (V1, with no marker, and V2) are read, drawn and
republished exactly as before.

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
| `?fixture=egg\|baby\|adult\|adult-v2\|egg-v3\|baby-v3\|adult-v3` | a fixture world in memory, with the dev panel: no account, no relay, no write (the plain names are V1 Blobbis; `-v3` are procedural ones, born as this app's adoption makes them) |
| `&state=sleeping`, `&low=<stat>`, `&expression=<preset>` | the fixture's starting variation: asleep, a critical stat, a pinned face |
| `&account=first` | the fixture Blobbi is the account's first (by default an older adult is in the world too, so a fixture egg keeps its missions); a first Blobbi's egg hatches by itself |
| `?fixture=fresh` | an account with nothing in it: the real adoption flow, then the first Blobbi's automatic hatch. What it publishes is kept for the tab, so a reload finds the baby; Reset fixture empties it |
| `?preview=bed\|tub` | the bed or the tub out on load, to look at proportions |

A `?fixture=` link opened in a dev build **without** the flag is refused out
loud (a banner names the flag) instead of quietly opening the real home.

### Testing on a phone

The dev server binds every interface (`server.host: "::"`), so a phone on
the same Wi-Fi can open the Mac's address (Vite prints it as "Network").
Two things to know:

- **Fixtures need the flag.** With `VITE_BLOBBI_DEV_TOOLS=true` in
  `.env.local` (or in front of `npm run dev`), open
  `http://<mac-address>:8080/room?fixture=adult-v3&perf` (or `baby-v3`):
  the real room over a simulated Blobbi, with the dev tools' frames-per-second
  indicator on, and no account, key, relay, internet or write involved. The
  in-memory world does not mind plain HTTP.
- **The room's dev tools** are one **Dev Tools** pill in the corner (dev
  builds with the flag). It opens a bottom sheet on a phone, a side panel on
  a wide screen, with one view at a time: Animations (the room transitions,
  a scrubber, speed, feeding and petting previews, Reset to neutral),
  Teleport (leave, arrive, round trip, cancel, a scrubber), Room (go to a
  room, the other fixtures), Visual (2D or 3D, graphics quality, every face),
  Performance (live numbers, Record 10 s, Copy report, Select all, the
  page's runtime errors, copyable) and Fixture (the fixture world's own
  panel). Starting something to watch closes the sheet on a phone and the
  pill names what plays; a recording runs on while the sheet is closed. A
  render error inside the room is caught by the room's error boundary
  (`RoomErrorBoundary`): the page stays, the cause is shown with a copyable
  report, and the room can be tried again, in 2D if it was 3D.
- **A real account needs HTTPS (or localhost).** Browsers treat a plain
  `http://192.168.x.x` page as insecure and withhold `crypto.randomUUID`
  (and `crypto.subtle`, and the clipboard). nostrify's relay subscriptions
  need `randomUUID`, so on such a page the home cannot read from relays;
  it says so at once with a retry (`src/lib/relay-transport.ts`) instead
  of looking for the Blobbi forever. Keys are still made and events still
  sign (nostr-tools over `getRandomValues`), but nothing can be read back,
  so a new account made there finds no Blobbi. For a real account on a
  phone, serve over HTTPS with a certificate the phone trusts; the two
  safe ways, neither of which puts a secret in the repo:
  - **mkcert** (`brew install mkcert && mkcert -install`, then
    `mkcert 192.168.1.4 localhost` and install the root on the phone as
    mkcert's docs say), then
    `BLOBBI_DEV_TLS_CERT=./192.168.1.4+1.pem BLOBBI_DEV_TLS_KEY=./192.168.1.4+1-key.pem npm run dev`
    and open `https://192.168.1.4:8080/`;
  - **Tailscale** (`tailscale serve --bg 8080`): a `https://<mac>.<tailnet>.ts.net`
    address with a publicly valid certificate, reachable from the phone on
    the same tailnet, nothing installed on the phone.

  Never put a self-signed or production certificate in the repo, and never
  work around the missing API with a weaker random source.

**The Dev Lab** is the engineering surface for Blobbi work:

```bash
VITE_BLOBBI_DEV_TOOLS=true npm run dev   # or put the flag in .env.local
# then open http://localhost:8080/dev
```

It puts the real home (renderer, movement, bed and nest, shadows,
interactions) next to a control column, over an in-memory Nostr pool: the
banner says **DEV FIXTURE — IN-MEMORY NOSTR** and nothing on the page can
reach a relay or a real account. Controls: quick fixtures (V1/V2 egg, baby,
adult) and presets; an explicit **Generation: V1/V2** badge and switch; a
lifecycle pipeline where **Set** places the fixture at any step and
**Perform** runs the kit's real hooks and shows their answer (the dock's
mission-gated Hatch!/Evolve! ceremony still works); stats, streak, xp and
mission counts (authoritative fixture data); presentation overrides (face,
facing, gaze, motion in place, reduced motion, lighting) that never touch
the data and clear in one click; a movement lab (walk left/right/toward/away,
walk to a point, stop, pin a view, poke) that drives the game's own scene
controller, so V1 hopping and the V2 walk can be compared; a debug-bounds
overlay (floor band, walkable bounds, actor and shadow boxes, feet anchor,
destination, bed and nest use points); an expression lab comparing the V1
baby, V1 adult and V2 adult under one face, facing and gaze; a sound lab for
every recipe of the voice; and a read-only inspector of the parsed Blobbi.
On a phone the controls become a drawer under the stage. `/dev` does not
exist in a production build (`env-contract.test.ts`, `dev-lab.test.tsx`).

**The dev panel** (bottom right of a `?fixture=` link; collapsed on a phone) rewrites
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

`vite.config.ts` also reads two plain (not `VITE_`) variables for the dev
server only, `BLOBBI_DEV_TLS_CERT` and `BLOBBI_DEV_TLS_KEY`, paths to a
certificate and key for HTTPS on the LAN (see "Testing on a phone"); the
app itself never sees them.

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
