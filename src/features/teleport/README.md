# Teleport & presence — public API and cross-app design

Status:

- **Implemented** in this app: the controller, the timeline, the motes, the
  2D and 3D adapters, the room integration, and the dev preview.
- **Proposed only**: everything about coordinating presence across apps,
  tabs and devices (§3). No network presence is implemented, and nothing
  teleports on its own (focus, visibility or otherwise).

## 1. Module layout (`src/features/teleport/`)

```
timeline.ts       the choreography: phases, cut height, squash, glow, face, cues   (no deps)
particles.ts      the motes as a pure function of (kind, t, silhouette)            (no deps)
presence.ts       the presence state machine                                       (no deps)
silhouette2d.ts   an SVG drawing's outline from its pixels                         (DOM only)
react/usePresence.ts       React binding of the controller                         (react)
react/TeleportFrame2D.tsx  2D adapter: CSS mask + canvas motes around any drawing  (react, DOM)
three/teleport3d.ts        3D adapter: clipping plane, glow, cap, Points motes     (three)
```

The modules import only each other, `react` and `three`. They import nothing
from routes, inventory, Nostr, furniture, navigation, auth or Standalone UI.
That makes the folder extractable into blobbi-kit as it stands. The one
exception is the CSS: the `.teleport-2d*` rules live in `src/index.css` and
would move into a stylesheet beside the component.

Suggested kit split: `@blobbi-kit/teleport` (the core three files),
`@blobbi-kit/teleport/react` and `@blobbi-kit/teleport/three`. The two
subpaths would declare react and three as peer dependencies.

## 2. Public API (proposed for extraction; it is today's API)

### Controller (renderer-free)

```ts
type PresenceState = 'present' | 'departing' | 'absent' | 'arriving';

createPresenceController(options?: {
  initial?: 'present' | 'absent';
  reducedMotion?: () => boolean;                 // read when each journey starts
  onCue?: (cue: 'gather' | 'rise' | 'descend' | 'tada', kind: 'depart' | 'arrive') => void;
  onComplete?: (state: 'present' | 'absent') => void;   // not called for cancelled or turned-back journeys
  clock?, setTimer?, clearTimer?                 // test seams
}): {
  getState(): PresenceState;
  snapshot(): { state; journey: { kind; startedAt; offset; reduced } | null };
  elapsed(): number | null;                      // ms into the current timeline
  leave(): boolean;                              // false if already departing or absent
  enter(): boolean;                              // false if already arriving or present
  cancel(): void;                                // any journey → present, at once
  subscribe(fn): () => void;
  dispose(): void; isDisposed(): boolean;
}
```

Guarantees, all covered by `teleport.test.ts`:

- Journeys never stack.
- Turning back mid-way continues from the same visible fraction of the body.
- Cues and completion run on timers, not animation frames, so a hidden tab
  still completes.
- Nothing fires after `dispose`.
- Reduced motion uses a 450 ms fade with only the key cue.

### Timeline (renderer-free)

`journeyFrame(kind, t, reduced?)` returns a frame:

- Shape and progress: `phase`, `progress`, `cut` (0–1 visible from the feet),
  `edge`.
- Squash: `sx`, `sy`.
- Light: `glow`, `edgeGlow`.
- Face: `eyesClosed`, `face` (`'concentrate'`, `'relieved'` or `null`).
- Visibility and extras: `opacity`, `motes`, `hop`.

A renderer only draws the frame it is given.

`DEPART`, `ARRIVE`, `REDUCED`, `CUES` and `journeyDuration` describe the
timings. `motesAt(kind, t, silhouette)` gives the mote field in body
coordinates.

### Adapters

- **React:** `usePresence(options)` returns `snapshot & { leave, enter, cancel,
  getState, controller }`. It is StrictMode-safe.
- **2D:** `<TeleportFrame2D journey absent preview? onFace? onHop? fallbackTint?>
  {drawing}</TeleportFrame2D>`. It wraps any drawing and never edits the
  drawing's SVG.
- **3D:** `createTeleport3D({ root, figure }, tint)` returns `{ apply(frame,
  kind, t), rest(), dispose() }`. `rest()` restores every material exactly as
  it was. `dispose()` removes what the adapter added.
  - It requires `renderer.localClippingEnabled = true`.

### Host responsibilities (not the library's)

- Play the cues. This app maps them to its sound engine, which stays quiet
  in hidden tabs.
- Map `face` onto the host's expression system.
- Block interactions while not `present`.
- Fade shadows.
- Decide *when* to leave or enter.

## 2b. Refinements (M8)

