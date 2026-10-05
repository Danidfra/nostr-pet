import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { FloorPoint } from './geometry';
import { nextIdleDelay, planIdleAction, type IdleAction, type IdleTiming, type Random } from './idle';

export interface UseIdleBehaviorOptions {
  enabled: boolean;
  timing: IdleTiming;
  random: Random;
  /** The Blobbi's current spot, for planning. */
  position: FloorPoint;
  /** What to do with a planned action. */
  perform: (action: IdleAction) => void;
  now?: () => number;
}

export interface IdleBehavior {
  /** Tell the idle clock the player did something: idle beats wait for the inactivity period again. */
  markActivity: () => void;
}

/**
 * The idle clock. After `inactivityMs` without user input it performs one
 * small planned action every `intervalMs` (jittered). Any activity resets
 * it. Disabled while sleeping, while a user walk runs, or in tests that are
 * not about idling. The randomness comes from settings so tests script it.
 */
export function useIdleBehavior({ enabled, timing, random, position, perform, now = Date.now }: UseIdleBehaviorOptions): IdleBehavior {
  const lastActivityRef = useRef(now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ position, perform, random, timing, now });
  latest.current = { position, perform, random, timing, now };

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      return;
    }
    const schedule = (delay: number) => {
      clearTimer();
      timerRef.current = setTimeout(beat, Math.max(0, delay));
    };
    const beat = () => {
      timerRef.current = null;
      const { position, perform, random, timing, now } = latest.current;
      const since = now() - lastActivityRef.current;
      if (since < timing.inactivityMs) {
        schedule(timing.inactivityMs - since);
        return;
      }
      perform(planIdleAction(random, position));
      schedule(nextIdleDelay(random, timing));
    };
    const { timing, now } = latest.current;
    schedule(Math.max(0, timing.inactivityMs - (now() - lastActivityRef.current)));
    return clearTimer;
  }, [enabled]);

  const markActivity = useCallback(() => {
    lastActivityRef.current = latest.current.now();
  }, []);

  return useMemo(() => ({ markActivity }), [markActivity]);
}
