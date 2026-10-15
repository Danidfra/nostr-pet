# Launch test plan (blobbi.pet)

A reproducible manual run before launch. Each step says what to do and what
must be true. Record device, browser, build (commit SHA) and date for every
run. **A blocker is resolved only with evidence from a run on the real
deployment.**

## 0. Before

- Build deployed to a preview URL over HTTPS (see `DEPLOYMENT.md`).
- `curl -sI https://<host>/` and `https://<host>/room`: both **200**, each
  with the CSP, `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`.
- `curl -sI https://<host>/assets/<any>.js`: `immutable`.
- `curl -sI https://<host>/assets/nope.js`: **404** (not 200 `text/html`);
  note whether the 404 carries the `immutable` cache header.
- Devices: one recent iPhone (Safari), one older iPhone, one budget Android
  (Chrome), one desktop (Chrome, Firefox or Safari).

## 1. A new visitor (private window)

1. Open the root. The welcome is a little scene, not a page: a Blobbi says
   "Oh! You're here!" (a friend and a glowing egg beside it), then "A little
   friend is waiting for you." with **Meet your Blobbi** and **Welcome back!**
   (both usable at once). **No scrolling**, in Safari with its bars showing,
   portrait and landscape; on the smallest phone the Blobbi is just smaller.
   Move the mouse or touch the screen: it looks there. Tap it three times:
   shy, giggly, overjoyed, each its own hop and line. **What is Blobbi?**
   opens a sheet (what it is, Nostr, the Island). With the OS text size at its
   largest the scene may scroll inside itself, but nothing is cut off and the
   page itself never scrolls. Reduced motion: no hops or bobbing, same words.
2. Open the console (desktop): no CSP violations, no errors.
3. **Meet your Blobbi** → the key, as a scene: the world darkens, a glowing
   key, "A little key, just for you." Before anything can be pressed, four
   short lines say it is a secret key, anyone with it can open the account,
   losing it can mean losing the Blobbi for good, and Blobbi cannot recover
   it. The key is readable; **no npub** anywhere on the way in. Nothing to
   confirm yet. **Copy key** (paste it into a password manager), or
   **Download backup file** (the screen says the browser *was asked* to save
   it: check the file is really in Downloads, and that it holds only the
   nsec), or **I'll write it down instead**. Only then: "I saved my secret
   key somewhere safe." and **Continue to my egg!**, off until ticked. On the
   smallest phones the confirmation scrolls into view by itself.
4. **No profile step.** The egg on its pedestal comes **at once, on the
   first try** (no reload, never "No Blobbi lives here yet"), drawn, with
   **Adopt** ready. On slow mobile data "Just a moment…" may show first, in
   the same world. Tap the egg (wobble). Name it, **Adopt** (tap it several
   times quickly: one egg in a Nostr client). The menu's Account has **Edit
   your profile** (nothing is published until Save).
5. The **2D home** opens (the egg on its nest, the dock below): never the 3D
   room, no choice of 2D or 3D, no loading screen in between. A moment
   later the theatre opens over it on the egg **by itself**
   (no "Ready to hatch?", no Later, no Hatch button): "Tap your egg to help it
   hatch!". Wait 10 s: nothing is written. Tap: a crack (a jolt, a flash, a
   sound), "A crack! Keep going…"; again: a bigger crack; again: the heaviest,
   "Almost there… one more!"; the fourth tap opens it: light, "Here it
   comes…", then the baby, only once the write has landed; then the 2D home,
   the baby where the egg lay, **one** Blobbi on screen, Feed / Play / Clean /
   Rest ready. A drumroll of taps: still one
   hatch. With a keyboard: the egg has the focus, Enter cracks it. **Hatch it
   for me** taps for you.
6. Reload before tapping: the theatre opens again, shell whole. Tap twice,
   reload during the cracks: the shell is whole again (never stuck cracked);
   tap it open. In the end exactly **one** hatch event (check the kind 31124
   history with a Nostr client).
7. Airplane mode just before the fourth tap: "The egg did not hatch yet…
   your egg is safe", **Try again** and **Later**. Network back, **Try
   again**: hatched, once. Or **Later**: the dock shows **Hatch!**; tapping
   it opens the theatre, shell whole.
