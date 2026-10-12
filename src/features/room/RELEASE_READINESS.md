# The 3D room: release readiness (M9, 2026-10-11)

The room stays **opt-in**. The classic home is the default and is not
removed. Nothing about the room (position, decoration, quality,
appearance, sound) is published to Nostr. See `NOSTR_PERSISTENCE.md`.

This document records what M9 checked, what it fixed, and what is still
open, by severity. "Verified" means a test or an inspection in a desktop
browser, including phone-sized frames. **No real phone has been tested
yet.** The steps for that are at the end.

## Fixed in M9

| Area | Was | Now |
|---|---|---|
| Landscape phone (568×320, 700×330) | the header, HUD and dock filled the height, so no room or Blobbi was visible | the HUD is one row, and the header, dock and decorating tiles are a size smaller; the room reaches up behind the HUD |
| 320 px phone | the room name wrapped onto two lines | one line (the HUD is a size smaller under 360 px) |
| Settings on a short screen | the panel ran off the bottom | it scrolls inside the screen |
| Touch | a sideways stroke on the Blobbi also changed room | petting never changes room; a swipe follows its own finger |
| Touch | a decorating drag cancelled by the system saved the move | the piece goes back |
| Touch | a long press on a dock picture opened the iOS callout, which cancelled the drag; double tap zoomed | neither happens in the room |
| Touch targets | room and carousel arrows, back, settings, decorate, note close: 28–38 px | a hit area of at least 44 px; the drawing is unchanged |
| Petting | stopped from outside mid-stroke, the affectionate face stayed | it is cleared, and no timer outlives the room |
| Lost WebGL context | the rebuilt scene put the Blobbi at a fixed spot, possibly inside furniture | it stands where it was, and the room does not fold in again |
| Hidden tab mid-transition | on return, every remaining sound played at once | the scene ends when the page hides |
| Reload or close | the last resting place could be lost (only written on unmount) | written when the page is hidden or closed |
| Audio | the AudioContext kept running while hidden | suspended while hidden; resumed by the next sound or gesture |
| 3D failure | a renderer that could not be created was retried | no retry this visit; a short note explains it |
| 3D failure | a stalled load could leave the room loading for ever | after 15 s the simple room is shown, with a note |
| 3D failure | a 3D Blobbi that could not be built crashed the page | the appearance switches to 2D, with a note |
| Shadows | quality switched to `PCFSoftShadowMap`, which three 0.186 removed (it warned, fell back, and recompiled every material) | levels differ by shadow map size, or no cast shadows |
| Overlay pass | the second canvas drew every frame | only while a DOM-drawn Blobbi is on screen |
| StrictMode (dev) | the 3D model was disposed while still in use | disposal is deferred, and cancelled on a remount |
| Keyboard | several room controls showed the browser's default outline | the app's focus ring |

## Open issues, by severity

### Major
- **No real-device validation.** iOS Safari's WebGL memory limits,
  context loss on backgrounding, and thermal throttling on budget Android
  have only been reasoned about and tested with fakes. Run the phone
  protocol below on at least one older iPhone (A12 or earlier) and one
  budget Android before considering the room as a default.
- **Decorating in landscape is cramped.** At 568×320 the room being
  decorated is about 115 px tall. It is usable, but portrait is the
  intended way to decorate.

### Minor
- **Safe areas are latent.** `index.html` has no `viewport-fit=cover`, so
  every `env(safe-area-inset-*)` is 0, and Safari keeps the page inside
  the safe area. This is correct today. If `viewport-fit=cover` is ever
  added, the header needs a top inset and the landscape HUD and dock need
  left and right insets.
- **The first room can be marked seen before its build-up is watched.**
  A 1.6 s timer marks it seen even while the 3D room is still loading, or
  in 2D. The build-up is then not shown on a later visit.
