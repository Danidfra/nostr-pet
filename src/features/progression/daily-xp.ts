/**
 * Player XP in Blobbi Standalone (M12.1): the ecosystem's own daily missions,
 * not a system of this app's.
 *
 * What is canonical (audited in `README.md`):
 *
 *   - Player XP is the `xp` tag of the player's kind 11125 Blobbonaut profile,
 *     signed by the player; `level` mirrors it (`buildXpTagUpdates`).
 *   - It is earned by the kit's daily missions (`@blobbi-kit/react`): three a
 *     day, chosen by date and pubkey from one pool, each worth its pool XP,
 *     plus `DAILY_BONUS_XP` when all three are done. The day's progress lives
 *     in the 11125 content (`missions`), shared by every Blobbi app that runs
 *     them (Ditto today).
 *   - Progress is counted by the kit's tracker from care that LANDED (never
 *     from opening a screen or an animation), and persisted by the kit's
 *     `usePersistDailyProgress`, which by design never writes a day whose
 *     missions are all complete: only the award writes that state, together
 *     with the XP, in one event.
 *
 * Which gives the one rule that keeps the award from being paid twice, here
 * or across apps and devices, derivable from the canonical event alone:
 *
 *   a fresh 11125 whose `missions` are today's and all complete has already
 *   been paid for today.
 *
 * The kit's `useAwardDailyXp` adds `totalDailyXp` to whatever the fresh XP is
 * and does not check that rule (Ditto guards it with an in-memory ref, which a
 * reload clears). So this app writes the same event with the same kit
 * functions (`updateBlobbonautTags`, `buildXpTagUpdates`,
 * `serializeProfileContent`, `totalDailyXp`) and checks the rule against the
 * fresh event at the moment of signing. No new kind, no new tag, no new
 * number: the amounts are the kit's pool.
 */
import {
  areAllDailyComplete,
  getDefinition,
  getTodayDateString,
  totalDailyXp,
  trackDailyMissionProgress,
  trackInventoryDailyActions,
  type DailyMissionAction,
} from '@blobbi-kit/react';
import {
  KIND_BLOBBONAUT_PROFILE,
  buildXpTagUpdates,
  parseProfileContent,
  serializeProfileContent,
  updateBlobbonautTags,
  type BlobbonautProfile,
  type MissionsContent,
  type NostrEvent,
} from '@blobbi-kit/core';

/**
 * Count care that LANDED towards today's missions, with the kit's own mapping (every use is an interaction; food,
 * soap and medicine also their own mission). Called by the write paths after the publish resolved, never before,
 * never for a use that had already been applied.
 */
export function countCareForMissions(pubkey: string, action: string): void {
  trackInventoryDailyActions(action, pubkey);
}

/** Count a Blobbi put to bed (a rest that landed with the Blobbi asleep), as Ditto does. */
export function countSleepForMissions(pubkey: string): void {
  trackDailyMissionProgress('sleep', 1, pubkey);
}

/**
 * What this home can do of the pool's actions: care (interact), food (feed), the tub's soap (clean), medicine, and
 * putting the Blobbi to bed (sleep). Singing, music and photos are other apps' (Ditto's) for now: a mission for them
 * is shown as such and can be swapped with the kit's own rerolls.
 */
export const HOME_ACTIONS: ReadonlySet<DailyMissionAction> = new Set<DailyMissionAction>(['interact', 'feed', 'clean', 'medicine', 'sleep']);

export function doableHere(missionId: string): boolean {
  const def = getDefinition(missionId);
  return !!def && HOME_ACTIONS.has(def.action);
}

/** The day's missions as the fresh profile holds them, or undefined. */
export function persistedMissions(profile: Pick<BlobbonautProfile, 'content'> | null | undefined): MissionsContent | undefined {
  return profile ? parseProfileContent(profile.content).missions : undefined;
}

/** The rule: a profile that holds `date`'s missions all complete has been paid for that day. */
export function paidFor(profile: Pick<BlobbonautProfile, 'content'> | null | undefined, date: string): boolean {
  const missions = persistedMissions(profile);
  return !!missions && missions.date === date && areAllDailyComplete(missions);
}

export type AwardDecision =
  | { kind: 'award'; xp: number; newTotal: number; template: { kind: number; content: string; tags: string[][]; prev: NostrEvent } }
  | { kind: 'already-paid' }
  | { kind: 'not-complete' }
  | { kind: 'not-today' }
  | { kind: 'no-profile' };

/**
 * What to write for today's missions, decided against the FRESH profile at the moment of signing. Pure, so the rule
 * is pinned by tests. The event is exactly the kit's award (`useAwardDailyXp`): the XP and level tags over the
 * profile's own tags (every other tag kept), the missions into the content (every other key kept).
 */
export function planDailyAward(fresh: BlobbonautProfile | null, missions: MissionsContent, today: string = getTodayDateString()): AwardDecision {
  if (missions.date !== today) return { kind: 'not-today' };
  if (!areAllDailyComplete(missions)) return { kind: 'not-complete' };
  if (!fresh) return { kind: 'no-profile' };
  if (paidFor(fresh, today)) return { kind: 'already-paid' };
  const xp = totalDailyXp(missions);
  if (xp <= 0) return { kind: 'not-complete' };
  const newTotal = Math.max(0, Math.floor(fresh.xp)) + xp;
  return {
    kind: 'award',
    xp,
    newTotal,
    template: {
      kind: KIND_BLOBBONAUT_PROFILE,
      content: serializeProfileContent(fresh.content, { missions }),
      tags: updateBlobbonautTags(fresh.allTags, buildXpTagUpdates(newTotal)),
      prev: fresh.event,
    },
  };
}