8. Menu (☰) → **Explore in 3D**: the 3D room (desktop: the Network panel
   shows the `RoomPreviewPage` and `RoomScene` chunks only now, never
   before). Reload at the root: still the room. Room menu → **2D home**;
   reload: the 2D home. "Open in 3D" in either menu matches the choice.

## 1b. A new visitor as a guest, and saving (M14; real iPhone first)

Private window, nothing stored, a real relay set. Note times.

1. Welcome: **Meet your Blobbi!** → the egg at once (no key screen). The
   footnote says the egg stays on this device. Name it; Adopt. Expected:
   the 2D home with the egg on its nest within a second; nothing in
   Safari's console about a relay for the guest; no `nostr:login` in
   storage; `blobbi:guest:v1` present (Settings → Advanced → Website Data
   is enough to see the origin has data).
2. The theatre opens by itself; four taps; the baby. Expected: the note
   under the light reads "Keeping the hatch on this device"; never "Here it
   comes…" for longer than a blink; the baby where the egg lay.
3. Feed (the starter apple). After it lands and the home is quiet (about
   3 s): the bubble "<name> loves being with you. Want to take them on
   adventures?" → **Maybe later**. Expected: it goes; it does not come back
   this visit; the menu shows **Save my Blobbi** and the device-only line;
   no Sign out, no key, no Island link.
4. Close Safari fully; reopen. Expected: the same baby, same name, same
   colours; no welcome.
5. Menu → the worlds (3D room → globe): every open world says **Save to
   visit**; tapping one opens the save. Back out with **Maybe later**.
6. Menu → **Save my Blobbi** → **Let's do it**. The key scene: the line
   "born from this key"; the four facts; **Copy key** then the checkbox,
   then **Save <name>!**. Expected: the profile step (skip it) → the
   connecting scene, both steps ticked within a few seconds, "<name> is
   connected!" → **Back to <name>**. Expected: the same Blobbi (compare a
   screenshot from step 4), the menu now shows the account (secret key on
   this device), Blobbi Island opens from the menu and the door.
7. On another device (or Ditto / Island with the copied key): the Blobbi
   is there, same colours, same name, a baby.
8. Airplane mode, then step 6 from a fresh guest: Expected: "<step> did
   not reach the relays", the Blobbi still on the device, **Try again**
   after airplane mode is off completes it with no second Blobbi.
9. A fresh guest, egg adopted; menu → **I already have an account** → sign
   in with a key that owns a Blobbi. Expected: that account's home, the
   sheet "A Blobbi lives on this device" once, **Keep it here**; sign out →
   the guest egg is back.
10. Reduced motion on (Settings → Accessibility → Motion): steps 1 to 6
    again, faster, nothing rocks; the words tell it.

## 1c. M14.1 on a real iPhone: the controls, the room's buttons, the first minutes

Private window, nothing stored, a real relay set, sound on the phone.

1. **Meet your Blobbi!**, adopt, four taps. Expected: a crack sound at each
   tap (sound is on by default); the baby; **no flame** in the HUD yet; the
   Blobbi's details show hunger around 80, happiness 86, hygiene 88,
   energy 84, health 100.
2. Feed the apple. Expected: the flame appears with **1**; the invitation
   bubble a few seconds later; Maybe later.
3. The switch top right: **3D β**. Expected: "Your 3D room" asks first;
   **Stay in 2D** keeps the 2D home; **3D β** again goes straight to the
   room; reload at the root opens the room; the switch shows 3D in force.
   Portrait and landscape: the switch never covers the menu, the room's
   name or the needs.
4. In the room: the dock shows **Pip** (left), the carousel, **Room**
   (right). Pip opens the details; Room opens decorating; the HUD has no
   settings button. ☰ → **3D room** section (Blobbi appearance, Graphics,
   View), Sound, Home lighting, **Save my Blobbi**, **I already have an
   account**. Expected: **Save my Blobbi** opens the save scene over the
   room with Pip in the glow; Maybe later returns to the room. **I already
   have an account** opens the sign-in sheet; Close returns.