- **A slow first download** (three.js, about 790 kB uncompressed in the
  room's chunk) on a poor connection can hit the 15 s load timeout. The
  simple room is then shown for that visit.
- **Auto quality never raises itself** (by design, to avoid switching back
  and forth). A device that was slow once stays at the learned level
  until the player picks a level by hand.
- **The development previews' timers** (feeding, petting) are not cleared
  on unmount (development only).
- **A white screen on Chrome for Android** when triggering animations was
  reported from a real phone (2026-10-11) and could not be reproduced in
  desktop Chrome (the extension's tab stays hidden, so frames and timers do
  not run as on a phone; every scene, journey, face, feeding, petting,
  rapid switching and 2D/3D switching was driven without an error). A whole
  white page is what React does when a render or commit throws anywhere
  with no boundary: the root unmounts. The room now has one
  (`RoomErrorBoundary`), the page's uncaught errors and rejections are kept
  and copyable in **Dev Tools → Performance**, so the next phone run can
  name the cause. A code review of every render- and commit-phase path the
  dev tools reach found three concrete risks, all fixed: the paper textures
  threw `Canvas 2D unavailable` inside the room-change effect when the
  browser gave a new canvas no 2D context (Chrome does, once its canvas
  memory budget is spent; Safari does not), which on a phone after enough
  rooms and journeys is exactly a white page (now: a flat-coloured surface
  and a warning); a held scrubber frame drew the whole three.js frame
  synchronously inside an effect (now: a failed frame is reported and left
  undrawn, the animation-frame path untouched); and a scene forced toward
  the room already under way stayed armed and started the next real
  navigation held, freezing the room (now dropped). Whether the first of
  these is the phone's white screen is likely but unconfirmed: it was
  reasoned from code, not reproduced.
- **The iPhone's real error (Chrome for iOS 155, iOS 26.6.2, 2026-10-11):**
  `NotFoundError: The object can not be found here` from `insertBefore`
  while React placed the kitchen's `Refrigerator` icon, with the room
  error boundary catching it. Cause: the room switcher rendered the icon
  beside the room's name as a bare text node. When the room changes, the
  icon is a different component, so React inserts the new one "before" its
  next sibling, that text node. Something outside React had moved the
  text node out of the span (Chrome's page translation does exactly this:
  it moves text into `<font>` elements; the page is `lang="en"`, so a
  browser set to translate English does it on load). Inserting before a
  node that is no longer a child throws, mid-commit. Fix (`RoomShell.tsx`,
  `RoomHeader.tsx`, `RoomBlobbi.tsx`): text that sits beside an element
  React swaps lives in its own `<span>`, so the insertion reference is an
  element a translator leaves in place. `RoomTranslated.test.tsx` does
  what the translator does (every text node into a `<font>`) and then
  changes rooms, switches scenes rapidly, starts journeys and opens and
  closes the dev tools; before the fix it failed with the same
  `NotFoundError`. The dev tools themselves are `translate="no"`. The
  error reports now say whether the page was translated or rewritten
  (`<font>` count, `translated-ltr` class), so the next report settles it.
- **Invisible Floor played as the quick change.** `RoomScene.tileFree`
  (which the scene's walk checks along the way to an open edge) answered
  "blocked" for a point on a tile boundary (two nearest tiles at the same
  distance; the walk's samples land on boundaries) and for the Blobbi's own
  tile (its actor counted as an obstacle). From the middle of every room,
  where the Blobbi lands after each change, both edges read as blocked and
  the gag fell back to the quick change, as it was designed to do when
  furniture blocks every way. Now the tile under the point is asked
  directly, furniture only (`RoomScene.tileFree.test.ts` measures every
  default room: the gag from every free tile, the fallback kept for a
  truly blocked room). The choreography itself is unchanged since its
  approval.

### Performance (measured, desktop Chrome, adult V3, care room)

| level | canvas pixels | main thread per frame | draw calls | triangles |
|---|---|---|---|---|
| high | 960×1074 (1.03 M) | 0.32 ms | 67 | 49.5 k |
| balanced | 800×895 (0.72 M) | 0.21 ms | 67 | 49.5 k |
| low | 640×716 (0.46 M) | 0.14 ms | 67 | 49.5 k |

Triangles and draw calls do not change with quality on purpose: the
Blobbi, its face and the furniture are always whole. What a level saves
is GPU work per pixel: fewer pixels, a smaller or no shadow map, fewer
lamps, fewer motes. GPU time cannot be measured from the page; the phone
report's frame percentiles are the measure.

Idle rendering is 30, 24 or 15 frames per second depending on the level,
and nothing is drawn in a hidden tab. Repeated room changes, teleports,
decorating, feeding and petting left the geometry, texture and program
counts flat (checked in M8 and again in M9).

### Differences from the classic home
- The room needs WebGL for furniture and decorating. Without it, the
  Blobbi, needs, carousel, care and petting all work, and decorating says
  why it cannot.
- V1/V2 art and eggs are drawn in 2D in the room. This is by design.

## Recommendation

Keep the room opt-in for now. It is functionally complete, recovers from
every 3D failure we could produce, and stays local-only. The remaining
risk is real phones: GPU memory, thermal throttling and Safari's context
loss. Make the room the default only after the phone protocol below has
been run on an older iPhone and a budget Android with these results:
- the Auto level settles at balanced or above;
- busy frames have a p95 under 33 ms;
- no fallback note appears in ten minutes of normal play, with
  backgrounding.

## Phone protocol

What the first attempt (2026-10-11) ran into, so it is not run into again:

- **The fixture needs the dev-tools flag.** A server started without
  `VITE_BLOBBI_DEV_TOOLS=true` ignores `?fixture=` and opens the real home,
  which then looks for the signed-in account's Blobbi. A dev build now
  says so in a banner instead of staying quiet (`fixture-refused` in
  `App.tsx`).
- **A real account cannot read relays over plain HTTP on a LAN address.**
  `http://192.168.x.x:8080` is not a secure context; Safari (and Chrome)
  withhold `crypto.randomUUID`, which nostrify's `NRelay1` uses to name
  every subscription; the pool swallowed the error and the read never
  ended: "Looking for your Blobbi…" forever. The home pool now refuses
  such a page at once, with the cause and the way out, and any read no
  relay answers in 15 s ends in an error with a retry
  (`src/lib/relay-transport.ts`, `src/lib/home-pool.ts`). The fixture world
  is in memory and is not affected. For a real account on a phone, serve
  HTTPS (README, "Testing on a phone").
- **The clipboard is withheld there too.** "Copy report" says so and
  leaves the report in the text box; **Select all** selects it for the
  long-press copy.

1. On the computer, with `VITE_BLOBBI_DEV_TOOLS=true` in `.env.local`, run
   `npm run dev` (the server binds every interface) and note the
   "Network" address. Check the flag reached the page:
   `curl -s http://localhost:8080/src/App.tsx | grep DEV_TOOLS`.
2. On the phone, on the same Wi-Fi, open
   `http://<that address>:8080/room?fixture=adult-v3&perf`
   (and `baby-v3` for the baby). The simulated Blobbi shows at once, with
   no account; a yellow banner means the flag is off.
3. Leave it idle for 10 s, then tap **Dev Tools** → **Performance** →
   **Record 10 s**, and close the sheet (the recording runs on; the corner
   shows the countdown). While it records, walk the Blobbi around, change
   rooms twice and pet it.
4. Open **Dev Tools** → **Performance** again and tap **Copy report**; on a
   plain-HTTP address the clipboard is withheld, so tap **Select all** and
   long-press the text box to copy it, and paste it somewhere. If the pill
   shows **⚠ n**, the page had runtime errors: the same view lists them with
   **Copy errors**; paste those too.
5. Repeat with Graphics set to High, Balanced and Low (**Dev Tools** →
   **Visual**, or the room settings).
5b. **Dev Tools** → **Animations**: tap each scene (the sheet closes to
   watch; the pill names what plays and reopens the tools), then
   **Feeding** and **Petting**; **Teleport**: **Leave**, **Arrive**,
   **Round trip**. If the page ever goes white, note the last tap; if the
   room is replaced by "The room hit an error", tap the details box, copy,
   and paste it along with the report.
6. Put the browser in the background for 30 s, come back, and check
   that the room returns (on iOS, possibly after a short fallback) with
   the Blobbi where it was.
7. Turn the phone on its side, then decorate a piece and save it.
8. The camera (2026-10-11): upright, the whole floor and the Blobbi are on
   screen with only the walls' far ends past the edges; pinch in and out
   (the Blobbi is not petted and the room does not change meanwhile),
   then room settings → **View**: −, +, **Reset**; change rooms and turn
   the phone with a zoom set: the factor stays, nothing jumps or is cut.
   Pinch to the nearest the room allows: the camera stays outside the
   walls.


## M10: living room and interaction polish (2026-10-11)

What changed, and what it means for the default:

- **The room has what the classic home has.** The header's name opens the
  Blobbi's details (`RoomBlobbiSheet`: condition, progression, lifecycle
  with hatch and evolve through the same kit transitions, the other
  Blobbis, the whole inventory); the ☰ opens the game menu (`MenuSheet`,
  with Classic home in place of the room tile); worn accessories draw on
  the 2D Blobbi; the streak pill and the connection chip are in the header;
  the first egg hatches by itself as on the classic home. What the room
  still does not have: the classic home's hatch *ceremony* (the egg
  cracking beat by beat; the room's reveal is a face, a hop and a sound),
  the door to the Island (the menu's tile stands in), and worn accessories
  on the 3D model.
- **Food and a ball are things in the room** (`room-props.ts`, the scene's
  props, `ball-physics.ts`), and every scene runs through one runner
  (`room-interaction.ts`, `useRoomInteractions`) that is cancelled by a
  change of room, a teleport, another item, a hand on the Blobbi or the
  page put away, with everything given back. The write adapter
  (`useRoomCare`) no longer choreographs.
- **A room is seen only once built in front of the player**
  (`RoomScene.onIntroDone` → `onRoomBuilt` → `markSeen`); the earlier 1.6 s
  timer is gone (the minor issue above is closed).
- **The voice** has vibrato and per-playing variation; new sounds for
  curiosity, a bite, satisfaction, play and the ball. Rendered offline
  (`scratchpad/voice-levels.mjs`): no recipe peaks above 0.05 of full
  scale, no fundamental above 2.2 kHz. **Whether it sounds right is for a
  listener to say**; nothing here was heard.

### Ready to be the default?

**Not yet; it stays opt-in** (`DEFAULT_EXPERIENCE` in
`src/lib/home-experience.ts` is the one flip). What is missing is not
code:

1. **No real-device performance data.** The iPhone run reported the room
   working; no performance report (Dev Tools → Performance → Record 10 s)
   was pasted back. The criteria above (Auto settles at balanced or above,
   busy p95 under 33 ms, no fallback note in ten minutes) are unmeasured.
   The props add a sphere, a plate and one small texture; the ball is
   stepped only while it rolls.
2. **Visual and audio approval** of the feeding, the ball game, the first
   visit's build and the voice (below).
3. **The hatch ceremony.** A first Blobbi's egg hatching in the room is a
   reveal, not the classic home's ceremony; whether that is acceptable for
   a new player's first minute is a product call.

### Phone protocol, continued

9. **Feeding (2026-10-11):** in the kitchen, tap **Give** on the apple (or
   drag it onto the floor, farther away). A dish with the apple appears,
   the Blobbi looks at it, walks to it, is eager, then eats it in four
   bites (the apple loses a piece with each, the chew is heard), "mmm", the
   chips, the dish goes, a glance at you. Change rooms mid-meal: the room
   changes, nothing is left behind, the dock is usable; the feed counted
   once.
10. **The ball:** in the living room, tap **Use** on the ball. It drops in
    and bounces; the Blobbi comes, nudges it (a bop), watches it roll,
    chases it, three times; then glad. Tap the ball afterwards: it rolls,
    the Blobbi looks. Pet the Blobbi while it walks to the ball: the walk
    stops, the ball goes back, nothing is written.
11. **First visit:** a room never visited builds itself (floor, walls, the
    furniture popping up). Change rooms *before* it finishes: next time the
    room builds again. Let one finish: next time it comes back quickly.
    Put the app in the background mid-build: on return it builds again
    from the start.
12. **Sound on:** curious "hmm?" when something is set down, a chew per
    bite, "mmm" after, the purr while petting, chirps and bops in the ball
    game. Nothing loud, nothing the same twice.
13. **The header:** the name opens the details sheet (Items inside), ☰ the
    menu with **Classic home**.


## M10.1: food and toy polish (2026-10-11)

- **The food is modelled** (`scene/food-models.ts`): apple, burger, pizza
  slice, cake slice, sushi (two nigiri) and the energy drink, each a few
  primitives in flat paper colours, chosen by the official item's `d`
  (`FOOD_MODELS`); a food with no model (a partner's produce) keeps its
  picture on the plate. Bites are clipping planes, one per bite, kept from
  the start and moved into place (no shader recompile mid-meal): the
  apple shows white flesh where a bite was, the burger its layers, the
  slices shorten from the tip, the nigiri go half at a time; the drink
  shrinks sip by sip. Crumbs come out on the plate; the food jolts a
  little with each bite; the last bite leaves the plate, which goes.
- **The overlap is fixed at the approach** (`RoomScene.standClearOf`): a
  Blobbi coming to a thing with a size stands its own reach plus the
  thing's radius plus a gap away from it, on the far side from the camera
  when that tile is free (the thing in front of it), else toward where it
  came from, else round the sides, never on the thing's tile; the walk's
  last step is that exact spot. A used item is set down 2.05 tiles in
  front (an adult's reach and a dish), so Use needs no step back. The old
  approach (the bed, with no size) is unchanged; the 2D home is untouched.
- **The ball is put away** (`useRoomInteractions`): after a game it lies
  in the room; a tap is a free game (two nudges, no write, no chips);
  untouched for `TOY_IDLE_MS` (28 s) the Blobbi walks to it, picks it up
  (it lifts and shrinks into its hands, `pickup`, a glad hop) when it can
  walk, else it fades; a change of room or decorating clears it at once;
  a tap or a game restarts the clock. The physics are untouched.
- **Cost:** a dish is a plate, a rim, six crumb discs and the model's 5–14
  meshes, one standard material per colour; a ball unchanged. Nothing
  simulates while nothing moves. Draw calls per dish: about 10–20 while
  it is on the floor.

### Phone protocol, continued

14. **The foods (2026-10-11):** in the kitchen, give each of the six: a
    red apple with a stem and leaf, a burger with its layers, a pizza
    slice with pepperoni, a slice of cake with a cherry, two nigiri, a blue
    can with a bolt. Each sits on a plate (the can on the floor) in front
    of the Blobbi, which stands behind it, never on it; each bite takes a
    piece out of it (the apple shows its flesh), crumbs appear, the last
    bite leaves the plate, which goes. Try a baby fixture too
    (`baby-v3`): it stands nearer.
15. **The ball after the game:** leave it half a minute: the Blobbi walks
    to it, picks it up and it is gone. Tap it before that: another game,
    without chips. Change rooms with it lying there: gone.


## M11: first impressions, the hatch theatre, the room as the home (2026-10-12)

### What changed
- **The room is the home.** `DEFAULT_EXPERIENCE` is `room`: a signed-in
  player with a Blobbi opens in the room; signed out or with no Blobbi,
  `/room` sends them to the way in at `/`. The classic home stays in the
  repository and reachable: the room's menu has **Classic home**, its own
  menu leads back, and a player who switched **Open in your room** off
  keeps it. The room's header has no back arrow any more (one home).
- **The welcome** (`onboarding/WelcomeStage.tsx`, `welcome-cast.ts`): a warm
  sky, three Blobbis drawn by the kit's renderer from fixed made-up keys
  (never signed or published), one line of what Blobbi is, **Adopt my
  Blobbi** and **I have an account**. Nostr is explained only under "How
  does it work?". A page that cannot reach relays (plain HTTP, no Web
  Crypto) says so here, before a key is made.
- **The key screen** explains the key as a house key in plain words, says
  there is no reset or recovery, and the checkbox says so too. A browser
  without secure randomness gets a message instead of a crash.
- **Sign-in** never waits forever: an extension or bunker that does not
  answer in 60 s ends with a message and the buttons back (`sign-in.ts`);
  a refusal reads as "cancelled".
- **Adoption** goes straight to the egg after the welcome: the real egg
  (the preview is the published event) on a lit pedestal, stirring now and
  then, wobbling when tapped. A returning player who lands without a
  Blobbi still gets the full intro.
- **The hatch theatre** (`components/HatchTheater.tsx`, `lib/hatch-theater.ts`)
  replaces the room's quick reveal: the room darkens, the egg is presented
  under a light, stirs, cracks three times (the renderer's own shell
  drawings, a crack sound each), holds still, and light gathers while the
  hatch is written. Only after the write has landed does the light clear on
  the baby (the same Blobbi from the collection), which looks left and
  right, notices the player, blushes, hops, and is welcomed home.
  The beats and the single write are the lifecycle ceremony's; the kit's
  hatch re-reads the Blobbi and refuses one already hatched.

### Reliability of the hatch
| Situation | What happens | Covered by |
|---|---|---|
| The write is refused | The egg stays an egg; the theatre says why; **Try again** writes once more; **Later** closes it; nothing retries by itself | `HatchTheater.test.tsx`, `m11-way-in.test.tsx` |
| Reload before the write | The next visit plays the theatre again; one hatch in all | `m11-way-in.test.tsx` |
| Reload after the write, before the reveal | The player comes back to the baby without the reveal; no second write | reasoning plus the hatched-elsewhere test |
| Hatched on another device | The kit refuses a second hatch ("already hatched"); the room refreshes | `m11-way-in.test.tsx` |
| Asked twice | One write (the ceremony ignores a second start) | `HatchTheater.test.tsx` |
| StrictMode (dev) | Found in the browser: the start guard blocked the remount; removed, with a regression test that failed before the fix | `HatchTheater.test.tsx` |
| Reduced motion | No rock, hop or burst; the shell drawings, faces and words, quicker | `HatchTheater.test.tsx` |

### Launch-readiness audit (findings, not claims)
Checked by building and reading the bundle, the config and the code:

- **Dev code and fixtures are not in the production bundle.** `npm run build`
  then a search of `dist/assets` for the fixture world, its names, the
  dev panel, the dev-tools flag, the room's dev tools and perf overlay,
  the 3D lab, the test pubkey, any `nsec1…` and the dev TLS variables:
  none found. `/dev` renders Not found in production. The env-contract test
  keeps the gate in place.
- **No secrets in the bundle.** No private key, no token, no source maps.
  The only keys in it are the welcome cast's three made-up public keys.
- **Randomness.** Secret keys come from nostr-tools' `generateSecretKey`
  and egg ids from the kit's `generatePetId10`; both use
  `crypto.getRandomValues`. `Math.random` is used only for animation
  choices.
- **Key storage is unchanged.** A secret-key login is kept by nostrify's
  login store in `localStorage` (`nostr:login`), as Ditto and Island keep
  it. That is plain text readable by any script on the origin; any XSS
  would expose it. This is an existing property of the ecosystem's login
  model, not new in M11, and signers (extension, bunker, signer app) avoid
  it. The tests check the key never reaches a relay payload, a filter, the
  URL or a log.
- **Console noise from the kit.** `@blobbi-kit/react`'s collection hook logs
  its query filters (public keys) and counts in production. No secrets, but
  noisy; it must be fixed in the kit, which this app does not modify.
- **Relays** baked in: `relay.ditto.pub`, `relay.primal.net`,
  `relay.nostr.band`, `relay.dreamith.to` (hints). Island link:
  `https://island.blobbi.pet`. No other environment is read in production.
- **Hosting is not described in the repo.** The build copies `index.html` to
  `404.html` (a static-host SPA fallback) but there is no host config: no
  security headers or Content-Security-Policy are defined anywhere in the
  repository. What the production host sends is unverified.
- **Bundle size:** the entry chunk is 254 kB (82 kB gzip); the room's chunk,
  with three.js, is 827 kB (235 kB gzip) and is now on the main path for
  every player with a Blobbi.
- **No real-device performance data** has been reported for any milestone.

### Remaining launch blockers
1. A real phone run of the real way in, on the production host over HTTPS,
   with a new account: welcome, key, egg, room, theatre, baby. Everything
   above is tests, fixtures and desktop Chrome.
2. Real-device performance: the room now loads for every player with a
   Blobbi; a Record 10 s report from an older iPhone and a budget Android.
3. The production host's headers (CSP, framing) and its SPA fallback,
   checked on the real deployment.
4. Visual and audio approval of the welcome, the egg and the theatre.

### Phone protocol, continued (M11)
16. **A new visitor** (a private window, the production URL over HTTPS):
    the welcome shows three Blobbis, the line, **Adopt my Blobbi** and
    **I have an account** without scrolling, also on a small phone; tap a
    Blobbi (it hops). "How does it work?" opens the Nostr note.
17. **Adopt my Blobbi:** the key screen: save the key (copy or file); the
    button stays off until the box is ticked. Skip the profile. The egg
    stands lit on its pedestal; tap it (it wobbles). Name it, **Adopt**.
18. **The room:** it opens by itself; a moment later the room darkens and
    the egg is presented: stirring, three cracks, a still breath, light, then
    the baby looks left and right, at you, blushes, hops; **Go home** or wait.
    Check the baby in the room is the same one, and there is one hatch.
19. **Interrupt it:** reload during the cracks: it plays again, one hatch.
    Turn on reduced motion: no rocking, no hops, the words carry it.
20. **A returning player:** sign in on a second device: the room, no
    onboarding. Room menu → **Classic home** works and leads back.
21. **Sign-in that does not finish:** start an extension or bunker sign-in
    and do not approve: within a minute the screen says so and lets you
    try again.
