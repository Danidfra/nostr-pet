# Gameplay UX for M15.3: what is there, what is missing, what to build (proposal, 2026-10-14)

This is Track B's review of the play itself, written for the M15.3
decision. It is a proposal: nothing here is implemented, no new
progression protocol or economy is designed (the ecosystem's progression
is `lifecycle/SHARED_PROGRESSION.md`'s question), and every idea below
reuses infrastructure the app already has. File references are to the
code as of M15 Track B (`feat/m15-reliability-ux`).

## 1. Faces during feeding and other care

**Today.** The kit's renderer knows seven emotions (neutral, happy,
excited, sad, sleepy, surprised, upset) and faces built from parts (eyes
open/half/closed/wide, mouth neutral/smile/grin/frown/open/flat, brows,
blush). The app names fourteen faces from those parts
(`features/expression/faces.ts`), two of them for eating: `chewing` (eyes
closed, mouth open) and `munching` (eyes closed, grin). One expression
controller orders them (life < reaction < petting < care < script <
journey; `features/expression/controller.ts`, `useExpression.ts`).

The **3D room** uses it: a feed is a scene (notice, walk, an eager look at
the dish while the write goes out, then bites), and each bite alternates
chewing and munching with a body dip, 300 ms a bite, four for food, two for
a drink, one under reduced motion (`room/hooks/useRoomCare.ts` `EAT`,
`useEatingPresentation.ts`, pinned by `eating.test.ts`). Petting shows
affectionate then happy; the ball shows curious; teleports show relieved.

The **2D home does not use the controller**. Its faces come from
`home/scene/presentation.ts` and `reactions.ts`: `excited` for 900 ms when
an item is offered, nothing in particular while it is being used (the food
glyph sits for `MIN_USE_MS`, 700 ms, and goes), then one reaction face for
2.4 s after the write lands (feed → happy, play → excited, clean → happy,
medicine → happy, boost → excited). The resting face follows the critical
stats (neutral, sleepy, sad).

**Gaps.** No chewing in 2D; no bite rhythm; two face systems for one
Blobbi; no "during" face for the bath, the medicine or the rest in either
home (only the celebration after).

**Proposal (M15.3, small).** Drive the 2D actor through the same
`useExpression` (or the bite helper alone) during `offer.phase ===
'using'` for food and drink: the same `EAT` timing, chewing and munching
alternating, a small body dip on the actor's box (CSS, never on the
drawing, as the ceremony does). Add "during" faces that already exist in
`faces.ts`: `concentrating` then `relieved` for the bath, `worried` then
`relieved` for medicine, `sleepy` eyes half-closed as the rest begins. No
data changes; the kit's write is untouched.

## 2. The Journey and the Evolution as the player meets them

