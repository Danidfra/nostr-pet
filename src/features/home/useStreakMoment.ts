import { useCallback, useEffect, useRef, useState } from 'react';
import { detectStreakIncrease, type StreakChange } from './streak';

/**
 * The care streak's moment, for both homes: noticed only when the
 * authoritative number goes up between two versions of this Blobbi (a care
 * write on a new day), never on load. `bump` changes with every increase,
 * so the HUD's flame can pulse; `moment` is the change to celebrate (bigger
 * on the milestones) until `dismiss`.
 */
export function useStreakMoment(careStreak: number | undefined): { moment: StreakChange | null; bump: number; dismiss: () => void } {
  const [moment, setMoment] = useState<StreakChange | null>(null);
  const [bump, setBump] = useState(0);
  const last = useRef(careStreak);
  useEffect(() => {
    const change = detectStreakIncrease(last.current, careStreak);
    last.current = careStreak;
    if (!change) return;
    setBump((k) => k + 1);
    setMoment(change);
  }, [careStreak]);
  const dismiss = useCallback(() => setMoment(null), []);
  return { moment, bump, dismiss };
}
