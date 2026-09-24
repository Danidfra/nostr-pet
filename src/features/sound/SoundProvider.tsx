import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SOUND_FILES, SOUND_STORAGE_KEY, type SoundId } from './sounds';

/**
 * A few short sounds for the moments that deserve one. Off by default, one
 * device-local preference, never blocking: a sound that cannot play (autoplay
 * policy, missing file, muted tab) is simply not heard.
 *
 * The files are the old app's own effects, recovered from Git history and
 * trimmed to the four that fit the current interactions.
 */
function readStored(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(SOUND_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function writeStored(enabled: boolean): void {
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    /* the choice still applies for this session */
  }
}

interface SoundContextValue {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  /** Play a sound if enabled. Never throws, never awaits. */
  play: (id: SoundId) => void;
}

const SoundContext = createContext<SoundContextValue>({ enabled: false, setEnabled: () => {}, play: () => {} });

interface SoundProviderProps {
  children: ReactNode;
  /** Test seam: replaces `new Audio(src)`. */
  createAudio?: (src: string) => { play: () => Promise<void> | void; volume: number };
}

export function SoundProvider({ children, createAudio }: SoundProviderProps) {
  const [enabled, setEnabledState] = useState<boolean>(() => readStored());
  const cacheRef = useRef<Map<SoundId, { play: () => Promise<void> | void; volume: number }>>(new Map());

  const factory = useCallback(
    (src: string) => {
      if (createAudio) return createAudio(src);
      if (typeof Audio === 'undefined') return null;
      const audio = new Audio(src);
      audio.preload = 'auto';
      return audio;
    },
    [createAudio],
  );

  // Warm the cache when sound is turned on, so the first play is not late.
  useEffect(() => {
    if (!enabled) return;
    for (const id of Object.keys(SOUND_FILES) as SoundId[]) {
      if (!cacheRef.current.has(id)) {
        const audio = factory(SOUND_FILES[id]);
        if (audio) cacheRef.current.set(id, audio);
      }
    }
  }, [enabled, factory]);

  const play = useCallback(
    (id: SoundId) => {
      if (!enabled) return;
      let audio = cacheRef.current.get(id);
      if (!audio) {
        const created = factory(SOUND_FILES[id]);
        if (!created) return;
        cacheRef.current.set(id, created);
        audio = created;
      }
      try {
        audio.volume = 0.6;
        const result = audio.play();
        if (result && typeof (result as Promise<void>).catch === 'function') (result as Promise<void>).catch(() => {});
      } catch {
        /* autoplay policy or a missing file: silence is fine */
      }
    },
    [enabled, factory],
  );

  const setEnabled = useCallback((value: boolean) => {
    writeStored(value);
    setEnabledState(value);
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled, play }), [enabled, setEnabled, play]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook and provider share one context
export function useSound(): SoundContextValue {
  return useContext(SoundContext);
}
