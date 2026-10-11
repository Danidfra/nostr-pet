/**
 * Which home the app opens on: the classic home (the default, for now) or
 * the 3D room (beta). A preference of this device, chosen by the player in
 * the menu, never set for them: nobody is moved to the room without asking.
 * The classic home stays one tap away from the room, and the room one tap
 * away from the classic home, whatever is chosen.
 *
 * Flip `DEFAULT_EXPERIENCE` to make the room the default once it is
 * approved; nothing else changes.
 */
import { useCallback, useState } from 'react';

export type HomeExperience = 'classic' | 'room';

export const DEFAULT_EXPERIENCE: HomeExperience = 'classic';

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