5. Kitchen (switcher ←): tap the refrigerator. Expected: the fridge opens
   over the room, the foods on its shelves, nothing cut off; tap the apple:
   the door closes, Pip walks to the dish and eats; "Fed Pip". The × and
   the dark around it close it.
6. Closet (switcher ← twice): the dock says **Coming soon**, nothing
   broken, Pip and Room still there.
7. **2D** on the switch: the 2D home; reload: still the 2D home.
8. Background the app for a minute, bring it back. Expected: at most a
   small amber dot top right for a moment, never the "Some relays down"
   pill; care still lands. Airplane mode for ten seconds: the red pill
   "Offline" with a retry only after a few seconds; back online, it goes.
9. ☰ → Sound off; reload: still off. On again: the next tap makes a sound,
   nothing bursts out all at once.
10. After saving (1b, step 6): ☰ → **Account** tile → the Account screen
    with the profile form, the key backup and Sign out.
11. The top of both homes: the name **Pip** in the middle of the screen, not
    a button; left of it **On this device** (a guest); nothing covers the
    name in portrait or landscape. Tap **On this device**: the explanation,
    **Maybe later**. After saving: **Saved to Nostr** in its place.
12. The dock's **Pip** button (bottom left, both homes): the stage track
    Egg · Baby · Adult, the numbers, **Journey**; ☰ → **Worlds** (a guest
    sees "Save to visit"), **What is Blobbi?**. No globe or map in the room's
    header; no Blobbi button in the top bar.
13. Pip's sheet → **Start evolution** (a guest too). Feed, play, bathe: the
    care card counts up; the themes and colour moments say "adventure
    elsewhere · optional". Reload: still evolving, the count kept. (The
    twenty-one actions take a while; on a second phone signed in with the
    same key the same count shows.)

## 1d. M14.2 on a real iPhone: the ceremony, the living Blobbi, the walk

Private window, nothing stored, Safari with its toolbars (the visible
viewport, not the screen), sound on.

1. **Meet your Blobbi!**, adopt "Lupa", hatch. Walk Lupa by tapping the
   floor's far side. Expected: a lively hop across the floor in about three
   seconds, the hops in step with the movement (nothing slides), no blur.
2. Tap **On this device**. Expected: "Lupa's little world", three short
   lines, "Good to know" folded, **Save Lupa** / **Maybe later**. No word
   "relay" anywhere.
3. ☰ → **Save Lupa**. Expected: "Ready to explore beyond this little
   world?", the whole screen without scrolling, Lupa breathing and blinking
   in the ring, its eyes following your finger's taps. **Let's go**.
4. The key: the four facts, the key, Copy key or Download; the confirmation
   comes into view by itself; **Save Lupa!**.
5. **What should Lupa call you?**: as you type, Lupa looks down at the field
   and looks curious; Continue: a hop and hearts; the dots show 2 of 3.
   **Back** returns with the name kept. Picture: **Skip**. A line about you:
   type a rude word, **Finish**: a friendly line, Lupa briefly displeased,
   the text still yours to edit; fix it, **Finish**.
6. Expected: "Giving Lupa a home…", then "Lupa has a new home!" with the
   celebration (sparkles, a glow, a cheer), the two lines, **Back to Lupa**;
   the top shows **Saved**.
7. Keyboard open on step 5: the field and Continue stay visible (the column
   scrolls if the screen is short), nothing is clipped. Rotate to landscape:
   the portrait steps back, the field and the button remain.
8. **3D β**: the room opens at once; after the egg's theatre (a new egg) or
   right away (a baby), "Your 3D room" greets you once, naming Appearance;
   **Let's explore**. Reload: no greeting. Tap **Lupa** in the dock →
   **Appearance** → 3D: the model; 2D: the drawing. ☰ → 3D room: Graphics
   and View only.
9. In the room: walk the baby across. Expected: quicker than before (about
   five seconds for the room), hops in step; an adult (another account)
   unchanged.
10. Settings → Accessibility → Reduce Motion on, repeat 3 to 6. Expected:
    faces and eyes still change, no hops, no sparkles, no breathing.

