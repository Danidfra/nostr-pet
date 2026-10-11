/**
 * Petting: purely a moment between the player and the Blobbi. Nothing is
 * written, no stat changes, no care is started.
 *
 *   start    eyes closed in contentment, a smile and a blush (the
 *            "affectionate" face), a soft purr, a heart; a walk stops so it
 *            can enjoy it
 *   stroke   now and then a happy little wiggle and another heart (never
 *            more often than `PET_BEAT_MS`, so a frantic rub is no frantic
 *            Blobbi), the purr again now and then
 *   end      the contentment lingers a moment, then a glad face
 *
 * Off while it travels, changes room, is cared for, sleeps, or is being
 * decorated around. Reduced motion: the face and the purr, no wiggles and no
 * hearts.
 */
import { useCallback, useRef, useState } from 'react';
import { PRIORITY } from '@/features/expression/controller';
import type { ExpressionName } from '@/features/expression/faces';
import type { BlobbiSoundId } from '@/features/sound/sounds';
import type { PokeGesture } from '@/features/home/personality';

/** The least time between two wiggles (and two hearts) while being stroked. */
export const PET_BEAT_MS = 650;
/** The least time between two purrs. */
const PURR_MS = 1400;
/** How long contentment lingers after the hand lifts, then how long the glad face shows. */
const LINGER_MS = 700;
const GLAD_MS = 1200;

interface UsePettingOptions {
  enabled: boolean;
  reducedMotion: boolean;
  showFace: (source: string, name: ExpressionName, options?: { priority?: number; durationMs?: number }) => void;
  clearFace: (source: string) => void;
  gesture: (kind: PokeGesture) => void;
  play: (sound: BlobbiSoundId) => void;
  /** Something the player did (its own life waits). */
  markActivity: () => void;
  /** Stop a walk under way. */
  stop: () => void;
  now?: () => number;
}

export interface Petting {
  onPet: (phase: 'start' | 'stroke' | 'end') => void;
  /** Changes with each heart to show (0: none yet). */
  heart: number;
  petting: boolean;
}

export function usePetting({ enabled, reducedMotion, showFace, clearFace, gesture, play, markActivity, stop, now = () => performance.now() }: UsePettingOptions): Petting {
  const [heart, setHeart] = useState(0);
  const [petting, setPetting] = useState(false);
  const last = useRef({ beat: -Infinity, purr: -Infinity });
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opts = useRef({ enabled, reducedMotion, showFace, clearFace, gesture, play, markActivity, stop, now });
  opts.current = { enabled, reducedMotion, showFace, clearFace, gesture, play, markActivity, stop, now };

  const beat = useCallback((first: boolean) => {
    const o = opts.current;
    const t = o.now();
    if (t - last.current.purr >= PURR_MS) {
      last.current.purr = t;
      o.play('pet');
    }
    if (o.reducedMotion || (!first && t - last.current.beat < PET_BEAT_MS)) return;
    last.current.beat = t;
    setHeart((h) => h + 1);
    if (!first) o.gesture('wiggle');
  }, []);

  const onPet = useCallback(
    (phase: 'start' | 'stroke' | 'end') => {
      const o = opts.current;
      if (!o.enabled) {
        if (phase === 'end') setPetting(false);
        return;
      }
      o.markActivity();
      if (phase === 'start') {
        if (lingerTimer.current) clearTimeout(lingerTimer.current);
        o.stop();
        setPetting(true);
        o.showFace('petting', 'affectionate', { priority: PRIORITY.petting });
        beat(true);
      } else if (phase === 'stroke') {
        beat(false);
      } else {
        setPetting(false);
        if (lingerTimer.current) clearTimeout(lingerTimer.current);
        lingerTimer.current = setTimeout(() => {
          lingerTimer.current = null;
          opts.current.showFace('petting', 'happy', { priority: PRIORITY.petting, durationMs: GLAD_MS });
        }, LINGER_MS);
      }
    },
    [beat],
  );

  return { onPet, heart, petting };
}
