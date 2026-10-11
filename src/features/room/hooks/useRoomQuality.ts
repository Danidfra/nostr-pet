/**
 * The room's rendering quality (`room-quality.ts`) in React.
 *
 *   preference   the player's: auto (default), high, balanced or low, kept on
 *                this device (`blobbi:room:quality`); an explicit choice is
 *                never changed by the room
 *   auto level   in auto: a first guess from the device (refined once the
 *                scene can name its GPU), lowered a step at a time when the
 *                scene measures sustained slowness (`onSlow`), never raised by
 *                itself; what it learns is remembered on this device
 *                (`blobbi:room:quality:learned`), so the next visit starts there
 *   settings     what the scene is asked to draw at
 *
 * Nothing leaves the device.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { QUALITY, QUALITY_LEVELS, QUALITY_STORAGE_KEY, initialQuality, lowerQuality, parseQualityPreference, readDeviceSignals, type QualityLevel, type QualityPreference, type QualitySettings } from '../lib/room-quality';
import { readItem, safeStorage, writeItem, type MemoryStorage } from '../lib/room-memory';

export const QUALITY_LEARNED_KEY = 'blobbi:room:quality:learned';

export interface RoomQuality {
  preference: QualityPreference;
  setPreference: (preference: QualityPreference) => void;
  /** The level drawn at now. */
  level: QualityLevel;
  settings: QualitySettings;
  /** In auto, how the level came to be: the device's first guess, or what the room measured. */
  reason: 'chosen' | 'device' | 'measured';
  /** The scene measured sustained slowness (it lowers the level, in auto). */
  onSlow: () => void;
  /** The scene can name its GPU now: refine the first guess (in auto, never raising a measured level). */
  onGpu: (gpu: string | undefined) => void;
}

function lowest(a: QualityLevel, b: QualityLevel): QualityLevel {
  return QUALITY_LEVELS.indexOf(a) >= QUALITY_LEVELS.indexOf(b) ? a : b;
}

export function useRoomQuality(storage: MemoryStorage | null = safeStorage()): RoomQuality {
  const store = useRef(storage);
  const [preference, setPref] = useState<QualityPreference>(() => parseQualityPreference(readItem(store.current, QUALITY_STORAGE_KEY)));
  const [auto, setAuto] = useState<{ level: QualityLevel; reason: 'device' | 'measured' }>(() => {
    const learnedRaw = readItem(store.current, QUALITY_LEARNED_KEY);
    const learned = learnedRaw && (QUALITY_LEVELS as readonly string[]).includes(learnedRaw) ? (learnedRaw as QualityLevel) : null;
    const guess = initialQuality(readDeviceSignals());
    return learned ? { level: lowest(guess, learned), reason: 'measured' } : { level: guess, reason: 'device' };
  });

  const setPreference = useCallback((next: QualityPreference) => {
    setPref(next);
    writeItem(store.current, QUALITY_STORAGE_KEY, next);
  }, []);

  const onSlow = useCallback(() => {
    setAuto((a) => {
      const level = lowerQuality(a.level);
      if (level === a.level) return a;
      writeItem(store.current, QUALITY_LEARNED_KEY, level);
      return { level, reason: 'measured' };
    });
  }, []);

  const onGpu = useCallback((gpu: string | undefined) => {
    if (!gpu) return;
    const guess = initialQuality(readDeviceSignals(gpu));
    setAuto((a) => (QUALITY_LEVELS.indexOf(guess) > QUALITY_LEVELS.indexOf(a.level) ? { level: guess, reason: a.reason } : a));
  }, []);

  const level = preference === 'auto' ? auto.level : preference;
  return useMemo(
    () => ({ preference, setPreference, level, settings: QUALITY[level], reason: preference === 'auto' ? auto.reason : 'chosen', onSlow: preference === 'auto' ? onSlow : () => {}, onGpu }),
    [preference, setPreference, level, auto.reason, onSlow, onGpu],
  );
}
