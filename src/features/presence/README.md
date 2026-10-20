# World travel: where the Blobbi is, across Blobbi worlds and devices

World travel on Nostr (M16) is the **only** model for where a Blobbi is. It is
off by default, and with it off the Blobbi is simply home: nothing about its
place is read, kept, signed or published, and the home plays as a single-world
app.

> **World presence v1 was removed.** It was a cookie lease shared by the
> `*.blobbi.pet` apps on one browser. No cookie, no page storage of its own and
> no other channel says where a Blobbi is any more; the protocol is the Nostr
> World Location below. Its code and its shared test vectors are in the git
> history (before the commit that removed them).

## Status and model

**Status: implemented and tested locally, off by default.** The kinds are experimental (`@blobbi-kit/core` 0.11.0,
from npm). Turning it on for players is the owner's release decision.

With travel on Nostr, the Blobbi's **World Location** (kind 31126, addressable, one event per move) is the authority
everywhere, on any device. The protocol, its rules and its tests are in `@blobbi-kit/core`: `WORLD-TRAVEL.md` in
blobbi-kit, plus `world-travel*.ts`. This folder only wires the home to it, in `useHomeTravel.ts`, one interface for the classic home and the room.
With travel off, the same hook has no session: no relay read, no listener, no signer asked.

## Turning it on

- **A public beta build:** `VITE_BLOBBI_WORLD_TRAVEL=nostr npm run build`. This is the owner's release decision. The
  build says `World travel: ON in this build…`; an unknown value (`on`, `true`, a typo) stops the build
  (`travel-build.ts`, checked by `vite.config.ts`), so it is never quietly off. This app has no rehearsal mode (its
  other events are always published), so this one flag is the whole decision; Blobbi Pixel also needs its live build.
- **`npm run dev` with the same variable** turns it on in the development server too, and the server warns that moves
  go to the PUBLIC travel relays.
- **A development server only:** `localStorage['blobbi:world-travel:v1'] = 'nostr'`, then reload. A production build
  ignores this flag (`travel-mode.ts`).
- **Otherwise:** off. The Blobbi is home, whatever any relay or this device kept says. On Nostr, a newer signed
  event always wins over the device's stored last location.

## What happens

- **Who.** Only a real login has a session: an nsec, an extension or a remote signer. A guest's Blobbi and a dev
  fixture's stay home.
- **Relays.** The session reads and writes `BLOBBI_WORLD_TRAVEL_RELAYS`, which are `wss://relay.ditto.pub` and
  `wss://relay.primal.net`, one relay at a time (`poolWorldTravelRelays` over the app's pool). It keeps a live
  stream, resubscribes with backoff, and looks again every minute, when shown, and when back online.
- **Load: four cases kept apart** (the kit's `snapshot.resolution` and `travelView`):
  - **cached**: this device kept the last signed location. It decides the first frame (`travelStartsAway`): the
    Blobbi stands here, or the away card shows, at once; the relays confirm a moment later.
  - **pending**: a fresh device (or a new account or Blobbi), nothing kept. The place is not known, so the Blobbi is
    neither here nor away: the teleport starts **absent** (`useTravelStartsUnknown`, and a layout effect for a
    Blobbi or account switch), and where it stands a small **"Looking for Brook…"** cue shows (`TravelCue`: a soft
    glow on the floor breathing on a 1.8 s cycle, three faint twinkles, a small label; still under reduced motion).
    The poke and the care dock wait, as while it is away; nothing else on the page is held. No full-screen overlay.
  - **confirmed**: a relay answered. Home: the Blobbi appears with a 420 ms fade (classic home; no fade under reduced
    motion), never an arrival replayed; in the room, the room's own arrival on entry plays (it waited for the
    answer). Away: the away card, with no departure.
  - **unreachable**: no relay answered within the timeout (4 s). The kept place stands, or home by default for a
    Blobbi with none (as for a Blobbi that never travelled), with a small honest line "Couldn't reach the Blobbi
    relays, so Brook is shown at home." and **Look again** (`session.refresh()`). "Looking" never lasts longer.

  The first answer is always *historical*: shown as it is (teleport `settle`), never replayed as a journey. Nothing is
  signed or published while looking (the opening's move below waits for `confirmed`).
- **Opening the home is the player's intention to bring the Blobbi here** (2026-10-19, `world-travel-departure.ts`,
  the same file in Island and Pixel). Once the account is signed in and the place is `confirmed`, an away Blobbi is
  moved here at once with the kit's own explicit move (`session.travel({ explicit: true })`: one signature, one
  World Location), then the arrival plays through the sync. Already here: nothing is published. **Once per page
  load** per owner and Blobbi (`autoArrivalDecision` over a module-level `ArrivalIntent`): never again on a
  re-render, a remount, a reconnect, a relay update or a focus or visibility change; a reload is a new page and may
  move again; a tab that already decided never reclaims the Blobbi by itself (two open tabs can never ping-pong).
  The decision also counts as opening the world only while the page is **fresh**: within `ARRIVAL_INTENT_TTL_MS`
  (5 min) of its navigation start (`pageIsFresh(pageAgeMs())`, `performance.now`) and visible. A background tab
  shown later than that, or a page left signing in for longer, moves nothing by itself (Call home remains); a
  back/forward-cache restore keeps the page's state, so its earlier decision stands. `unreachable` on the first
  look decides "nothing" too: the page moves nothing later by itself. The kit's signer is wrapped in
  `boundedSigner` (`SIGN_PROMPT_TIMEOUT_MS`, 60 s): a prompt left open longer ends the move as `declined` (the away
  card offers its retry), and a late approval is dropped by the wrapper, never published. If the signer is missing,
  refuses or times out, nothing moves and the away card says so.