**Today.** Four chapters are derived fresh from published facts (kind 1124
receipts, 31124, 11125; `journey/journey.ts`), with a few device-only
marks (first cuddle, nap, chapters celebrated) under
`blobbi:journey:v1:<pubkey>`. The Journey sheet stacks the level card with
its XP bar, today's three missions with Swap and Retry, an Adopt-an-egg
button, then the chapters with each objective's status (Done, In progress,
To do, Come back later, Locked), a progress bar and a "go" link
(`journey/JourneySheet.tsx`). The evolution lives in `LifecyclePanel.tsx`:
the stage track Egg → Baby → Adult, one line for what is next, the task
list, one primary button (Start incubation, Hatch, Start evolution,
Evolve), embedded in both Blobbi sheets. Hatching has a full theatre
(`HatchTheater`); the 2D evolve has a ceremony (building → publishing →
revealing, renderer effects); the **3D evolve has a write, a sound, an
excited face and a bounce, and no build-up**. `ChapterToast` ("Chapter N
complete… Next: …", 5.5 s, a sound, once per device) is rendered **only in
the room**; the 2D home never shows it, and hardcodes `canAdoptMore={false}`
on its Journey sheet.

**Gaps.** The 2D home has no chapter celebration; the room has no evolve
theatre; chapter rewards are words only ("opens …"); the Journey and the
lifecycle panel are two progress views reached from one sheet.

**Proposal.**
1. Render `ChapterToast` in the 2D home (one mount beside `StreakMoment`,
   the same hook state the room reads). One line of JSX and a test.
2. An evolve theatre in the room built on the hatch theatre's structure
   (`room/lib/hatch-theater.ts` reveal timings): the Blobbi steps forward,
   the write goes out under a glow, the adult is revealed with the kit's
   sparkles; "Evolve for me" as the hatch has "Hatch it for me". The write
   stays the kit's hook and the one canonical event.
3. One line in the HUD, under the name, for the current chapter's next
   objective ("Feed Lupa in the kitchen"), hidden when the Journey is open
   and after it is done for the day. Derived, never stored.

## 3. Rewards the player actually sees

**Today.** Per care action: three floating hearts (none for rest), stat
chips ("+N food", "+N XP", the Blobbi's `experience` on 31124 by the kit's
`ACTION_XP`), a live-region sentence (`care-ui/CareFeedback.tsx`); in the
room, chips and a heart while petting. Player XP: the kit's three daily
missions, 10–40 XP each plus a +50 bonus, paid once a day against a fresh
read of 11125 (`progression/`), visible **only inside the Journey's Today
section**. The level (`xpToLevel`, 20 levels) unlocks exactly one thing,
`maxBlobbis` (1, then 2 at level 5, 3 at 10, 4 at 15, 5 at 20). Streak
milestones (3/7/14/30/60/100/365) get `StreakMoment` in both homes.

**Gaps.** Levelling up has no moment; being paid the day's XP has no
moment outside the sheet; nothing cosmetic or spatial is tied to a level;
chapters grant nothing (the Journey README says so on purpose).

**Proposal (presentation only).**
- A **level-up moment** reusing `StreakMoment`'s card and timing when
  `xpToLevel(profile.xp)` rises between two reads: "Level 4!" with the one
  thing the next level opens, if any. Derived from the profile; nothing
  written.
- A **"missions paid" moment** when the daily award lands
  (`award.kind === 'paid'`): the three chips of today's XP flying to the
  level bar, 2 s, with the existing sound. Nothing written beyond what the
  kit already writes.
- Any real reward (an item, a cosmetic, furniture) is an economy question
  and belongs to the shared-progression decision, not to M15.3.

## 4. Furniture: what exists, what is gated

**Today.** The 3D catalogue has about 44 `official:*` pieces with models
(`room/lib/furniture-3d.ts`, `room/lib/scene/official-models.ts`): beds,
fridge, oven, sink, bathtub, toybox, lamps, plants, rugs, clocks, frames,
shelves, wardrobe, mirror. The only rule is `allowedRooms`; some pieces
are interactive (bed, fridge, bath, toys). The decorator lists everything
by category, up to 20 pieces a room, all placeable from the first minute.
The 2D home's furniture registry (27 SVG pieces, `home/rooms/`) has been
dormant since M10: `HOME_SPACE.furniture` is empty by design, and only the
bed, the tub and the nest come out for care moments. Furniture cannot be
owned or bought: the inventory's kinds are care, currency and cosmetic;
kind 1416 spends apply to care-item uses only.

**Gaps.** Nothing is gradual: a new player in the room meets 44 pieces at
once and has no reason to come back for any; the 2D home has none.

**Proposal: gradual furniture, derived and never stored.** A visibility
rule in the decorator, computed from facts the app already has: the
starter set (bed, fridge, bath, toybox, one lamp, one rug) always; a
category per Journey chapter completed (plants and frames with chapter 2,
clocks and shelves with chapter 3, the wardrobe and the mirror with
chapter 4); the rest at Blobbonaut level 5. Pieces that are not yet open
show dimmed with the reason ("Opens with chapter 3"), the way the intro's
3D card says why it cannot be chosen. A room decorated before the rule
keeps every piece it has (the rule gates placing, never what is placed).
This needs one decision: rooms are device-local today, so the gate is a
presentation rule, not a right; if rooms are ever published
(`room/NOSTR_PERSISTENCE.md`), the rule must be re-evaluated on every
device from the same facts, which it is.

## 5. Decoration persistence

**Today** (all device-local `localStorage`, nothing published): the 3D
room's furniture and surfaces (`blobbi:room3d:<pubkey|anon>:<d>`,
versioned, parsed defensively, written on Save), its navigation and intro
memory, the dormant 2D layout, toys and room keys. `room/NOSTR_PERSISTENCE.md`
proposes, and does not implement, syncing to Ditto's existing kind 11125
keys (`room_furniture_v2`, `room_layouts`) with a fresh read, a rebase, a
debounced publish on Save, consent before uploading a local room, never an
anonymous one; it also notes that rooms would become per player rather
than per Blobbi.

