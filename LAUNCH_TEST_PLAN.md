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
- Devices: one recent iPhone (Safari), one older iPhone, one budget Android
  (Chrome), one desktop (Chrome, Firefox or Safari).

## 1. A new visitor (private window)

1. Open the root. The welcome shows three Blobbis, one line, three small
   chips, **Adopt my Blobbi** and **I have an account**, with no scrolling
   (try 320×568, 375×667, 390×844 and a desktop; on the smallest phone the
   chips step aside). With the OS text size at its largest it may scroll,
   but nothing is cut off.
2. Open the console (desktop): no CSP violations, no errors.
3. **Adopt my Blobbi** → the key screen. Save the key (copy or download);
   the button stays off until the box is ticked.
4. The egg on its pedestal, **at once, on the first try** (no reload): its
   centre in the middle of the glow, its base on the pedestal. Tap it
   (wobble). Name it, **Adopt**.
5. The room opens; a moment later the theatre presents the egg and **waits**:
   "Ready to hatch?", **Hatch!** and **Later**. Wait 10 s: nothing happens,
   nothing is written. Tap the egg twice quickly: one story, then the baby in
   the room, with **no arrival effect** on top of the birth.
6. Reload while it waits: it presents the egg again, waiting. Tap **Hatch!**,
   then reload during the cracks: presented again, waiting; tap again. In the
   end exactly **one** hatch event (check the kind 31124 history with a
   Nostr client).
7. **Later** on the invitation: the room shows "Ready to hatch? Tap your
   egg"; tapping the egg or that pill brings the invitation back.

## 2. The room

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
   saved key. The room opens, no onboarding.
2. Start a bunker sign-in and do not approve: a message within a minute.
3. Room menu → **Classic home** and back.

## 6. Failure

1. Block all relays (devtools request blocking): the header's connection chip
   shows; **Try again** recovers once unblocked; nothing is half-written.
2. Force an error (devtools: throw in a component, or a corrupted fixture):
   the crash card, not a white page; **Reload** recovers.

## Record

| Step | Device / browser | Result | Evidence (screenshot, event id) |
|---|---|---|---|
| | | | |
