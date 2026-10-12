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

1. Open the root. The welcome shows three Blobbis, one line, **Adopt my
   Blobbi** and **I have an account**, without scrolling on the smallest phone.
2. Open the console (desktop): no CSP violations, no errors.
3. **Adopt my Blobbi** → the key screen. Save the key (copy or download);
   the button stays off until the box is ticked.
4. The egg on its pedestal; tap it (wobble). Name it, **Adopt**.
5. The room opens; the hatch theatre plays once; the baby is in the room.
6. Reload in the middle of the cracks: it plays again; exactly **one**
   hatch event (check with a Nostr client for kind 31124 history).

## 2. The room

1. Change rooms, feed, play with the ball, bathe, sleep and wake.
2. Pinch to zoom, rotate the phone; nothing is cut off; no horizontal scroll.
3. Dev tools → Performance → Record 10 s on each phone. Note fps.
4. Turn on reduced motion in the OS; reload: no rocking, no hops.

## 3. Journey

1. Open **Journey** (map icon). Chapter 1 done after the hatch; chapter 2
   current. Ticks follow care: feed in the kitchen, reopen, **First meal** ticked
   (it may take up to a minute on a slow relay).
2. **Go there** on an objective moves to that room.
3. Sign in on a second device: the same ticks (the cuddle and nap marks are
   per device and may differ).
4. A chapter finished shows its card once; reload: it does not show again.
5. With a level 5 account (XP ≥ 850 from another Blobbi app): **A second egg**
   shows **Adopt an egg**; adopting makes an egg that does **not** hatch by
   itself; its details list incubation tasks. With a lower level the button is
   absent.

## 4. Worlds

1. Open **Worlds** (globe icon). Island, Rumble and Farm say **Visit**;
   Pixel says **Coming soon** and does nothing.
2. **Visit** Island: the Blobbi looks up, waves, dissolves, then the page
   opens Island. Check the address bar holds no key, no query string.
3. Press Back: the room is there, the Blobbi present.
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
