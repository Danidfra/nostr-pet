import { useCallback, useMemo, useRef, useState } from 'react';
import type { DepartureOutcome, HomeTravel } from '@/features/presence/useHomeTravel';
import type { World } from './worlds';
import type { NavigateOutcome } from './useWorldDeparture';

/**
 * The page leaving for another world, shared by both homes. The move to the
 * world chosen (`HomeTravel.departTo`: one World Location signed and
 * published from here) happens HERE, when the goodbye is over and the page is
 * about to go: nothing is signed or published while Stay is still offered
 * (`useWorldDeparture` calls `navigate` only at `gone`). One event per trip:
 * once it was published (the world is remembered), a try again after a
 * navigation that did not happen only asks for the address again; `newTrip`
 * forgets it when another trip begins.
 *
 * `travelRef` is set by the home to its `useHomeTravel` once that exists
 * (it is created after the departure that needs this `navigate`).
 */
export function useDepartureNavigation() {
  const travelRef = useRef<HomeTravel | null>(null);
  const leftFor = useRef<string | null>(null);
  const [signing, setSigning] = useState(false);
  const navigate = useCallback(async (url: string, world: World): Promise<NavigateOutcome | void> => {
    let left = leftFor.current === world.travelId;
    const travel = travelRef.current;
    if (!left && travel) {
      setSigning(travel.signerPrompts);
      try {
        const outcome: DepartureOutcome = await travel.departTo(world.travelId);
        left = outcome === 'moved' || outcome === 'already-there';
      } finally {
        setSigning(false);
      }
    }
    if (left) leftFor.current = world.travelId;
    // No key travels, and nothing rides in the address: the other world asks for its own sign-in and reads the move
    window.location.assign(url);
    return left ? 'left' : undefined;
  }, []);
  const newTrip = useCallback(() => {
    leftFor.current = null;
  }, []);
  return useMemo(() => ({ travelRef, signing, navigate, newTrip }), [signing, navigate, newTrip]);
}
