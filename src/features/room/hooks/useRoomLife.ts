/**
 * A Blobbi's life in its room: the beats of `room-life.ts` played over
 * time. One controller for both drawings: it decides WHAT happens (a glance,
 * a stroll, a stretch); the room maps it onto the 2D drawing (the kit's eye
 * offset, a gesture on the box around it) or the 3D model (the same eye
 * offset in its eyes, the same gesture on its body).
 *
 * It only lives when nothing else is going on: `enabled` is the caller's
 * whole say (awake, in the room, not decorating, nothing carried or being
 * used), and any touch of the player's (`markActivity`) holds it off for a
 * while. A hidden tab skips its beats; disabling or unmounting it clears
 * every timer and any glance in progress. It never writes anything: a
 * stroll is a walk like a floor tap's, and an item is never touched.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EyeOffset } from '@/features/home/scene/gaze';
import type { WalkOutcome } from '@/features/home/scene/useBlobbiLocomotion';
import type { PokeGesture } from '@/features/home/personality';
import { ROOM_LIFE_TIMING, nextBeatDelay, planLifeBeat, type LifeTiming, type Random } from '../lib/room-life';

export interface UseRoomLifeOptions {
  /** It may live now (awake, present, not decorating, nothing in hand or in use). */
  enabled: boolean;
  /** It may walk (a 3D room, motion welcome); otherwise its beats keep to its eyes and body. */
  canWalk: boolean;
  /** Where it stands, in tiles. */
  position: () => { x: number; z: number } | null;
  walkTo: (x: number, z: number) => Promise<WalkOutcome>;
  gesture: (kind: PokeGesture) => void;
  random?: Random;
  timing?: LifeTiming;
}

export interface RoomLife {
  /** Where its eyes wander this moment, or null. */
  glance: EyeOffset | null;
  /** The player did something: hold the Blobbi's own life off for a while. */
  markActivity: () => void;
}

export function useRoomLife({ enabled, canWalk, position, walkTo, gesture, random = Math.random, timing = ROOM_LIFE_TIMING }: UseRoomLifeOptions): RoomLife {
  const [glance, setGlance] = useState<EyeOffset | null>(null);
  const lastActivity = useRef(Date.now());
  const beatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The latest of everything a beat reads, so the loop is not rebuilt on each render
  const live = useRef({ canWalk, position, walkTo, gesture, random, timing });
  live.current = { canWalk, position, walkTo, gesture, random, timing };

  const endGlance = useCallback(() => {
    if (glanceTimer.current) clearTimeout(glanceTimer.current);
    glanceTimer.current = null;
    setGlance(null);
  }, []);

  const markActivity = useCallback(() => {
    lastActivity.current = Date.now();
    endGlance();
  }, [endGlance]);

  useEffect(() => {
    if (!enabled) {
      endGlance();
      return;
    }
    let cancelled = false;
    const schedule = (ms: number) => {
      if (beatTimer.current) clearTimeout(beatTimer.current);
      beatTimer.current = setTimeout(beat, ms);
    };
    function beat() {
      if (cancelled) return;
      const { random: rnd, timing: t } = live.current;
      const quietFor = Date.now() - lastActivity.current;
      // Nobody watching, or the player busy: wait
      if (typeof document !== 'undefined' && document.hidden) return schedule(nextBeatDelay(rnd, t));
      if (quietFor < t.quietMs) return schedule(t.quietMs - quietFor + 50);
      const at = live.current.position();
      const plan = planLifeBeat(rnd, { at: at ?? { x: 4, z: 4 }, canWalk: live.current.canWalk && at !== null });
      if (plan.type === 'glance') {
        setGlance(plan.offset);
        if (glanceTimer.current) clearTimeout(glanceTimer.current);
        glanceTimer.current = setTimeout(() => {
          glanceTimer.current = null;
          setGlance(null);
        }, plan.durationMs);
      } else if (plan.type === 'stroll') {
        void live.current.walkTo(plan.x, plan.z);
      } else if (plan.type === 'stretch') {
        live.current.gesture('stir');
      }
      schedule(nextBeatDelay(rnd, t));
    }
    schedule(nextBeatDelay(live.current.random, live.current.timing));
    return () => {
      cancelled = true;
      if (beatTimer.current) clearTimeout(beatTimer.current);
      beatTimer.current = null;
      endGlance();
    };
  }, [enabled, endGlance]);

  return { glance, markActivity };
}
