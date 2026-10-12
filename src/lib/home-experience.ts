/**
 * Which home the app opens on: the room (the default since M11) or the
 * classic home (legacy, kept during the rollout). A preference of this
 * device: a player who chose the classic home in its menu keeps it; everyone
 * else opens in the room. The classic home stays one tap away in the room's
 * menu, and the room one tap away in the classic home's.
 */
import { useCallback, useState } from 'react';

export type HomeExperience = 'classic' | 'room';

export const DEFAULT_EXPERIENCE: HomeExperience = 'room';

export const EXPERIENCE_STORAGE_KEY = 'blobbi:home:experience';

/** The room's path. */
export const ROOM_PATH = '/room';

export function parseExperience(raw: unknown): HomeExperience {
  return raw === 'room' || raw === 'classic' ? raw : DEFAULT_EXPERIENCE;
}

export function readExperience(storage: Pick<Storage, 'getItem'> | null = storageOrNull()): HomeExperience {
  try {
    return parseExperience(storage?.getItem(EXPERIENCE_STORAGE_KEY));
  } catch {
    return DEFAULT_EXPERIENCE;
  }
}

export function writeExperience(value: HomeExperience, storage: Pick<Storage, 'setItem'> | null = storageOrNull()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(EXPERIENCE_STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

function storageOrNull(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The preference as state, written on each change. */
export function useHomeExperience(): [HomeExperience, (next: HomeExperience) => void] {
  const [value, setValue] = useState<HomeExperience>(() => readExperience());
  const set = useCallback((next: HomeExperience) => {
    setValue(next);
    writeExperience(next);
  }, []);
  return [value, set];
}

/** The navigation state the room's way back carries, so the home does not send the player straight back to the room. */
export interface FromRoomState {
  fromRoom: true;
}

export function cameFromRoom(state: unknown): boolean {
  return !!state && typeof state === 'object' && (state as Partial<FromRoomState>).fromRoom === true;
}
