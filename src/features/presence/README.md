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
  signed or published while looking (the kit asks nothing of the Blobbi while `pending`, and `interact` ignores it).
- **The player's act: three interactions, or Call home.** Either brings it home with one signed World Location:
  - **playing here while it is away**: each trusted press or key in a visible, focused page is
    `session.interact({ repeat })`. The **third** within a rolling 20 s starts the move (`travel()`, casual).
    Inputs under 1 s apart are one gesture and count once; a held key's auto-repeat (`KeyboardEvent.repeat`) never
    counts; a script's (untrusted) event, a load, a timer, a re-render, a focus or a visibility change never is an
    interaction at all. After the first one counted, the away card says "Brook noticed you playing here…" (one line,
    no progress bar), until the count expires;
  - the away card's **Call home** (explicit, at once), which is marked `data-world-travel="explicit"` so a press on
    it is not also counted.

  Presses inside a sheet or a menu (`[data-overlay="true"]`) or inside `[data-world-travel="ignore"]` never count.
  Eggs and sleepers stay home: their presses are activity only. A Blobbi just moved elsewhere (under 5 s ago) is not
  pulled straight back by casual play (`contended`, nothing signed); Call home still works. A refusal suspends casual
  following for the session (`snapshot.follow.suspended`) until an explicit move succeeds. A Blobbi switch, an
  account switch or a sign-out is a new session: the count starts over.
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
  - A refusal or a failure is said, with **Try again**. Casual presses do not ask again for a minute.
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
| `data-follow-count` | interactions counted toward following the player here |
| `data-follow-suspended` | `true` after a refusal (casual following off for the session) |
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
  - away at load with no departure;
  - Call home publishing exactly one 31126, then arriving, and nothing more when the Blobbi is home;
  - three interactions anywhere versus an ignored area;
  - following the player (M16.1): the first and second interactions do not move it, the third does; one gesture
    counts once; an expired window starts over; Call home at once; a key's auto-repeat and a script's events never
    count; no input never signs; contended right after another device's move; a Blobbi switch, a sign-out and a
    sign-in start the count over;
  - loading (M16.1): a fresh device never shows it home before the answer (Pixel, home, never travelled), relays
    failing and relays never answering (the timeout), a kept location shown at once, presses while looking, who
    starts unknown, the room both ways (with and without its entry arrival);
  - the call then the arrival: the calling cue until the arrival, `formAt - at` = 550 ms, one arrival;
  - another device taking it (a live departure);
  - the departure waiting for the home's moment;
  - eggs and sleepers;
  - a refused signature, then the cooldown;
  - unreachable relays, then Try again without a second signature;
  - a reload during a move;
  - relays disagreeing, and a forged event;
  - an extension never asked on load, on re-render or by the presence timer;
  - presence off by default and on only while played;
  - signed out;
  - the place never kept in a cookie;
  - travel off (the default build): the Blobbi home whatever the relays or a kept location say, no travel read, no
    signature, nothing published, in the classic home and the room;
  - the room both ways.
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
