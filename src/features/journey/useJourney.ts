/**
 * The journey's facts, gathered (`journey.ts` builds the chapters from them):
 *
 *   care given    a read of the player's kind 1124 receipts (any Blobbi, any
 *                 Blobbi app), plus what landed in this session before the
 *                 read catches up: which kinds of care, and on which local
 *                 calendar days (two different days finish "Two days
 *                 together"; never "in a row", so a day off undoes nothing)
 *   level         the Blobbonaut profile's XP (kind 11125), the kit's levels
 *   device        `blobbi:journey:v1:<pubkey>` in this browser: a first
 *                 cuddle, a nap, which chapters were celebrated here
 *
 * The device record holds only presentation (a petting and a rest are never
 * written anywhere) and never unlocks anything. A chapter is celebrated once
 * per device: the first time the journey is seen on a device, chapters
 * already finished are recorded as celebrated without a celebration, so an
 * old player is not greeted by four at once.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { KIND_BLOBBI_INTERACTION, getUnlocks, parseInteractionEvent, xpToLevel, type BlobbiCompanion, type BlobbonautProfile } from '@blobbi-kit/core';
import { timeoutSignal } from '@/lib/abort';
import type { LifecycleTask } from '@/features/lifecycle';
import { buildJourney, newlyFinished, type CareAction, type Chapter, type ChapterId } from './journey';

const READ_TIMEOUT_MS = 8_000;
const STORE_VERSION = 1;
const ACTIONS: readonly CareAction[] = ['feed', 'play', 'clean', 'medicate', 'boost'];

/** A moment's local calendar day (YYYY-MM-DD), the way the kit's streak and daily missions count days. */
export function localDay(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

export interface JourneyDeviceRecord {
  petted: boolean;
  napped: boolean;
  celebrated: ChapterId[];
  /** The journey has been worked out on this device before (finished chapters are celebrated from then on). */
  seeded: boolean;
}

const EMPTY: JourneyDeviceRecord = { petted: false, napped: false, celebrated: [], seeded: false };

export function journeyStoreKey(pubkey: string | undefined): string {
  return `blobbi:journey:v${STORE_VERSION}:${pubkey ?? 'anon'}`;
}

export function parseJourneyRecord(text: string | null): JourneyDeviceRecord {
  if (!text) return EMPTY;
  try {
    const raw = JSON.parse(text) as Partial<JourneyDeviceRecord>;
    const ids: ChapterId[] = ['beginning', 'first-steps', 'growing', 'family'];
    return {
      petted: raw.petted === true,
      napped: raw.napped === true,
      celebrated: Array.isArray(raw.celebrated) ? raw.celebrated.filter((c): c is ChapterId => ids.includes(c as ChapterId)) : [],
      seeded: raw.seeded === true,
    };
  } catch {
    return EMPTY;
  }
}

function readRecord(key: string): JourneyDeviceRecord {
  try {
    return parseJourneyRecord(window.localStorage.getItem(key));
  } catch {
    return EMPTY;
  }
}

function writeRecord(key: string, record: JourneyDeviceRecord) {
  try {
    window.localStorage.setItem(key, JSON.stringify(record));
  } catch {
    /* kept for this visit */
  }
}

export interface UseJourneyOptions {
  pubkey: string | undefined;
  companions: readonly Pick<BlobbiCompanion, 'stage'>[];
  current: Pick<BlobbiCompanion, 'stage' | 'progressionState'>;
  profile: BlobbonautProfile | null | undefined;
  evolveTasks: readonly LifecycleTask[];
}

export interface Journey {
  chapters: Chapter[];
  /** The canonical answer to "may another egg join": the kit's unlock for the profile's level, against what is owned. */
  canAdoptMore: boolean;
  maxBlobbis: number;
  level: number;
  /** Care landed in this session (counted before the relays' read catches up). */
  noteCare: (action: string) => void;
  notePetted: () => void;
  noteNapped: () => void;
  /** A chapter just finished, to celebrate (once), or null. */
  celebrate: ChapterId | null;
  dismissCelebration: () => void;
}

export function useJourney({ pubkey, companions, current, profile, evolveTasks }: UseJourneyOptions): Journey {
  const { nostr } = useNostr();
  const key = journeyStoreKey(pubkey);
  const [record, setRecord] = useState<JourneyDeviceRecord>(() => readRecord(key));
  useEffect(() => setRecord(readRecord(key)), [key]);
  const update = useCallback(
    (patch: (r: JourneyDeviceRecord) => JourneyDeviceRecord) => {
      setRecord((r) => {
        const next = patch(r);
        if (next !== r) writeRecord(key, next);
        return next;
      });
    },
    [key],
  );

  const care = useQuery({
    queryKey: ['journey-care', pubkey],
    enabled: !!pubkey,
    staleTime: 60_000,
    queryFn: async () => {
      const events = await nostr.query([{ kinds: [KIND_BLOBBI_INTERACTION], authors: [pubkey!], limit: 500 }], { signal: timeoutSignal(READ_TIMEOUT_MS) });
      const seen = new Set<CareAction>();
      const days = new Set<string>();
      for (const event of events) {
        const parsed = parseInteractionEvent(event);
        if (parsed && (ACTIONS as readonly string[]).includes(parsed.action)) {
          seen.add(parsed.action as CareAction);
          days.add(localDay(new Date(event.created_at * 1000)));
        }
      }
      return { actions: [...seen], days: [...days] };
    },
  });
  const [session, setSession] = useState<CareAction[]>([]);
  const noteCare = useCallback((action: string) => {
    const a = (action === 'medicine' ? 'medicate' : action) as CareAction;
    if (!(ACTIONS as readonly string[]).includes(a)) return;
    setSession((s) => (s.includes(a) ? s : [...s, a]));
  }, []);
  const careGiven = useMemo(() => (care.data || session.length ? new Set<CareAction>([...(care.data?.actions ?? []), ...session]) : care.isError ? new Set<CareAction>() : undefined), [care.data, care.isError, session]);
  // The days care was given on: the receipts' days, and today when care landed in this session
  const today = localDay(new Date());
  const careDays = useMemo(() => {
    const days = new Set(care.data?.days ?? []);
    if (session.length) days.add(today);
    return { count: days.size, today: days.has(today) };
  }, [care.data, session.length, today]);

  const xp = profile?.xp;
  const level = xpToLevel(xp ?? 0);
  const maxBlobbis = getUnlocks(level).maxBlobbis;
  const stages = useMemo(() => companions.map((c) => c.stage), [companions]);
  const chapters = useMemo(
    () => buildJourney({ stages, current: { stage: current.stage, progressionState: current.progressionState }, careGiven, careDays, device: { petted: record.petted, napped: record.napped }, evolveTasks, xp, level, maxBlobbis }),
    [stages, current.stage, current.progressionState, careGiven, careDays, record.petted, record.napped, evolveTasks, xp, level, maxBlobbis],
  );

  // Celebrations: once per chapter per device; the first look on a device records what is already done, quietly
  const ready = careGiven !== undefined;
  const [celebrate, setCelebrate] = useState<ChapterId | null>(null);
  const celebrated = useMemo(() => new Set(record.celebrated), [record.celebrated]);
  const fresh = useMemo(() => (ready ? newlyFinished(chapters, celebrated) : []), [ready, chapters, celebrated]);
  const freshKey = fresh.join(',');
  const seededRef = useRef(record.seeded);
  seededRef.current = record.seeded;
  useEffect(() => {
    if (!ready || !pubkey) return;
    if (!seededRef.current) {
      update((r) => ({ ...r, seeded: true, celebrated: [...new Set([...r.celebrated, ...fresh])] }));
      return;
    }
    if (fresh.length === 0) return;
    setCelebrate(fresh[fresh.length - 1]);
    update((r) => ({ ...r, celebrated: [...new Set([...r.celebrated, ...fresh])] }));
    // The finished chapters themselves are what matter, not the array's identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pubkey, freshKey, update]);

  return {
    chapters,
    canAdoptMore: !!pubkey && stages.length < maxBlobbis,
    maxBlobbis,
    level,
    noteCare,
    notePetted: useCallback(() => update((r) => (r.petted ? r : { ...r, petted: true })), [update]),
    noteNapped: useCallback(() => update((r) => (r.napped ? r : { ...r, napped: true })), [update]),
    celebrate,
    dismissCelebration: useCallback(() => setCelebrate(null), []),
  };
}