- **The sky.** The motes leave through the top of the view and come in from
  just past it.
  - Each drawing measures where that is: the page in 2D (the
    `[data-teleport-sky]` element's top), the room's camera in 3D
    (`RoomScene.skyAbove`, by projection).
  - `motesAt(kind, t, silhouette, { ceiling })` takes it in body heights.
    The trajectories span the same share of the screen whatever the
    viewport, camera, position or stage.
  - Arrivals are staggered by when they land, so the stream is continuous.
- **Trails.** Each mote drags a short streak (`TRAIL_MS`): a stroke in 2D,
  one `LineSegments` buffer in 3D.
- **Reversal without popping.** `moteLayers` hands the turned-back
  journey's motes on: the ones already on their way finish their flight and
  fade over `HANDOVER_MS`. None is born after the turn, so nothing is drawn
  twice.
- **The shadow.** `journeyShadow(frame)` is the materialized share, eased.
  - The ground (contact) shadow fades by it, and the 2D cast-shadow proxy
    is cut from the top.
  - The 3D model's own cast shadow is clipped by the same plane
    (`clipShadows`), with no extra pass.
  - A reduced-motion fade switches it off once, as it crosses half.
- **Parts cut open** (arms, ears, horns) show their inside lit while cut:
  back faces drawn in the cut's light. The program is cached across
  journeys.

## 3. Cross-app presence coordination (design only)

The goal: one Blobbi is visibly in one place at a time. The places could be
the Blobbi home, Blobbi Island, Ditto, several tabs, or several devices. When
it moves, the old place plays the departure and the new one plays the
arrival.

### 3.1 Principles

- **Presence is ephemeral and presentation-only.** It never changes identity,
  care, inventory or rooms. Losing presence data must never lose anything
  else. When in doubt, a Blobbi is shown as *present*: showing it twice is
  better than showing it nowhere.
- **No automatic teleport on focus or visibility.** Focusing a tab is not
  intent. A move is always triggered by the player ("Bring Brook here" or
  "Visit the Island"). A coordinator can *suggest* moving, but it never moves
  the Blobbi without being asked.
- **The controller stays unchanged.** A coordinator only calls
  `leave()`/`enter()`/`cancel()` and listens through
  `subscribe`/`onComplete`.

### 3.2 Same origin, several tabs: `BroadcastChannel`

The channel is `blobbi-presence:<pubkey>:<d>`. Messages:

```ts
{ type: 'claim',  from: tabId, at: epochMs, lease: ms }   // "it is coming here"
{ type: 'release', from: tabId }                          // "it has left here"
{ type: 'heartbeat', from: tabId, at }                    // while it is here
{ type: 'query' } → answered by the holder with 'heartbeat'
```

The protocol is a **lease**, not a lock:

1. The tab holding the Blobbi sends a heartbeat every 5 s. The lease lasts
   15 s.
2. A tab that wants the Blobbi sends `claim`.
3. The holder runs `leave()` and sends `release` on `onComplete('absent')`.
4. The claimant runs `enter()` *when it receives `release`*, or when the lease
   expires (the holder crashed or was closed).

Races:

- **Two simultaneous claims:** the lower `(at, tabId)` wins. The loser
  `cancel()`s and stays absent.
- **A turn back mid-journey:** the claimant sends `release` before it has
  arrived. The holder calls `enter()`, and the controller reverses from the
  visible fraction.
- **A closed tab:** `pagehide` sends `release`. Without it, the lease expiry
  covers the case.
- **A hidden holder tab:** journeys finish on timers, so the release still
  arrives.

### 3.3 Different origins (Island, Ditto): `postMessage`

This applies only when one app embeds the other, or opens it with
`window.open`:

- The same messages are used, inside an envelope `{ protocol:
  'blobbi-presence/1', ... }`.
- A message is accepted only from an explicit **origin allow-list**
  (`https://blobbi.pet`, `https://island.blobbi.pet`, Ditto's origin). Any
  other origin is ignored.
- Nothing else is sent: no keys, no tokens, no profile data.
- When two apps share no window, they cannot coordinate locally. In that
  case, use §3.4, or accept that the Blobbi shows in both.

### 3.4 Across devices: Nostr, without new kinds

Do not publish presence to Nostr by default. It is a location signal, so it
is a privacy concern, and it is high-churn. If it is ever wanted:

- Use **NIP-40 expiration** on an **ephemeral-range event**, *only if* the
  ecosystem agrees on one. Inventing a kind is out of scope for this repo. No
  existing kind (31124, 1124, 11125) may carry presence: those are durable
  state, and writing presence there would churn the player's real data.
- Alternative with no protocol change: the player's own clients agree
  locally only, and devices never coordinate. This is the recommended default.
- Anything published would be opt-in. It would carry only `(d, app,
  expiresAt)`, coarse, never a room or a position.

### 3.5 Failure modes

| situation                         | behaviour                                          |
|-----------------------------------|----------------------------------------------------|
| holder crashes                    | lease expires → claimant arrives                   |
| message lost                      | heartbeat/query re-syncs within one interval       |
| both think they hold it           | lower `(at, id)` keeps it; other one departs       |
| coordinator unavailable           | every place shows it present (today's behaviour)   |
| reduced motion                    | the same protocol, with 450 ms journeys            |

## 4. Tests that exist

- `src/features/teleport/teleport.test.ts`: the timeline, motes, outline,
  controller rules and reduced motion.
- `src/features/teleport/adapters.test.tsx`: the 2D mask and rest state; the
  3D clipping plane on every material, the motes and cap, and an exact
  restore and dispose.
- `src/features/room/RoomTeleport.test.tsx`: the room during journeys (UI
  blocked, absent, then the same Blobbi), rapid triggers, cancel, unmounting
  mid-journey, and nothing published.
