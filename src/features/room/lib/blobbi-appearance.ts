/**
 * How the room draws the Blobbi: the kit's 2D drawing (the original, the
 * default) or the procedural 3D model (experimental). A preference of this
 * device, remembered in localStorage and nowhere else: never published,
 * never part of a room's decoration, never about which Blobbi it is. Both
 * are views of the same Blobbi, driven by the same walk and the same care.
 *
 * Only a V3 baby or adult has a 3D model (an egg stays the kit's shell; V1
 * and V2 art has no genome to loft); for anyone else the room draws 2D
 * whatever is chosen, and says why.
 */
import { useCallback, useState } from 'react';

export type BlobbiAppearance = '2d' | '3d';

export const DEFAULT_APPEARANCE: BlobbiAppearance = '2d';

/** Namespaced, so nothing else on the origin collides with it. */
export const APPEARANCE_STORAGE_KEY = 'blobbi:room:appearance';

export function parseAppearance(raw: unknown): BlobbiAppearance {
  return raw === '3d' || raw === '2d' ? raw : DEFAULT_APPEARANCE;
}

/** The saved preference, or the default when there is none, it is not one we know, or storage is unavailable. */
export function readAppearance(storage: Pick<Storage, 'getItem'> | null = safeStorage()): BlobbiAppearance {
  try {
    return parseAppearance(storage?.getItem(APPEARANCE_STORAGE_KEY));
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Remember the preference; false if this browser would not store it (private mode, quota, blocked). */
export function writeAppearance(appearance: BlobbiAppearance, storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(APPEARANCE_STORAGE_KEY, appearance);
    return true;
  } catch {
    return false;
  }
}

/** `localStorage`, or null where touching it throws (some sandboxed frames, privacy modes). */
export function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The preference as state: read once, written on each change. */
export function useBlobbiAppearance(): [BlobbiAppearance, (next: BlobbiAppearance) => void] {
  const [appearance, setState] = useState<BlobbiAppearance>(() => readAppearance());
  const set = useCallback((next: BlobbiAppearance) => {
    setState(next);
    writeAppearance(next);
  }, []);
  return [appearance, set];
}
