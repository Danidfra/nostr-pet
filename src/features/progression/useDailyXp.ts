/**
 * Today's missions and the XP they pay, for this home (`daily-xp.ts` has the
 * rules and why). Everything here is the kit's: `useDailyMissions` (the day's
 * three, hydrated from the profile), `usePersistDailyProgress` (progress kept
 * on the profile so a reload or another app sees it), `useRerollMission` (the
 * day's three swaps). The one thing this adds is the award, checked against
 * the fresh profile at the moment of signing (`planDailyAward`): it is paid
 * once per player and day however many tabs, devices, reloads or Blobbi apps
 * are involved, and a failed award is never retried by itself.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { DAILY_BONUS_XP, getTodayDateString, useDailyMissions, usePersistDailyProgress, useRerollMission, type BlobbiStage, type DailyMissionView } from '@blobbi-kit/react';
import { fetchFreshBlobbonautProfile, parseBlobbonautEvent, type BlobbiCompanion, type BlobbonautProfile, type NostrEvent } from '@blobbi-kit/core';
import { usePublishAdapter } from '@/features/care/usePublishAdapter';
import { doableHere, paidFor, planDailyAward } from './daily-xp';
import { dailyXpEnabled } from './daily-xp-switch';

export type AwardState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'paid'; xp: number }
  /** Already paid today (here earlier, on another device, or in another Blobbi app): nothing written. */
  | { kind: 'already' }
  | { kind: 'failed'; message: string };

export interface DailyMission extends DailyMissionView {
  /** Whether it can be done in this home (the others are another app's, and can be swapped). */
  here: boolean;
}

export interface DailyXp {
  /** False while the player has no hatched Blobbi (the kit's missions are for babies and adults). */
  available: boolean;
  loading: boolean;
  missions: DailyMission[];
  allComplete: boolean;
  bonusXp: number;
  /** The XP today's missions are worth so far (completed ones, and the bonus once all are done). */
  todayXp: number;
  award: AwardState;
  retryAward: () => void;
  rerollsLeft: number;
  swap: (missionId: string) => void;
  swapping: boolean;
}

/** One award at a time per player and day, across every mount in this page (a StrictMode re-run, two homes). */
const inFlight = new Map<string, Promise<AwardState>>();

export interface UseDailyXpOptions {
  pubkey: string | undefined;
  companions: readonly Pick<BlobbiCompanion, 'stage'>[];
  profile: BlobbonautProfile | null | undefined;
}

export function useDailyXp({ pubkey, companions, profile }: UseDailyXpOptions): DailyXp {
  const { nostr } = useNostr();
  const publisher = usePublishAdapter();
  const queryClient = useQueryClient();
  const stages = useMemo<BlobbiStage[]>(() => [...new Set(companions.map((c) => c.stage))].filter((s) => s !== 'egg').sort(), [companions]);
  const available = dailyXpEnabled() && !!pubkey && stages.length > 0;
  const daily = useDailyMissions({ pubkey: available ? pubkey : undefined, availableStages: available ? stages : undefined, profileContent: profile?.content });

  const updateProfileEvent = useCallback(
    (event: NostrEvent) => {
      const parsed = parseBlobbonautEvent(event);
      if (parsed && pubkey) queryClient.setQueryData<BlobbonautProfile | null>(['blobbonaut-profile', pubkey], parsed);
    },
    [queryClient, pubkey],
  );
  // The kit keeps the day's progress on the profile (debounced; never a finished day: that is the award's to write)
  usePersistDailyProgress({ pubkey: available ? pubkey : undefined, publish: publisher.publish, updateProfileEvent });
  const reroll = useRerollMission({ pubkey: available ? pubkey : undefined });

  // ─── The award ───
  const [award, setAward] = useState<AwardState>({ kind: 'idle' });
  const raw = daily.raw;
  const live = useRef({ nostr, publisher, updateProfileEvent, raw, pubkey });
  live.current = { nostr, publisher, updateProfileEvent, raw, pubkey };
  const runAward = useCallback(() => {
    const { pubkey, raw } = live.current;
    if (!pubkey || !raw) return;
    const key = `${pubkey}:${raw.date}`;
    let job = inFlight.get(key);
    if (!job) {
      job = (async (): Promise<AwardState> => {
        const { nostr, publisher, updateProfileEvent } = live.current;
        // The fresh profile, read right before signing: the only place the "paid already" rule can be decided
        const fresh = await fetchFreshBlobbonautProfile(nostr, pubkey);
        const decision = planDailyAward(fresh ?? null, raw);
        if (decision.kind === 'already-paid') return { kind: 'already' };
        if (decision.kind === 'no-profile') return { kind: 'failed', message: 'Your Blobbonaut profile could not be read from the relays.' };
        if (decision.kind !== 'award') return { kind: 'idle' };
        const event = await publisher.publish(decision.template);
        updateProfileEvent(event);
        return { kind: 'paid', xp: decision.xp };
      })();
      inFlight.set(key, job);
      // Settled, it is forgotten: a later ask reads the fresh profile again, which then says it is paid
      const forget = () => inFlight.delete(key);
      job.then(forget, forget);
    }
    setAward({ kind: 'saving' });
    job.then(setAward, (error: unknown) => setAward({ kind: 'failed', message: error instanceof Error ? error.message : 'The relays did not take it.' }));
  }, []);

  // Paid once the day's three are done; checked again whenever the day or the profile changes. A day the profile
  // already shows paid is not asked for at all
  const allComplete = daily.allComplete;
  const date = raw?.date;
  const alreadyPaid = !!date && paidFor(profile, date);
  const asked = useRef<string | null>(null);
  // A new day (the page left open past midnight): a new award to earn. Only on a real change, never on mount
  const lastDate = useRef(date);
  useEffect(() => {
    if (lastDate.current === date) return;
    lastDate.current = date;
    asked.current = null;
    setAward({ kind: 'idle' });
  }, [date]);
  useEffect(() => {
    if (!available || !allComplete || !date || !pubkey) return;
    if (date !== getTodayDateString()) return;
    const key = `${pubkey}:${date}`;
    if (asked.current === key) return;
    asked.current = key;
    if (alreadyPaid) {
      setAward({ kind: 'already' });
      return;
    }
    runAward();
  }, [available, allComplete, date, pubkey, alreadyPaid, runAward]);
  const missions = useMemo<DailyMission[]>(() => daily.missions.map((m) => ({ ...m, here: doableHere(m.id) })), [daily.missions]);
  const { mutate: rerollMutate, isPending: swapping } = reroll;
  const swap = useCallback((missionId: string) => {
    if (stages.length === 0) return;
    rerollMutate({ missionId, availableStages: stages });
  }, [rerollMutate, stages]);

  return {
    available,
    loading: available && daily.isLoading,
    missions,
    allComplete,
    bonusXp: DAILY_BONUS_XP,
    todayXp: daily.todayXp,
    award: alreadyPaid && award.kind === 'idle' && allComplete ? { kind: 'already' } : award,
    retryAward: runAward,
    rerollsLeft: daily.rerollsRemaining,
    swap,
    swapping,
  };
}
