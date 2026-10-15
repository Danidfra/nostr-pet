/**
 * Moments a companion switch must wait for. A care write, a bath, a dose of
 * medicine, a hatch or evolution, a departure to another world: while any is
 * on screen, a newer choice made in another app is not applied (the shown
 * Blobbi stays); it is applied as soon as the last such moment ends.
 * A choice the player makes here is theirs, and applies at once.
 */
import { useEffect, useSyncExternalStore } from 'react';

let holds = 0;
const listeners = new Set<() => void>();
const notify = () => {
  for (const l of [...listeners]) l();
};

export const switchHolds = {
  held: () => holds > 0,
  hold(): () => void {
    holds++;
    notify();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      holds--;
      notify();
    };
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** Hold companion switches while `active`. */
export function useCompanionSwitchHold(active: boolean): void {
  useEffect(() => (active ? switchHolds.hold() : undefined), [active]);
}

export function useCompanionSwitchHeld(): boolean {
  return useSyncExternalStore(switchHolds.subscribe, switchHolds.held, switchHolds.held);
}
