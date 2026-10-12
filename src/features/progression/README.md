# Progression: player XP in Blobbi Standalone

M12.1. Standalone now earns player XP with the ecosystem's own daily missions.
It has no XP system of its own: no new kind, no new tag, and no numbers of its
own. This note records the audit, what was built, and what was deliberately
not built.

## Audit (2026-10-12): how XP works in the ecosystem

| Question | Answer | Where |
|---|---|---|
| How is player XP represented? | The `xp` tag of the player's kind **11125** Blobbonaut profile (replaceable), with `level` as a mirror derived from it (`buildXpTagUpdates`). | `@blobbi-kit/core` `progression.ts`, `blobbi.ts` |
| Which events are authoritative? | The player's latest 11125. Levels come from `xpToLevel` (20 levels: 0, 100, 250, 500, **850** (level 5), …). Unlocks come from `getUnlocks(level)`: 2 Blobbis at 5, 3 at 10, 4 at 15, 5 at 20. | kit `progression.ts` |
| Who signs it? | **The player.** No issuer or server signs XP. Every Blobbi app writes the profile with the player's key, so XP is honour-system by design. | kit `useAwardDailyXp` |
| How do other apps award it? | **Daily missions** (`@blobbi-kit/react`): 3 a day, picked deterministically from date + pubkey out of a pool of 16. Each mission pays its pool XP (10 to 40), plus a **+50 bonus** when all three are done. Ditto pays it with `useAwardDailyXp` once all three are complete. | kit `daily-missions.ts`, Ditto `BlobbiPage.tsx` |
| Is there other XP? | `ACTION_XP` (feed 5, play 8, …) is the **Blobbi's** `experience` (31124), not the player's. Ditto's poop clean-up also writes the Blobbi's `experience`. Nothing else writes player XP. | kit `blobbi-xp.ts` |
| Daily limits? | Three missions a day, each counted only up to its target. The award is paid once per day. Rerolls: 3 a day (a completed mission cannot be rerolled). | kit |
| Where is progress kept? | In the 11125 **content** (`missions`: date, the day's three, rerolls). `usePersistDailyProgress` keeps progress there (debounced) and **never persists a finished day**: finishing is the award's job, which writes the XP in the same event. | kit `usePersistDailyProgress.ts` |
| How are duplicates prevented? | In the kit: not at all. `useAwardDailyXp` adds `totalDailyXp` to the fresh XP every time it is called. Ditto guards it with an in-memory `useRef` per date, which a reload clears. | see the finding below |
| Can XP be derived from care events? | Not canonically. 1124 receipts exist, but nothing in the ecosystem turns them into player XP. Doing that here would create a second authority that other apps would not agree with. | n/a |

### Finding for the ecosystem (not fixed here; Ditto and the kit are read-only)

Ditto can pay the same day twice. After a day's award, the profile holds the
finished day. On a reload, `useDailyMissions` hydrates it, `allComplete` is
true again, and the in-memory `useRef` that guarded the award is empty, so
`useAwardDailyXp` adds the day's XP a second time. The same happens on every
reload that day. The fix belongs in the kit: `useAwardDailyXp` should refuse
when the fresh profile already holds that date finished. That is the rule
below, which Standalone already applies on its side.

## What Standalone does (implemented)

- **Counts** care that landed, through the kit's own tracker
  (`trackInventoryDailyActions`: every use is an interaction; food, soap and
  medicine also count for their own mission). Putting the Blobbi to bed
  counts as `sleep`. The calls sit in the write paths, after the publish
  resolves: `useCareActions`, `useUseItem` (never for a use that had already
  been applied) and `useStarterUse`. Opening a screen, petting, the ball's free
  replay and animations count nothing.
- **Keeps progress** with the kit's `usePersistDailyProgress`, the same
  debounced write Ditto uses, so a reload or another app sees it.
- **Pays the day** once all three are done, with the event the kit's
  `useAwardDailyXp` would write, built from the same functions
  (`updateBlobbonautTags`, `buildXpTagUpdates`, `serializeProfileContent`,
  `totalDailyXp`), plus one check made against the **fresh** profile at the
  moment of signing:

  > A fresh 11125 whose `missions` are today's, all complete, has been paid
  > for today.

  This follows from the kit's own contract (progress persistence never writes
  a finished day), so the check works across tabs, devices, reloads and Ditto
  alike. One award per player and day runs at a time in the page. A failed
  award is never retried automatically; the player can retry it.
- **Swaps** a mission this home cannot do (sing, play music, take a photo
  happen in Ditto for now) with the kit's own rerolls: three a day.
- **Shows** it in the Journey: the Blobbonaut level with its XP bar,
  today's three with their XP and progress, the bonus, and the award's state
  (saving, paid, already paid today, failed with Try again).

What it pays, from the kit's pool: 10 to 40 XP per mission and +50 for all
three, so roughly 65 to 135 XP a day. Level 5 (850 XP, a second Blobbi) takes
about a week to a fortnight of finished days. A missed day costs nothing.

## What is not done, and why

- **No XP for Journey chapters.** "Larger rewards for meaningful
  accomplishments" would need a mission-reward table that every Blobbi app
  agrees on, with a way to mark a chapter as paid. That would be a new
  progression authority. It belongs in the kit (and its protocol notes) first.
  Chapters still show what they open, which is canonical.
- **No per-care player XP.** The ecosystem pays player XP only through daily
  missions. Per-action XP stays the Blobbi's `experience`.
- **Two tabs finishing the same day at the same instant** on two devices could
  both pass the fresh-profile check before either write lands. The window is
  one relay round trip, the cost is one extra day's XP, and only a protocol
  change (a compare-and-set on the replaceable event) closes it fully.