## 1e. M14.3 on a real iPhone: finding the Blobbi's look

Private window, nothing stored, Safari with its toolbars.

1. **Meet your Blobbi!**, adopt "Lupa", **3D β**, hatch. Expected: "Your 3D
   room" with two cards side by side, **Classic** (Lupa's drawing, marked
   **Now**) and **3D Model** (Lupa in 3D, turning gently idle), the line
   that both are the same Lupa, the checkbox, **Let's explore** in view
   without scrolling on an iPhone 14 (a small scroll on an SE is fine).
2. **Let's explore**. Expected: the dock's **Lupa** button glows and a bubble
   above it says "Want to try another look?". Nothing else is blocked: the
   carousel still scrolls. Wait: the bubble fades by itself after about
   fourteen seconds (or tap the floor: it goes at once).
3. Repeat 1 and 2 in a fresh private window, this time tap the bubble.
   Expected: Lupa's sheet opens with the **Appearance** card glowing for a
   moment under the condition, a palette icon, a **Classic** chip, the two
   options with Lupa small in each. Tap **3D Model**: the room shows the
   model, the chip says 3D Model. Close. Reload: the model, no greeting, no
   bubble. ☰ → 3D room: Graphics and View only.
4. Settings → Accessibility → Reduce Motion on, repeat 1 and 2. Expected:
   the previews hold still, the bubble and the glow do not pulse, the card
   has a plain ring.

## 1f. M14.3.1 on a real iPhone: the crash on Let's explore, and choosing in the intro

M14.3 crashed here on **Let's explore** ("The room hit an error", "Argument 1
('shader') to WebGL2RenderingContext.shaderSource must be an instance of
WebGLShader"). Desktop Chrome and WebKit never showed it: only iOS answers a
lost context with no shader. If anything below fails, connect the iPhone to
the Mac by cable (iPhone: Settings → Apps → Safari → Advanced → Web
Inspector on; Mac Safari: Settings → Advanced → Show features for web
developers; then Develop → the iPhone → the page) and copy the console.

1. Private window, adopt and hatch, **3D β**. Expected: the two cards; Classic
   has **Selected**. Tap **3D Model**: it is outlined with **Selected**, and
   Classic is not. Tap Classic, then 3D Model again: the mark follows.
2. **Let's explore**. Expected: no error card; the room shows Lupa as the 3D
   model. Open Lupa's sheet: the Appearance chip says 3D Model. Close the
   sheet (its small 3D preview goes away): still no error. Reload: still 3D.
3. Fresh private window, adopt but do not hatch, go to the room. Expected:
   the 3D card is dimmed with "The 3D model is ready once Lupa hatches.";
   tapping it says "3D Model can't be chosen yet…" and Classic stays selected.
4. If the error card ever shows: **Go to the 2D home** lands on the 2D home
   with the same Blobbi and care, and opening the app again stays in 2D.
   **Try again** is offered at most twice.

## 1g. M15 on a real iPhone: the zoom, the word about a guest Blobbi, the invitation

Safari **and** Chrome on the iPhone zoomed the page by themselves. Both are
WebKit, and WebKit zooms in when a text field smaller than 16px takes the
focus (and stays zoomed), and on a double tap where `touch-action` allows
it. The fields are 16px now, the 2D shell and the egg refuse the double-tap
zoom as the room has since M12, and the viewport covers the safe areas.
Pinch still zooms everywhere.

