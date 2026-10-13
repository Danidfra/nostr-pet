import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { VOICE, variantOf } from './blobbi-voice';
import { SOUND_STORAGE_KEY, type BlobbiSoundId } from './sounds';
import { createVoiceEngine, type VoiceEngine } from './voice-engine';

/**
 * The Blobbi's voice, behind one device-local preference. On by default
 * since M14.1 (a few soft creature sounds, never music or notifications),
 * off with one switch in the menu, the choice kept on this device. When on, a sound
 * is asked for by meaning (`play('poke')`) and synthesized on the spot
 * (`blobbi-voice.ts`, `voice-engine.ts`); no files, no fetch.
 *
 * The AudioContext is created the first time a sound is played. Inside a
 * user's tap (a care, a poke) autoplay policy lets it run; a sound asked
 * for outside one (a reveal, a scene opening) finds the context suspended,
 * and the engine then plays NOTHING and asks for a resume at most once per
 * gesture, never scheduling into a context that would let it all out at
 * once later; the next pointer or key event resumes it. Reduced motion is
 * a separate preference and does not mute. A sound never reaches Nostr and
 * never touches game state; a page without Web Audio simply plays nothing.
 */
/**
 * On unless the player turned it off (M14.1): a stored `off` is kept, a
 * stored `on` too, and nothing stored means on. A browser that refuses
 * storage plays on for the session.
 */
function readStored(): boolean {
  try {
    return typeof window === 'undefined' || window.localStorage.getItem(SOUND_STORAGE_KEY) !== 'off';
  } catch {
    return true;
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
  play: (id: BlobbiSoundId) => void;
}

/** The same sound within this long of itself is not played again. */
export const REPEAT_GAP_MS = 90;

const SoundContext = createContext<SoundContextValue>({ enabled: false, setEnabled: () => {}, play: () => {} });

interface SoundProviderProps {
  children: ReactNode;
  /** Test seam: the engine to play through (a fake AudioContext behind it). */
  engine?: VoiceEngine;
  /** Test seam: the numbers each playing's variation is drawn from (`Math.random` otherwise). */
  random?: () => number;
}

export function SoundProvider({ children, engine, random = Math.random }: SoundProviderProps) {
  const [enabled, setEnabledState] = useState<boolean>(() => readStored());
  const engineRef = useRef<VoiceEngine | null>(engine ?? null);
  const getEngine = useCallback(() => {
    if (!engineRef.current) engineRef.current = createVoiceEngine();
    return engineRef.current;
  }, []);

  // While sound is on, the next gesture resumes a context the browser suspended (a backgrounded tab).
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const resume = () => engineRef.current?.resume();
    window.addEventListener('pointerdown', resume, { passive: true });
    window.addEventListener('keydown', resume);
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
  }, [enabled]);

  // A hidden page plays nothing (play refuses), so its audio thread need not keep running (battery, the phone's audio session)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.hidden) engineRef.current?.suspend?.();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // The same sound asked for again within a beat is one sound (a double tap, a burst of events)
  const lastPlayed = useRef(new Map<BlobbiSoundId, number>());
  const play = useCallback(
    (id: BlobbiSoundId) => {
      if (!enabled) return;
      // Nobody hears a backgrounded tab; nothing is queued for later either
      if (typeof document !== 'undefined' && document.hidden) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const last = lastPlayed.current.get(id);
      if (last !== undefined && now - last < REPEAT_GAP_MS) return;
      lastPlayed.current.set(id, now);
      try {
        // A little different each time (`Recipe.variation`), so a creature is not a sample bank
        const recipe = VOICE[id];
        getEngine().play(recipe, variantOf(recipe, random(), random()));
      } catch {
        /* silence is fine */
      }
    },
    [enabled, getEngine, random],
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
