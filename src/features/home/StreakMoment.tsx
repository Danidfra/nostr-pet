import { useEffect } from 'react';
import { Flame } from 'lucide-react';
import type { StreakChange } from './streak';
import { streakLine } from './streak';
import { t } from '@/i18n';

/**
 * The bigger moment for a streak milestone: a card over the room for a few
 * seconds, then gone. Only ever shown for a real increase of the
 * authoritative streak (see `streak.ts`). Tapping dismisses it early.
 */
export function StreakMoment({ change, onDone, reducedMotion }: { change: StreakChange; onDone: () => void; reducedMotion: boolean }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3_600);
    return () => clearTimeout(timer);
  }, [onDone, change]);
  return (
    <button type="button" className={`streak-moment ${reducedMotion ? 'streak-moment--still' : ''}`} onClick={onDone} aria-label={t('home.streak.dismiss', { line: streakLine(change) })} data-testid="streak-moment" data-days={change.to}>
      <span className="streak-moment__flame" aria-hidden>
        <Flame className="h-8 w-8" />
      </span>
      <span className="streak-moment__days">{change.to}</span>
      <span className="streak-moment__line">{streakLine(change)}</span>
    </button>
  );
}
