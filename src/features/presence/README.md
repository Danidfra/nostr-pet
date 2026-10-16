# World presence v1: where the Blobbi is, across the Blobbi apps

**Status: implemented, local to one browser.** The Blobbi home (this app) and
Blobbi Pixel agree, on the same browser, on which app the player's Blobbi is in.
Nothing is published to Nostr, no new event kind exists, and no identity, signing,
companion or inventory protocol is changed.

## What the player sees

- Playing in Blobbi Pixel (a key or a tap there) takes the Blobbi to Pixel. In the
  home, it departs with the teleport's own journey: "Brook hopped over to Blobbi
  Pixel!". Then a small card says "Brook is playing in Blobbi Pixel", with a
  **Call Brook home** button. The care dock and the poke wait meanwhile.
- Playing in the home again (any press or key, or the button) brings it back with
  the arrival: "Brook is back home!". In Pixel it departs: "Brook went home".
- A Pixel tab that is closed gives the Blobbi back at once. A Pixel tab left hidden
  or idle stops renewing its lease, and the Blobbi drifts home within about 45 s.
- An egg and a sleeper never travel: they stay on the nest or in the bed.
- The Blobbi never leaves in the middle of the home's own moment (care in flight,
  a ceremony, the hatch theatre, a bath, medicine, an item on its way). It leaves
  once the moment ends. A hidden page plays its journey when it is seen again.
- Signed out, presence turned off, cookies refused, or the other app on another
  site: the Blobbi is home, exactly as before.

## The model (`world-presence.ts`, pure, shared with Pixel)

There is one short **lease** per account: `{ app, tab, at, exp }`.

1. No live lease means the Blobbi is **home**. A lease lapses on its own, so a
   Blobbi can never be stranded.
2. Only a **real input** claims the lease: a trusted `pointerdown` or `keydown`,
   in a visible and focused page. Focus, visibility, a timer or a remote change
   never claims. This keeps the teleport README's rule that "focusing a tab is not
   intent".
3. The holder renews its lease every 15 s while in **active use**: visible,
   focused, and an input within the last 5 minutes. Another tab of the same app
   may take the renewal over, and the place does not change. The home never
   renews, because a lapse already means home.
4. **No flicker**: a claim within 4 s of another app's claim waits, and a page
   claims at most once every 2 s.
5. A page that goes away (`pagehide`) gives back the lease it holds.

`reconcile()` turns "where it is" plus "what is on screen" into a journey:

- an arrival never waits;
- a departure waits while the app is busy, and for 1.5 s after a page becomes
  visible, so an input there can reclaim first;
- a hidden page waits until it is seen.

`presence-page.ts` (shared with Pixel) is the browser half. It holds the cookie
store, the page (listeners, a 1 s poll while visible and 5 s while hidden), and
`syncPresence`, which drives any `{ state, enter, leave }`. Here that is the
teleport controller (`usePresence`); in Pixel it is `LiveWorld.leaveBlobbi` and
`enterBlobbi`.

The test vectors in `world-presence.vectors.json` are identical in both repos.
Keep `world-presence.ts`, `presence-page.ts` and the vectors byte-identical with
Pixel's `src/game/` and `tests/` copies, the same way as choice order v1.

## Why a cookie (and not Nostr, a frame, or 31634)

- **Kind 31634 (game item placement)** is a durable, complete-state document. Its
  spec says that "real-time movement is explicitly out of scope … a state
  document, not a movement channel". Presence is neither an item nor durable, so
  31634 is not reused.
- **31124 / 1124 / 11125** are the player's real data. Writing presence there
  would churn it, and on replaceable events it would race with every other app's
  writes. `current_companion` stays the companion choice, and presence never
  touches it.
- **Nostr in general**: presence is a location signal (a privacy concern) that
  changes often. It would need signatures, which would mean prompts with a NIP-07
  extension. Not by default. See the proposal below.
- **A shared frame or `postMessage` hub**: the home sends `frame-ancestors 'none'`
  and `X-Frame-Options: DENY`. A hub would need those security headers changed
  for a path. Not done.
- **A first-party cookie** is the one store that browsers share between these
  apps with no service, frame or header change:
  - cookies are scoped by host, not port, so `127.0.0.1:8080` and
    `127.0.0.1:5177` share it in development;
  - `Domain=blobbi.pet` shares it with every `*.blobbi.pet` app in production;
  - it holds only `1.<app>.<tab>.<at>.<exp>`, with no key and no pubkey (the
    cookie's name carries an 8-hex FNV hash of the pubkey);
  - its `max-age` ends with the lease, so a lapsed one leaves the browser and stops
    riding on requests.

  This is not the "cookie on `.blobbi.pet`" that `features/worlds/README.md`
  rules out: that one would carry a key.

**Production note (a decision for later, nothing deployed):** cross-app presence
works in production only once Pixel is served on a `*.blobbi.pet` host, because
`pixel.blobbi.pet` does not answer yet. Vercel previews (`*.vercel.app`, a public
suffix) share nothing across apps, though each app's own tabs still agree.

## Proposal, not implemented: presence across devices

Two devices share no cookie, so today each device decides alone. If the ecosystem
wants a phone and a laptop to agree, a new kind would be needed, and that must be
approved first. One option:

- Kind: an **ephemeral** kind (20000–29999, relays do not store it) plus NIP-40
  `expiration`, so nothing durable is written. Content `{ v:1, app, at, exp }`,
  with tags `["b","blobbi:ecosystem:v1"]` and `["expiration", …]`. No `d`, no
  position, no room.
- Sent only on a claim, never per renewal tick, and only by an app that can sign
  silently (a vault or session key). A NIP-07 extension would prompt on every
  claim. Session keys are a signing-protocol change and need approval.
- Opt-in, off by default, because it is a location signal.
- Alternative, with no new kind: Blobbi Island's 31950 already carries presence,
  but it is Island's (`t=island:<id>`, a position, addressable). Reusing it for
  Pixel would change its meaning for Island's readers.

## Turning it off

`localStorage['blobbi:world-presence:v1'] = 'off'` turns presence off in that
browser, in both apps. Tests turn it off globally (`presence-switch.ts`, the same
import-free seam as `daily-xp-switch.ts`), and the presence suites turn it on.

## Tests

- `world-presence.test.ts`: the shared vectors (codec, account key, place,
  decide, reconcile), plus whole stories. Pixel takes it; an active Pixel keeps
  it; an idle or hidden one lets it lapse home; closing gives it back. Clicking
  back and forth moves it at most once per 4 s. Two Pixel tabs never move it.
  Pages with no input never write.
- `presence-page.test.ts`:
  - the page and the sync on a pretend browser (one clock, several windows);
  - only trusted presses claim; hidden and unfocused pages never do;
  - renewal and lapse; release on `pagehide`; the min-stay;
  - two tabs; dispose;
  - the cookie's attributes and domain, jsdom's real jar, a refusing browser, and
    a foreign value;
  - the departure that waits for busy and for the grace; a hidden page's journey
    on show;
  - reclaiming within the grace with no departure first.
- `WorldPresence.test.tsx` (end to end through the router):
  - the classic home: away at load, Call home, Pixel taking it while open, a
    lapse drifting home, an egg, the off switch, signed out;
  - the 3D room: away at entry with no arrival, then Call home; Pixel taking it.
  - Nothing is ever published.