**Gap.** A decorated room is lost on a new device or browser, and a guest
who saves keeps it only because the pubkey is the same (M15 made the
removal of a guest sweep these keys, and a confirmed save keep them).

**Proposal.** Not M15.3's: it is the ecosystem decision the persistence
document asks for. What M15.3 can do is make the loss honest: a line in the
room's Decorate sheet, "Your room lives on this device", with the same
calm words the guest's status uses, and nothing else until the decision.

## 6. Minigames: what a small game could stand on

**Today.** There is no minigame, no score, no input → score → reward loop.
The ball is kicked by the Blobbi three times on its own (`PLAY` in
`useRoomInteractions.ts`), with one care write when the play begins;
tapping a ball left on the floor rolls it again with no write; it is put
away after 28 s idle. The 2D toy is set down and used, nothing to steer.
What a game could reuse: the interaction director (`room-interaction.ts`
`createDirector`: cancellable scripts with `wait`, `until`, `protect` for
the one write, `cleanup`), the pure ball physics (`ball-physics.ts`
`stepBall`, `kickBall`, `kickDirection`, `ballRestPoint`),
`RoomControl.kickProp` and `propPosition`, pointer stroke detection
(`PET_START_PX` 28, `PET_STROKE_PX` 70) and the rate-limited petting beats
with hearts, the expression controller, `gesture()` (bounce, wiggle),
sounds, the overlay chips, the renderer's effects, and the kit's daily
mission counter. The progression README is explicit that petting and the
ball's replays count for nothing; only a landed care write does.

**Proposal: "Keep it rolling", the one minigame for M15.3.** After the play
write lands and the Blobbi has had its three kicks, the ball is the
player's: each tap on the moving ball before it rests sends it on
(`kickBall` from the tap's side) and counts one; the Blobbi chases and
reacts (curious, then excited at 5, then the `celebrate` gesture at 10);
the run ends when the ball rests. The score is a chip over the ball and a
best-of-this-device number kept with the room's other device memory
(`blobbi:room3d:nav:…`'s neighbour, versioned the same way, swept by the
guest removal like the rest). **No write beyond the one the play already
makes**, no XP, no item: the reward is the Blobbi's joy and the number. In
2D the same loop runs on the floor with the existing toy spot and the
2D ball glyph, pointer samples projected into the floor's coordinates as
the bath does. The director makes the whole run one cancellable script, so
a sheet, a sleep or a room change ends it cleanly.

## 7. A guided first play (the gap every area shares)

**Today.** The hatch is guided tap by tap; the room's introduction chooses
the look; the look guide's bubble shows where the look is chosen; the guest
invitation asks to save. After the hatch, nothing walks the player through
a first feed or play: chapter 2's objectives are the closest thing, and
they live in a sheet.

**Proposal.** One more bubble in the look guide's family
(`room/lib/look-guide.ts` has the pattern: a stage, a key, a timeout, a
tap to act): after the first hatch, "Lupa is hungry. Try the fridge." over
the dock's item in 3D and the Feed verb in 2D; a tap on it does what the
button does; it goes on any other touch or after fourteen seconds, and
never returns (`blobbi:room:first-play:v1`). A second bubble, once the
first feed landed and the Blobbi is awake: "Lupa wants to play." These are
two stages of one guide, device-local, nothing published, and they are the
cheapest way to make chapter 2 happen without opening a sheet.

## 8. What M15.3 should contain, in order

1. 2D feeding faces through the shared controller, and the three "during"
   faces (section 1): a day, no data.
2. `ChapterToast` in 2D, the level-up and missions-paid moments (sections
   2.1, 3): a day, presentation only.
3. The first-play guide (section 7): a day, one key.
4. Gradual furniture as a derived rule in the decorator (section 4): two
   days, one decision to take first.
5. The evolve theatre in the room (section 2.2): two days.
6. "Keep it rolling" (section 6): three days, the one that most needs a
   real device in hand.

Out of M15.3, by the brief: anything that writes new kinds, pays new XP,
grants items or furniture as rewards, or publishes rooms. Those wait for
the shared-progression and persistence decisions.
