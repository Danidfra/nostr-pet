/**
 * How close the room is looked at: a factor over the responsive framing
 * (1 = the recommended view for this screen; 2 = twice as close). A
 * preference of this device, remembered in localStorage like the drawing
 * and the graphics quality (`blobbi:room:*`): never published, never part
 * of a room's decoration, the same for every room. The scene clamps it
 * further where its camera would otherwise enter the room.
 */
import { useCallback, useState } from 'react';
import { safeStorage } from './blobbi-appearance';

export const DEFAULT_ZOOM = 1;
/** Farther than this and the room is a small object; nearer than this and the camera is in the walls. */
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2.2;
/** One press of + or −. */
export const ZOOM_STEP = 1.2;
/** Namespaced, so nothing else on the origin collides with it. */
export const ZOOM_STORAGE_KEY = 'blobbi:room:zoom';

export function clampZoom(value: number, max = ZOOM_MAX): number {
  if (!Number.isFinite(value)) return DEFAULT_ZOOM;
  return Math.min(max, Math.max(ZOOM_MIN, value));
}

export function parseZoom(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  return Number.isFinite(n) && n > 0 ? clampZoom(n) : DEFAULT_ZOOM;
}

/** The saved preference, or the default when there is none, it is not a number, or storage is unavailable. */
export function readZoom(storage: Pick<Storage, 'getItem'> | null = safeStorage()): number {
  try {
    return parseZoom(storage?.getItem(ZOOM_STORAGE_KEY));
  } catch {
    return DEFAULT_ZOOM;
  }
}

/** Remember the preference; false if this browser would not store it. */
export function writeZoom(zoom: number, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage()): boolean {
  try {
    if (!storage) return false;
    if (zoom === DEFAULT_ZOOM) storage.removeItem(ZOOM_STORAGE_KEY);
    else storage.setItem(ZOOM_STORAGE_KEY, String(Math.round(zoom * 1000) / 1000));
    return true;
  } catch {
    return false;
  }
}

export interface RoomZoom {
  value: number;
  /** Set the factor (clamped to the general limits; the scene may hold it lower still). */
  set: (next: number) => void;
  /** One step nearer (`ZOOM_STEP`) or farther (`1 / ZOOM_STEP`). */
  by: (factor: number) => void;
  /** Back to the recommended view. */
  reset: () => void;
}

/** The preference as state: read once, written on each change. */
export function useRoomZoom(): RoomZoom {
  const [value, setValue] = useState<number>(() => readZoom());
  const set = useCallback((next: number) => {
    const clamped = clampZoom(next);
    setValue(clamped);
    writeZoom(clamped);
  }, []);
  const by = useCallback((factor: number) => setValue((v) => {
    const next = clampZoom(v * factor);
    writeZoom(next);
    return next;
  }), []);
  const reset = useCallback(() => set(DEFAULT_ZOOM), [set]);
  return { value, set, by, reset };
}
