# Connected Worlds: how the Blobbi apps fit together

Implemented here: **navigation only.** The rest of this note is the map of
what is shared, what is not, and what would be needed for more, so the next
step is a decision and not a surprise.

## Five separate things

| Concern | Today | Shared between apps? |
|---|---|---|
| **Player identity** | the player's Nostr key (pubkey) | Yes, by the protocol: every app signs in the same pubkey, each with its own sign-in. |
| **Blobbi identity** | kind 31124, `d` = `blobbi-<pubkey12>-<petId>` | Yes: every app reads the same events. |
| **App identity** | each app is its own origin (`island.`, `rumble.`, `farm.blobbi.pet`, `blobbi.pet`) | No, and should stay so: separate storage, separate sessions. |
| **Navigation** | a plain link from one origin to another | Implemented here (this folder). |
| **Presence / location** ("where is my Blobbi now") | not modelled anywhere | No. |
| **Shared inventory** | item ownership on Nostr (kind 31124 content, issuer item events) | Yes, read-only here; each app writes its own kinds (see the ecosystem repo map). |
| **Gameplay state** (stats, stage, streak) | kind 31124 tags | Yes, last write wins per replaceable event. |

## What travel does (implemented)

1. The player opens **Worlds** in the room and picks an open world.
2. The Blobbi notices, waves, and dissolves with the teleport's own
   departure (`useWorldDeparture` over `usePresence`).
3. Only then: `window.location.assign(url)` with the world's checked URL.
   No key, no session, no query string, no fragment. The other app asks
   the player to sign in its own way (often already signed in there).
4. If the page is still here 5 s later (blocked, offline), the Blobbi comes
   back and the card says so. Back from the other app (bfcache) restores
   the room.

Rules: a world is open only with an `https:` address checked to answer as
that app (`worlds.ts`, with the date); an unchecked one is labelled "Coming
soon" and is never a link. One departure at a time; Stay cancels before
navigation; reduced motion skips the wave; a Blobbi that cannot act (egg,
asleep) leaves at once. Travel waits while a write is out.

## Coming home (M12.1, implemented)

Entering the room is now an **arrival**: on opening the app, a reload, coming
back from the classic home, or coming back from another Blobbi app. The
Blobbi gathers from motes, forms, and lands with its "ta-da", through the
room's one presence controller (`usePresence` started `absent`, then
`enter()`). It is the mirror of the departure above: same machine, same
timeline, same drawings. Rules (`src/features/room/lib/room-arrival.ts`):

- decided once when the room mounts, never replayed by a re-render;
- it plays once the room is on screen: after a first visit's fold-in, or a
  short beat for a room seen before or the flat room without WebGL;
- an egg never arrives (its first moment is the hatch theatre, and the birth
  goes straight into the room), and neither does a sleeper (it is in its bed);
- a change of room is a room transition, not an arrival;
- reduced motion gets the presence's short fade.

This is a **visual convention only**. Nothing is written and nothing is read
about where the Blobbi was. See below for what real presence would need.

## What is NOT implemented, on purpose

- **No key sharing** between subdomains (no postMessage, no cookie on
  `.blobbi.pet`, no URL parameter). A secret key in a URL ends in history,
  logs and referrers.
- **No shared session backend.** Each app keeps its own login.
- **No presence protocol.** The Blobbi's arrival in the room is a picture,
  not a fact: Island shows it because Island reads the same 31124 event.
- **No new event kinds.**

## If presence is wanted later

A "where is my Blobbi" fact would need either a new tag on 31124 (every app
must agree and every write path must keep it), or a new kind. Both are
protocol changes across five repositories, with write races between apps
(31124 is last-write-wins). That is a decision for the ecosystem, not a
change to make from one app.
