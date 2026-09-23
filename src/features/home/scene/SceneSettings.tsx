import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SCENE_SETTINGS, type SceneSettings } from './scene-settings';

const SceneSettingsContext = createContext<SceneSettings>(DEFAULT_SCENE_SETTINGS);

export function SceneSettingsProvider({ children, value }: { children: ReactNode; value?: Partial<SceneSettings> }) {
  const merged = useMemo<SceneSettings>(() => ({ ...DEFAULT_SCENE_SETTINGS, ...value }), [value]);
  return <SceneSettingsContext.Provider value={merged}>{children}</SceneSettingsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hooks and provider share one context
export function useSceneSettings(): SceneSettings {
  return useContext(SceneSettingsContext);
}

function matches(query: string): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false;
  } catch {
    return false;
  }
}

/** `prefers-reduced-motion: reduce`, live, unless the settings override it. */
// eslint-disable-next-line react-refresh/only-export-components -- hooks and provider share one context
export function useReducedMotion(): boolean {
  const { reducedMotion } = useSceneSettings();
  const [prefers, setPrefers] = useState(() => matches('(prefers-reduced-motion: reduce)'));
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);
  return reducedMotion ?? prefers;
}

/** Whether the device has a pointer that can hover (a mouse or trackpad). */
// eslint-disable-next-line react-refresh/only-export-components -- hooks and provider share one context
export function useHoverCapable(): boolean {
  const [hover, setHover] = useState(() => matches('(hover: hover)'));
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(hover: hover)');
    const onChange = (e: MediaQueryListEvent) => setHover(e.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);
  return hover;
}
