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
