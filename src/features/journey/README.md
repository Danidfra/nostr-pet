# The Journey: progression audit and persistence model

## Audit (2026-10-12): what progression already exists

| Mechanism | Where it lives | Authoritative? |
|---|---|---|
| Hatching the **first** egg | `decideFirstBlobbi` + relay confirmation; no missions | Yes (app rule over the 31124 collection) |
| Hatching any **other** egg | kit hatch tasks: a Ditto theme, an espy colour moment, 7 interactions (tally in 31124 content `evolution[]`) | Yes (kit) |
| Evolving a baby | kit evolve tasks: 3 themes, 3 colour moments, 21 interactions, edit profile, every stat ≥ 80 | Yes (kit) |
| Care receipts | kind 1124, `action` ∈ feed/play/clean/medicate/boost, written by every care here | Yes (Nostr) |
| Care streak | 31124 `care_streak` | Yes |
| Blobbi XP | 31124 `experience`, from care | Yes |
| Player XP and level | kind 11125 `xp` → kit `xpToLevel` (20 levels) | Yes |
| How many Blobbis | kit `getUnlocks(level).maxBlobbis`: 1, 2 at level 5, 3 at 10, 4 at 15, 5 at 20 | Yes (kit) |
| Daily missions | kit `useDailyMissions` (pool includes sing, music, photo) | Award XP in Ditto, and here since M12.1 (`features/progression`) |
| Rest and petting | rest writes 31124 only; petting writes nothing | n/a |

Found and fixed: the room's hatch and evolve entry accepted a request
without checking the kit's readiness (the classic home did check). The
room now refuses a hatch unless the egg is the account's first or its
incubation is complete, and an evolution unless the evolve tasks are done.

## What the Journey is

Four chapters (`journey.ts`), each a short list of objectives, **derived**
every render from the facts above. It stores no progress and grants nothing.

1. **A New Beginning**: adopt, hatch, a first cuddle.
2. **First Steps**: feed, play, bathe (1124 receipts, any app), a nap, and
   care on two different days (the receipts' calendar days; see below).
3. **Growing Together**: start growing up, the kit's own evolve tasks (with
   their links), grown up.
4. **A Bigger Family**: level 5, a second egg, hatch it.

A chapter's "reward" is what it opens, never an item or a number.

## Persistence model

| Kind | What | Where | Can it unlock anything? |
|---|---|---|---|
| **Canonical** | stages, streak, receipts, tasks, XP, level, unlock | Nostr | Yes, by the kit's rules only |
| **Derived** | chapters, objectives, statuses | memory, recomputed | No |
| **Device** | first cuddle, a nap, chapters already celebrated | `localStorage` `blobbi:journey:v1:<pubkey>` | **No**: shown with a phone mark, never holds a chapter back |

Celebrations: once per chapter per device. The first time a device works
out the journey, chapters already finished are recorded as celebrated
without a celebration, so a reload or a new device never replays them.

## Additional eggs

The only unlock is the kit's: `getUnlocks(xpToLevel(xp)).maxBlobbis`
against the number owned. The Journey shows **Adopt an egg** only then,
and the adoption checks again at signing against a fresh read of the
collection and the profile (`useAdoptEgg({ additional: true })`). A second
egg never hatches by itself: it follows the kit's incubation tasks.

**Since M12.1** this app earns player XP with the ecosystem's daily missions
(`src/features/progression/README.md`), so a player who only uses blobbi.pet
reaches level 5 here too: about a week or two of finished days.

## M12.1 review of the chapters

| Chapter | Purpose | Doable here? | Change |
|---|---|---|---|
| 1 A New Beginning | adopt, hatch, a first touch | yes | The hatch is the player's moment now (they tap; nothing hatches by itself). The hint says so. |
| 2 First Steps | the four kinds of care, and coming back | yes | "Two days together" was `care_streak >= 2`: two days **in a row**, and a missed day reset it to 1. It is now **any two different days** with care (the local calendar days of the player's 1124 receipts, any app, any device). It never resets. On a day already counted it says "Done for today! Any care on another day finishes it." |
| 3 Growing Together | the kit's evolve tasks | partly: interactions here; themes and colour moments happen in other apps (links shown) | Unchanged: the kit's tasks are canonical. |
| 4 A Bigger Family | level 5, a second egg, its hatch | yes (XP from daily missions, here) | The level hint points to Today's missions. **Adopt an egg** now sits at the top of the Journey whenever the kit's unlock allows it, not only while chapter 4 is the current one. Growing up was never a rule for a second egg. |

Every objective now says where it stands: **Done**, **In progress** (some
counted), **To do**, **Come back later** (time, not effort, is missing),
or **Locked** (a chapter not open yet). A locked chapter lists what is
inside it. No reward is named that the app cannot grant.

### Two days, not in a row

The kit's `care_streak` (31124) is the canonical streak, and the header
still shows it. It counts days in a row. The Journey does not depend on it:
missing a day should never feel like losing progress. Nothing canonical is
changed by this, because the objective is the Journey's own (it gates
nothing in the protocol).
