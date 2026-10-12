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

## What is NOT implemented, on purpose

- **No key sharing** between subdomains (no postMessage, no cookie on
  `.blobbi.pet`, no URL parameter). A secret key in a URL ends in history,
  logs and referrers.
- **No shared session backend.** Each app keeps its own login.
- **No presence protocol.** The Blobbi does not "arrive" anywhere: Island
  shows it because Island reads the same 31124 event.
- **No new event kinds.**

## If presence is wanted later

A "where is my Blobbi" fact would need either a new tag on 31124 (every app
must agree and every write path must keep it), or a new kind. Both are
protocol changes across five repositories, with write races between apps
(31124 is last-write-wins). That is a decision for the ecosystem, not a
change to make from one app.