1. Fresh private window, as a guest: adopt (type a name in the egg's field),
   hatch with four quick taps on the egg. Expected: the page never zooms in,
   neither on the field nor on the taps; after the hatch `visualViewport`
   is at scale 1 (Web Inspector console: `visualViewport.scale`, or the
   dev lab's **Viewport probe** on a dev build).
2. Menu → I already have an account → **Sign in with a secret key**: tap the
   key field. Expected: no zoom. Cancel.
3. Save the Blobbi up to the profile's three fields: tap each. Expected: no
   zoom. The room's menu → Graphics select: no zoom.
4. Pinch to zoom in anywhere, then out. Expected: it works, and lets go.
5. If a zoom still happens, note where, and read the probe: a scale above 1
   is a zoom in (which element was focused is on the last row); a
   `scrollWidth` wider than the viewport is a zoom out to fit.
6. **The word about a guest Blobbi.** With a guest Blobbi on the phone, sign
   in to a different account (menu → I already have an account). Expected:
   the account's home, and over it one sheet, "*Lupa* is still here", in
   plain words (the Blobbi's name, no relays or keys in the main text), with
   **Keep Lupa here**, **Decide later** and a quieter **Remove Lupa from this
   device…**. Never two sheets at once: if the room's introduction is due as
   well, it comes after.
7. Tap the X (or Decide later). Reload. Expected: the sheet comes back
   (nothing was decided). Tap **Keep Lupa here**. Reload. Expected: it does
   not come back for this account. Sign out: Lupa is there, as before.
8. Sign in to the other account again, **Remove Lupa from this device…**.
   Expected: a second sheet, "Remove Lupa from this device?", with the
   warning that Lupa was never saved and a box to tick before **Remove Lupa**
   is enabled; **Keep Lupa**, the X and Escape go back to the first sheet
   with nothing removed. Tick and remove: Lupa is gone from the phone, the
   account's Blobbi and settings are what they were (Settings → Safari →
   Advanced → Website Data shows the origin still there, smaller).
9. **The invitation.** A guest with a hatched Blobbi, cared for once, who has
   played less than five minutes: no bubble. Keep playing with the screen on
   and the app in front (time in the background does not count) until about
   five minutes in all: a quiet moment later, the bubble, in the 2D home
   and in the room alike, never over a sheet. **Maybe later**: gone for about
   a day. **Don't ask again**: gone for good; the menu's **Save Lupa** and the
   "On this device" pill still save.

## 1h. M15 on a real iPhone: the bath (Track A)

A cleaning item (Soap, Bubble Bath, Shampoo, Soft Towel) is a small game now,
in both homes: the tub, the soap by dragging, the shower by holding, the towel
by dragging, then one write. Nothing is written or consumed before the towel
is done; Stop, a change of room, a reload or the other home end it with
nothing written. Use `?fixture=baby-v3&low=hygiene` (the flagged dev server) or
a real Blobbi whose hygiene is not full.

1. 2D home, **Clean → Soap**. Expected: a tub rises at the right with Lupa
   walking into it, its lower body in the water, the rim in front; the dock
   shows one card: the soap, "Rub the soap all over Lupa", a bar, **Stop**.
   Tap Lupa once: nothing happens (no foam, the bar stays at zero). Drag a
   finger over Lupa: foam appears under the finger and grows, the bar fills,
   Lupa looks at the soap, wiggles and purrs now and then. Scribble in one
   spot: the bar stops growing. Cover the body: a glad hop, a chirp, and the
   **Shower** card.
2. Hold a finger over Lupa: rain falls from the shower head to the water,
   splashes, and the foam under the stream washes off; moving the finger
   aims it. Lift the finger: nothing more washes off. Rinse everything: the
   **Towel** card. Rub as with the soap: the sheen dries where rubbed. Done:
   "All clean! Saving Lupa's bath…", then chips (+25 clean for Soap, +70 and
   +25 joy for Bubble Bath), sparkles, a hop, "squeaky clean"; the tub sinks
   away and Lupa steps out. Exactly one write (an owned item: one spend).
3. Start a bath, **Stop** during the soap. Expected: the card goes, the tub
   goes, Lupa steps out, the verbs are enabled, hygiene unchanged, an owned
   item's count unchanged. Repeat and reload mid-bath: Lupa stands on the
   floor, nothing was written.
4. With hygiene already full: **Clean → Soap** says "Lupa is already squeaky
   clean. Nothing to wash yet!" and nothing starts.
5. Airplane mode, play a whole bath. Expected: "The bath could not be saved."
   with why, **Try again** and **Stop**; nothing retries by itself; Try again
   with the network back writes once; Stop writes nothing.
6. 3D room, care room, **Soap**. Expected: Lupa walks to the tub and hops
   onto its floor; the tub is hollow with water and Lupa in it; the same
   three cards in the dock where the carousel was; the room's taps, strokes
   and swipes are off (the pinch still zooms). With Classic: foam, rain and
   the tool drawn over the drawing; with 3D Model: foam as white bubbles on
   the body, the rain and the tools as 3D objects. At the end Lupa is back
   on the floor beside the tub, the tub is itself again, the carousel is
   back. A change of room mid-bath puts Lupa on the floor first.
7. Settings → Accessibility → Reduce Motion on, repeat 1 and 6. Expected:
   faces and eyes still change; no hops, wiggles, sparkles, bobbing tools,
   falling drops or rippling water; the stages still pass by covering.
8. Keyboard (iPad with a keyboard, or desktop): focus the bath layer, the
   arrow keys carry the tool a cell at a time and rub; Space lifts it.


## 1i. M15 integrated: the one real-iPhone pass before a preview goes out

One pass on a physical iPhone, Safari first, then Chrome on the same phone,
against the integrated preview (`feat/m15-integration`). 1g and 1h hold the
detail; this is the order to run it in and what to record. Settings →
Apps → Safari → Advanced → Web Inspector on, and the Mac's Safari → Develop
→ the iPhone for the console (`visualViewport.scale`). Note the iOS version,
the model, and Safari or Chrome for every line. Nothing here was checked on
a real device yet.

| # | Area | Do | Expected |
|---|---|---|---|
| 1 | Guest onboarding | Fresh private window, Meet your Blobbi, name the egg, hatch with quick taps | No zoom on the name field or on the taps; scale 1 after; the home fits, no sideways scroll |
| 2 | Save invitation | Care once, then play about five minutes with the screen on and the app in front; also try a minute in the background | No bubble before about five active minutes (background time does not count); then the bubble in a quiet moment, in the 2D home and in the room alike, never over a sheet; Maybe later rests it about a day; Don't ask again ends it; the menu's Save still works |
| 3 | Invitation and bath | With the bubble due, start a bath straight away | No bubble during any stage, the failed-write wait or the celebration; it comes a few seconds after the Blobbi steps out (or after Stop) |
| 4 | Guest/account conflict | With a guest Blobbi, sign in to another account (both homes, and with the room's first-visit introduction still due) | One sheet at a time, the introduction after the word; the X, Escape, the backdrop and Decide later write nothing and the word is back on reload; Keep is remembered for that account |
| 5 | Removal | Remove… on the word: never saved; and once with a save that stopped before the end (airplane mode during the profile step) | A separate sheet; Remove disabled until the box is ticked in every case; the unfinished save warns that the key here may be the only one; Keep, the X and Escape go back with nothing removed; after removal the account's Blobbi and login are intact |
| 6 | Key persistence | Save a guest to an account, write the key down; reload; sign out; sign in with the written key on the same phone, then on another device | The Blobbi is there each time; the key shown at the save is the one that signs in |
| 7 | 2D bath | Clean → Soap; tap once; rub; hold the shower; rub with the towel | A tap lays nothing; foam under the finger; the page never scrolls or zooms while rubbing; one write at the end; the chips; the carousel back |
| 8 | 3D bath, Classic | Room, care room, Appearance Classic, Soap | The walk and the hop into the tub; the dock's bar where the carousel was; the needs pills hidden during the bath (also on the smallest phone available); foam, rain and tools over the drawing; the carousel and the needs back after |
| 9 | 3D bath, 3D Model | The same with Appearance 3D Model | White foam on the body, the rain and the tools as 3D objects; no crash card; the console shows no WebGL errors |
| 10 | Bath cancellation | Stop at each stage; leave the room mid-bath; switch to the 2D home mid-bath; reload mid-bath | The Blobbi out of the tub, nothing written, an owned item's count unchanged, the carousel back |
| 11 | Bath retry | Airplane mode just before the towel is done; Try again offline, then online; once, with an owned item, Stop instead and use another owned Soap | Nothing retries by itself; Try again online writes once, with a single spend; after Stop the next owned Soap finishes the earlier use (no second bath, no second spend) |
| 12 | Mobile zoom | Focus every text field (sign-in key, bunker, profile steps, egg name, graphics select); double-tap the 2D home and the egg; pinch in and out | No zoom on focus or double tap; pinch still zooms and lets go; record the probe's numbers if anything zooms |
| 13 | Account recovery | On a second browser, sign in with the saved account's key; reopen the first browser | The same Blobbi, with its care and its stage, on both browsers |

## 1j. M15 care refinement on a real iPhone: the rituals, medicine, Care

Each cleaning item is its own game now (Soap and Shampoo a wash where the
Blobbi stands, Soft Towel a towelling, Bubble Bath a soak in the tub);
medicine is a short moment; the 2D verb reads "Care". This replaces 1h's
"every item at the tub" steps. Safari first, then Chrome on the same phone;
note the iOS version, the model and the browser for every line. Use
`?fixture=baby-v3&low=hygiene` (the flagged dev server) or a real Blobbi
whose hygiene and health are not full. Nothing here was checked on a real
device yet: Playwright's WebKit is not an iPhone.

| # | Area | Do | Expected |
|---|---|---|---|
| 1 | Care label | 2D home: look at the dock | The third verb reads **Care**; the status ring for hygiene still reads Clean |
| 2 | Care carousel | Care, step through the items | The hygiene items first (Soap, Shampoo, Soft Towel, Bubble Bath, in any order), then the medicine with a thin **Health** divider above while one is in the middle |
| 3 | Soap, 2D | Care → Soap | No tub, no walk; the soap in the dock; a tap lays nothing; one finger stroke lathers a band under the finger; scribbling in one spot stops growing; most of the body covered, the rest foams by itself and the shower card comes |
| 4 | Shower | Hold a finger just above the Blobbi's head and sweep slowly | The shower head shows above the finger, not under it; the face stays visible; rain falls and the foam under it washes off after a moment, the top of the head too; lifting the finger stops it; done, one write, the Blobbi shakes itself dry, sparkles |
| 5 | Shampoo | Care → Shampoo, in both homes | The same game as the soap (the look may differ); no tub; one write |
| 6 | Soft Towel | Care → Soft Towel | A short rub where the Blobbi stands, no soap, no shower, no tub; one write, no shake |
| 7 | Bubble Bath, 2D | Care → Bubble Bath | The tub comes out; the Blobbi walks there and jumps in; a few seconds of play in the bubbles with nothing to do; it jumps out wet; only THEN the write (chips +70 clean +25 joy); a shake, the celebration; the tub sinks away |
| 8 | Rituals, room Classic | Room, care room, Appearance Classic: Soap, Soft Towel, Bubble Bath | Soap and the towel where the Blobbi stands (the tub stays a tub); Bubble Bath walks to the tub, jumps in and out; the dock's bar; the room's swipes off meanwhile, the pinch on |
| 9 | Rituals, room 3D Model | The same with Appearance 3D Model | As 8; no crash card; no WebGL errors in the console |
| 10 | Small Blobbi | The room on the smallest phone available (about 320×460), Soap | Easy to reach (the touch area is wider than the Blobbi); one or two strokes lather it; the shower held just above it rinses it |
| 11 | Stop and leave | Stop at each stage of each ritual (the soak: during the walk, the play and the jump out); change room; switch homes; reload | Nothing written, an owned item's count unchanged, the Blobbi on the floor, the carousel back |
| 12 | Failed write | Airplane mode just before the last stage (Soap) and during the soak's play (Bubble Bath); Try again offline, then online | Nothing retries by itself; no shake before the write lands; Try again online writes once (an owned item: one spend in all) |
| 13 | Medicine, 2D | Care → Bandage (health below full) | No walk, no tub, no bath bar; worried, the bandage flies to its mouth, a wiggle; then the write; relieved with sparkles, "Treated"; about one and a half seconds |
| 14 | Medicine, room | Care room, Bandage, Classic and 3D Model | The same moment where it stands; never a walk to the tub; the item never lies on the floor |
| 15 | Medicine rules | Health full: Care → Bandage; hygiene full and health low: Care → Bandage | Health full: "…is feeling fine. No medicine needed!" and nothing written; hygiene full does not stop medicine |
| 16 | Medicine failure | Airplane mode, Care → Bandage | The item stays on the floor with Try again / Put away; Try again online writes once |
| 17 | Reduced motion | Settings → Accessibility → Reduce Motion, repeat 3, 7 and 13 | Faces and eyes still change; no hops, wiggles, sparkles, flights or moving water; every stage still passes |

## 2. The room (after choosing it: menu → Explore in 3D)

1. Reload with a hatched, awake Blobbi: the room appears, then the Blobbi
   **arrives** (motes, forms, lands, "ta-da"), once. Open and close a few
   sheets: it does not arrive again. Asleep: it is simply in its bed.
2. Change rooms, feed, play with the ball, bathe, sleep and wake. The dock
   shows **three items** (the middle one and both neighbours) on a phone.
3. Settings → View says **100%** and the whole room is in view with some
   air around it (what used to be 80%). Pinch to zoom, rotate the phone;
   nothing is cut off; no horizontal scroll. A zoom chosen before this
   version looks exactly as it did.
4. The menu (☰) has no Blobbi Island entry; the globe (Worlds) does.
5. Dev tools → Performance → Record 10 s on each phone. Note fps.
6. Turn on reduced motion in the OS; reload: no rocking, no hops; the
   arrival is a short fade.

## 3. Journey

1. Open **Journey** (map icon). At the top: the Blobbonaut level with its XP
   bar, and **Today's missions** (three, each with its XP; one Ditto-only
   mission can be **Swap**ped). Chapter 1 done after the hatch; chapter 2
   current, each objective labelled Done, In progress, To do or Come back
   later. Ticks follow care: feed in the kitchen, reopen, **First meal**
   ticked (it may take up to a minute on a slow relay).
2. **Two days together:** after care today it says "Done for today! Any care
   on another day finishes it." Come back on any later day (not necessarily
   the next): ticked.
3. **Daily XP:** finish today's three. The Journey says "+N XP today" and the
   level bar moves; a Nostr client shows **one** new kind 11125 with the XP
   raised by exactly that amount. Reload, and open Ditto's Blobbi page if
   you can: no second raise from this app.
4. **Go there** on an objective moves to that room.
5. Sign in on a second device: the same ticks (the cuddle and nap marks are
   per device and may differ).
6. A chapter finished shows its card once; reload: it does not show again.
7. With a level 5 account (XP ≥ 850, from daily missions here or in another Blobbi app): **A second egg**
   shows **Adopt an egg** (also at the top of the Journey, whatever the chapter); adopting makes an egg that does **not** hatch by
   itself; its details list incubation tasks. With a lower level the button is
   absent.

## 4. Worlds

1. Open **Worlds** (globe icon). Island, Rumble and Farm say **Visit**;
   Pixel says **Coming soon** and does nothing.
2. **Visit** Island: the Blobbi looks up, waves, dissolves, then the page
   opens Island. Check the address bar holds no key, no query string.
3. Press Back: the room is there and the Blobbi arrives home.
4. Start a visit and tap **Stay** during the wave: it stays, nothing opens.
5. Tap **Visit** twice quickly: one navigation.
6. With the Blobbi asleep or as an egg: the page opens at once.
7. Offline (airplane mode): the visit says it did not open and the Blobbi is back.

## 5. Returning players and sign-in

1. Sign in with an extension (desktop), with a bunker (phone), and with a
   saved key. The home this device chose opens (the 2D home if nothing was
   chosen), no onboarding.
2. Start a bunker sign-in and do not approve: a message within a minute.
3. Room menu → **2D home** and back (menu → **Explore in 3D**).

## 6. Failure

1. Block all relays (devtools request blocking): the header's connection chip
   shows; **Try again** recovers once unblocked; nothing is half-written.
2. Force an error (devtools: throw in a component, or a corrupted fixture):
   the crash card, not a white page; **Reload** recovers.

## Record

| Step | Device / browser | Result | Evidence (screenshot, event id) |
|---|---|---|---|
| | | | |
