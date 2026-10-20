/**
 * Leaving for another world, as a short scene: the Blobbi notices, says
 * goodbye, gathers itself and dissolves into motes (the teleport's own
 * departure, `usePresence`), and only when the departure has finished does
 * the page navigate. One departure at a time: a second tap, or a tap on
 * another world, is ignored until this one ends or is cancelled.
 *
 *   noticing   it looks up at the player, surprised (a moment)
 *   waving     a happy little wiggle and a "bye" (a moment)
 *   leaving    the teleport's departure plays; at its end, navigation
 *   gone       navigation was asked for; if the page is still here after
 *              `FAIL_MS` (a blocked or failed navigation), it comes back
 *              (arrives) and says so
 *
 * Stay (`cancel`) ends it at any moment before navigation: the Blobbi is
 * simply here again. Reduced motion: no wave, the teleport's short fade.
 * A Blobbi that cannot act (an egg, asleep, away) does not perform: the
 * page goes at once. Coming back with the browser's Back from a cached page
 * restores it, here.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PokeGesture } from '@/features/home/personality';
import type { BlobbiSoundId } from '@/features/sound/sounds';
import type { ExpressionName } from '@/features/expression/faces';
import { PRIORITY } from '@/features/expression/controller';
import type { World } from './worlds';
import { isTravelUrl } from './worlds';

export type DeparturePhase = 'idle' | 'noticing' | 'waving' | 'leaving' | 'gone' | 'failed';

export const DEPARTURE = { noticeMs: 450, waveMs: 900, reducedNoticeMs: 150, reducedWaveMs: 0, failMs: 5_000 } as const;

interface PresenceLike {
  state: 'present' | 'departing' | 'absent' | 'arriving';
  leave: () => boolean;
  enter: () => boolean;
  cancel: () => void;
}

export interface UseWorldDepartureOptions {
  presence: PresenceLike;
  /** Awake, hatched and here: it performs the goodbye. Otherwise the page goes at once. */
  canAct: boolean;
  reducedMotion: boolean;
  showFace: (source: string, name: ExpressionName, options?: { priority?: number; durationMs?: number }) => void;
  clearFace: (source: string) => void;
  gesture: (kind: PokeGesture) => void;
  play: (sound: BlobbiSoundId) => void;
  /**
   * How the page goes somewhere else (default: this tab's navigation). It may take a moment first (the signer's word
   * on the World Travel hand-off): the wait for a navigation that never happens starts once it has returned.
   */
  navigate?: (url: string, world: World) => void | Promise<unknown>;
  failMs?: number;
}

export interface WorldDeparture {
  phase: DeparturePhase;
  world: World | null;
  /** Start leaving for a world. False when it cannot (not open, already leaving). */
  go: (world: World & { open: boolean }) => boolean;
  /** Stay: ends the departure before the page goes. */
  cancel: () => void;
}

const FACE = 'departure';

export function useWorldDeparture({ presence, canAct, reducedMotion, showFace, clearFace, gesture, play, navigate = (url) => window.location.assign(url), failMs = DEPARTURE.failMs }: UseWorldDepartureOptions): WorldDeparture {
  const [phase, setPhase] = useState<DeparturePhase>('idle');
  const [world, setWorld] = useState<World | null>(null);
  const phaseRef = useRef<DeparturePhase>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const live = useRef({ presence, showFace, clearFace, gesture, play, navigate, reducedMotion, failMs });
  live.current = { presence, showFace, clearFace, gesture, play, navigate, reducedMotion, failMs };

  const set = useCallback((next: DeparturePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const after = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const goNow = useCallback((target: World) => {
    set('gone');
    const back = () => {
      if (phaseRef.current !== 'gone') return;
      set('failed');
      live.current.clearFace(FACE);
      live.current.presence.enter();
    };
    let asked: Promise<unknown>;
    try {
      asked = Promise.resolve(live.current.navigate(target.url!, target));
    } catch {
      back();
      return;
    }
    asked.then(
      () => {
        // Asked: still here a while later, the navigation did not happen (blocked, offline, refused)
        if (phaseRef.current !== 'gone') return;
        after(live.current.failMs, () => {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
          back();
        });
      },
      () => back(),
    );
  }, [set]);

  const go = useCallback((target: World & { open: boolean }): boolean => {
    if (!target.open || !isTravelUrl(target.url)) return false;
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'failed') return false;
    clearTimers();
    setWorld(target);
    const o = live.current;
    if (!canAct) {
      goNow(target);
      return true;
    }
    set('noticing');
    o.showFace(FACE, 'surprised', { priority: PRIORITY.journey });
    o.play('curious');
    const notice = o.reducedMotion ? DEPARTURE.reducedNoticeMs : DEPARTURE.noticeMs;
    const wave = o.reducedMotion ? DEPARTURE.reducedWaveMs : DEPARTURE.waveMs;
    const leave = () => {
      set('leaving');
      live.current.clearFace(FACE);
      if (!live.current.presence.leave()) goNow(target);
    };
    after(notice, () => {
      set('waving');
      live.current.showFace(FACE, 'happy', { priority: PRIORITY.journey });
      if (!live.current.reducedMotion) live.current.gesture('wiggle');
      live.current.play('happy');
      // Reduced motion: no wave to wait for
      if (wave > 0) after(wave, leave);
      else leave();
    });
    return true;
  }, [canAct, goNow, set]);

  // The departure has played to its end: now the page goes
  useEffect(() => {
    if (phase === 'leaving' && presence.state === 'absent' && world) goNow(world);
  }, [phase, presence.state, world, goNow]);

  const cancel = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'idle' || p === 'gone') return;
    clearTimers();
    live.current.clearFace(FACE);
    live.current.presence.cancel();
    setWorld(null);
    set('idle');
  }, [set]);

  // Back from the other world with the browser's Back (a cached page): here again, nothing half way
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      const left = phaseRef.current === 'gone';
      clearTimers();
      live.current.clearFace(FACE);
      // It had dissolved before the page went: it comes back (cancel only ends a journey still under way)
      if (left && live.current.presence.state === 'absent') live.current.presence.enter();
      else live.current.presence.cancel();
      setWorld(null);
      set('idle');
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [set]);
  useEffect(() => () => clearTimers(), []);

  return { phase, world, go, cancel };
}