- **Call home** (the away card's button, and Try again after a failure) is the player's explicit act: an explicit
  `travel()`, at once, as often as asked. No input moves the Blobbi: a trusted press or key is activity
  (`session.noteActivity()`) for Active Presence only. Eggs and sleepers stay home and are never moved.
- **Leaving for another world** (the Worlds sheet, `useHomeTravel.departTo`): the home moves the Blobbi there from
  here once the goodbye is over and Stay can no longer be pressed (the departure's `navigate`, at `gone`; nothing
  is signed or published before, and Stay publishes nothing): a fresh read, one kind 31126 naming the destination,
  published to the travel relays, one acceptance or a bounded timeout, then the plain navigation. Already there:
  nothing published. A navigation that does not happen after a published move leaves the Blobbi gone (Try again
  asks for the address again, no new move; Dismiss re-enters nothing). Nothing rides in the URL. See
  `features/worlds/README.md`.
- **One sequence: the call, then the arrival.** While a move here is under way (`travelView` kind `coming`: checking,
  signing, publishing, the other World's departure window) a **calling cue** shows where it will stand
  (`TravelCue` `coming`: the same floor glow, brighter, gathering on a 0.9 s cycle, with motes drifting down onto it,
  the teleport's "incoming" direction, in the Blobbi's colour; no words, the card says what is going on). Then the
  teleport's arrival plays on the same spot. The session is given `arrivalLeadMs = ARRIVE.incoming` (550 ms,
  `teleport/timeline.ts`): the arrival starts that much before `formAt`, so the body forms when the session says
  (after the departure window, now 2 s, and no sooner than `MIN_TRAVEL_MS`, 1.5 s, after the player's act). Nothing
  replays on load, nothing plays twice, and a reconnect only looks again.
- **Another World or device taking it.** Its event comes in on the stream, live, and the home departs once its own
  moment ends (care in flight, a ceremony, the hatch theatre, a bath, medicine, an item on its way: the same `busy`
  as for any journey). Eggs and sleepers never travel.
- **Signers.**
  - An nsec login is `silent`. An extension or a remote signer (NIP-46) is `prompt`: the away card says "Approve in
    your signer…".
  - A refusal or a failure is said, with **Try again**. The page itself never asks a second time.
  - "Couldn't reach the relays" resends the same signed event: once automatically, then on Try again or a reload
    within 30 s. It is never sent after a newer location exists.
- **Active Presence (kind 21124).**
  - The account sheet has "Let my other Blobbi worlds know when I'm playing here" (`active-presence-choice.ts`).
    It is stored per account as `localStorage['blobbi:active-presence:v1:<pubkey>'] = 'on'`, and is off by
    default.
  - While it is on and the Blobbi is here and played (a real input within two minutes), the home signs a note at
    most once a minute that lasts two minutes. With a prompting signer, the first note waits for a real input; if
    signing takes longer than 1.5 s (a person was asked), it pauses for the session.
  - It never moves the Blobbi. When Pixel shows recent presence, the card says "playing in Blobbi Pixel right now"
    (instead of "was last in"), and the arrival waits Pixel's departure window (2 s) so its departure can play first.

## For browser tests

While Nostr travel is on, a hidden element is always on the page: `[data-testid="world-travel-status"]`. It carries:

| Attribute | Value |
|---|---|
| `data-travel-session` | `on` / `none` |
| `data-travel-place` | a World id |
| `data-travel-here` | `true` / `false` |
| `data-travel-status` | `loading` / `ready` / `unreachable` / `none` |
| `data-travel-phase` | `idle` / `checking` / `signing` / `publishing` / `arriving` / `failed` |
| `data-travel-reason` | set on failure |
| `data-travel-change` | `historical:<n>` / `live:<n>` |
| `data-travel-location` | the event id |
| `data-travel-resolution` | `pending` / `cached` / `confirmed` / `unreachable` / `none` (no session) |
| `data-travel-view` | `looking` / `here` / `away` / `coming` |
| `data-travel-at`, `data-travel-form-at` | while `arriving`: when the arrival starts and when the body has formed (ms) |
| `data-presence-status` | the presence status |
| `data-presence-there` | set when another World shows recent play |

Other selectors:

- the classic actor: `[data-testid="blobbi-actor"][data-presence]` (`present`, `depart`, `absent`, `arrive`);
- the card: `world-presence-away` (with `data-place` and `data-travel-phase`), `world-presence-call-home`,
  `world-travel-retry`, `world-presence-detail`, `world-presence-line`;
- the cues where it stands: `world-travel-looking` (place not known yet), `world-travel-coming` (a move here under
  way); in the room they sit in `room-blobbi-cue`, placed at its feet each frame;
- unreachable relays: `world-travel-unreachable`, its button `world-travel-refresh`;
- the presence choice: `active-presence-toggle`.

## Tests

- `WorldTravel.test.tsx` runs end to end through the router, on two in-memory relays at the travel urls, with
  real signatures. It covers:
  - away at load: shown away first (no departure replayed), then the opening's one move home (`from` the World it
    was in) and one arrival; already home publishes nothing on load, presses or re-renders;
  - once per page: re-renders, remounts of the hook, a refresh, relay updates, focus and visibility toggles publish
    no second event; a Blobbi switch gets its own one move; a tab opened hidden acts on first visibility; a page
    that opened unreachable moves nothing later by itself, and Call home works;
  - a signer that refuses: nothing published, said so, never asked again by the page; Try again publishes one;
    a signer that never answers publishes nothing;
  - unreachable relays on opening, then Try again without a second signature; a reload during a move;
  - relays disagreeing: the newest wins and the move names it as `prev`; a forged event changes nothing;
  - leaving for the Island (the Worlds sheet): one 31126 naming the Island, published from here before
    `window.location.assign` is called with the plain URL (no fragment); refused at the door or no relay accepting:
    the page still goes and nothing is left on the relays; `departTo` alone: already there, away, a hanging signer;
  - loading (M16.1): a fresh device never shows it home before the answer (Pixel, home, never travelled), relays
    failing and relays never answering (the timeout), a kept location shown at once, presses while looking, who
    starts unknown, the room both ways (with and without its entry arrival);
  - the call then the arrival: the calling cue until the arrival, `formAt - at` = 550 ms, one arrival;
  - another device taking it (a live departure), and nothing pulling it back by itself;
  - the departure waiting for the home's moment;
  - eggs and sleepers;
  - an extension never asked on load, on re-render or by the presence timer;
  - presence off by default and on only while played;
  - signed out;
  - the place never kept in a cookie;
  - travel off (the default build): the Blobbi home whatever the relays or a kept location say, no travel read, no
    signature, nothing published, in the classic home and the room;
  - the room both ways.
- `world-travel-departure.test.ts` covers the shared module without a page: `departTo` (one event, `from` and
  `prev`, already there, not confirmed, refused, the bounded sign timeout, read-only, wrong account, a slow signature
  re-read and `stale`, unreachable relays, one move at a time, the kit's lock name), `autoArrivalDecision` and
  `ArrivalIntent`, and the old hand-off leftovers dropped.
- `travel-mode.test.ts` covers the switch.
- The protocol's own tests are in blobbi-kit.

## Accessibility (M16.2)

- **The cues are decoration.** `TravelCue` ("looking", "coming") is
  `aria-hidden`. The room draws it inside its `aria-hidden` 3D anchor layer,
  where a status could never be heard.
- **One live region speaks instead.** `TravelAnnouncer` is a visually hidden
  `role="status"`, `aria-live="polite"`, `aria-atomic` region, portalled into
  `document.body`, so no `aria-hidden` ancestor can silence it. It is mounted
  by both the classic home and the room. Test id: `world-travel-announcer`.
- **It speaks only on a change:**
  - "Looking for Brook…", only if the first look lasts more than 800 ms;
  - "Brook is in Blobbi Pixel.";
  - "Calling Brook home…";
  - "Brook is here.", only after one of the above;
  - the relays being unreachable.

  A plain load with the Blobbi home says nothing, and re-renders repeat
  nothing.

## 2026-10-19: opening a world is the trip, and nothing kept believed

- Opening the home brings an away Blobbi here by itself, once per page load
  (`world-travel-departure.ts`: `autoArrivalDecision`, `ArrivalIntent`), and
  leaving for a world moves it there from here before the page goes
  (`departTo`). The earlier rules are gone: no interaction counting
  (`followAfter`, `session.interact`), no signed hand-off in the URL fragment
  and no destination-side publication of an origin-signed event. An old link's
  `#blobbi-travel=` fragment and the `blobbi:world-travel:handoff-used:v1`
  storage are dropped unread on load (`main.tsx`).
- On Nostr the Blobbi starts unseen until the relays answered
  (`useTravelStartsUnseen`; the sync stands aside while the place is only
  `cached`), and the room's arrival on entry waits for the first look's
  answer, not for a kept location: a kept "home" may be stale after a trip.

