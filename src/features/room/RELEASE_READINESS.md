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
