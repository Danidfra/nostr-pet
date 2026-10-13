/**
 * Which home the app opens on: the 2D home (`classic`, the default again
 * since M13: a first Blobbi is born into it) or the 3D room (`room`). A
 * preference of this device, written only by the player's own choice: the
 * "Open in" switches, or going to one home from the other's menu. Nothing
 * stored means the 2D home, which is what every build before M11 opened on;
 * a stored choice, either one, is kept as it is.
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

/**
 * Whether the 3D room's introduction was seen on this device (M14.1): the
 * first choice of 3D opens it (experimental, the 2D home one tap away,
 * some things still being built); after that the switch is just a switch.
 */
export const ROOM_INTRO_STORAGE_KEY = 'blobbi:home:3d-intro:v1';

export function readRoomIntroSeen(storage: Pick<Storage, 'getItem'> | null = storageOrNull()): boolean {
  try {
    return storage?.getItem(ROOM_INTRO_STORAGE_KEY) === 'seen';
  } catch {
    return false;
  }
}

export function writeRoomIntroSeen(storage: Pick<Storage, 'setItem'> | null = storageOrNull()): void {
  try {
    storage?.setItem(ROOM_INTRO_STORAGE_KEY, 'seen');
  } catch {
    /* the introduction may show again on this browser; nothing else is lost */
  }
}
