import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { islandTimeAt, msUntilNextIslandTick, type IslandPhase, type IslandTime } from './island-clock';
import { APPEARANCE_COPY, APPEARANCES, DEFAULT_APPEARANCE, PHASE_LOOKS, isAppearance, resolvePhase, type Appearance, type PhaseLook } from './environments';
import { applyPhaseToDocument, readStoredAppearance, writeStoredAppearance } from './appearance-storage';

interface EnvironmentContextValue {
  /** The Island's time right now. */
  island: IslandTime;
  /** The phase actually shown (the appearance may lock it). */
  phase: IslandPhase;
  look: PhaseLook;
  appearance: Appearance;
  appearances: readonly Appearance[];
  copy: typeof APPEARANCE_COPY;
  setAppearance: (value: Appearance) => void;
}

/**
 * Without a provider (a test that is not about lighting, a stray preview),
 * the environment is the Island's current time with a setter that does
 * nothing. The app always mounts the provider.
 */
function fallbackValue(): EnvironmentContextValue {
  const island = islandTimeAt(Date.now());
  return { island, phase: island.phase, look: PHASE_LOOKS[island.phase], appearance: DEFAULT_APPEARANCE, appearances: APPEARANCES, copy: APPEARANCE_COPY, setAppearance: () => {} };
}

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null);

interface EnvironmentProviderProps {
  children: ReactNode;
  initialAppearance?: Appearance;
  /** Test seam: the clock to read. */
  now?: () => number;
}

/**
 * The home's lighting. One timer, aligned to the Island's tick boundaries so
 * every client steps at the same instants. Publishes nothing; persists only
 * the appearance choice on this device.
 */
export function EnvironmentProvider({ children, initialAppearance, now = Date.now }: EnvironmentProviderProps) {
  const [appearance, setAppearanceState] = useState<Appearance>(() => initialAppearance ?? readStoredAppearance());
  const [island, setIsland] = useState<IslandTime>(() => islandTimeAt(now()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      setIsland((prev) => {
        const next = islandTimeAt(now());
        return prev.phase === next.phase && Math.abs(prev.phaseProgress - next.phaseProgress) < 1e-6 ? prev : next;
      });
      timer = setTimeout(tick, msUntilNextIslandTick(now()));
    };
    timer = setTimeout(tick, msUntilNextIslandTick(now()));
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [now]);

  const phase = resolvePhase(appearance, island.phase);
  const look = PHASE_LOOKS[phase];

  useEffect(() => {
    applyPhaseToDocument(look);
  }, [look]);

  const setAppearance = useCallback((value: Appearance) => {
    const next = isAppearance(value) ? value : DEFAULT_APPEARANCE;
    writeStoredAppearance(next);
    setAppearanceState(next);
  }, []);

  const value = useMemo<EnvironmentContextValue>(
    () => ({ island, phase, look, appearance, appearances: APPEARANCES, copy: APPEARANCE_COPY, setAppearance }),
    [island, phase, look, appearance, setAppearance],
  );
  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook and provider share one context
export function useEnvironment(): EnvironmentContextValue {
  const ctx = useContext(EnvironmentContext);
  return ctx ?? fallbackValue();
}
