/**
 * How close the room is looked at: the player's zoom (1 = the recommended
 * view, "100%"; 2 = twice as close), over the responsive framing. A
 * preference of this device, remembered in localStorage like the drawing
 * and the graphics quality (`blobbi:room:*`): never published, never part
 * of a room's decoration, the same for every room. The scene clamps it
 * further where its camera would otherwise enter the room.
 *
 * Two scales (M12.1). The SCENE's zoom (`RoomScene.setZoom`, the shell's
 * `zoom` prop, a pinch's report) is a factor over the framing: 1 is the view
 * the room was framed for. The player's 100% is that framing seen from a
 * little farther: the view that used to be 80% (`BASELINE` = 0.8), which
 * players found the more comfortable default. The camera, its limits and its
 * pinch are the scene's and did not change; only what "100%" means did, so the
 * label, the buttons and the stored preference speak the player's scale and
 * this module converts at the edge (`toScene`, `fromScene`).
 *
 * Stored preferences keep their framing: a value saved before M12.1 (the old
 * key, in scene units) is read as the same view in the new scale (÷ 0.8) and
 * moved to the new key; a player who never changed the zoom simply gets the
 * new default.
 */
import { useCallback, useState } from 'react';
import { safeStorage } from './blobbi-appearance';

/** The scene factor the player's 100% stands for: the former 80% view. */
export const BASELINE = 0.8;
/** The player's default: the recommended view. */
export const DEFAULT_ZOOM = 1;
/** The scene's own limits (a small object; the camera outside the walls), in scene units. Unchanged by M12.1. */
export const SCENE_ZOOM_MIN = 0.6;
export const SCENE_ZOOM_MAX = 2.2;
/** The same limits in the player's scale (75% and 275%). */
export const ZOOM_MIN = SCENE_ZOOM_MIN / BASELINE;
export const ZOOM_MAX = SCENE_ZOOM_MAX / BASELINE;
/** One press of + or −. */
export const ZOOM_STEP = 1.2;
/** Namespaced, so nothing else on the origin collides with it; v2 is in the player's scale. */
export const ZOOM_STORAGE_KEY = 'blobbi:room:zoom:v2';
/** Where a preference was kept before M12.1, in scene units. Read once to carry it over, then removed. */
export const LEGACY_ZOOM_STORAGE_KEY = 'blobbi:room:zoom';

/** The player's zoom as the scene's factor. */
export function toScene(zoom: number): number {
  return zoom * BASELINE;
}

/** The scene's factor (a pinch's report) as the player's zoom. */
export function fromScene(sceneZoom: number): number {
  return sceneZoom / BASELINE;
}

export function clampZoom(value: number, max = ZOOM_MAX): number {
  if (!Number.isFinite(value)) return DEFAULT_ZOOM;
  return Math.min(max, Math.max(ZOOM_MIN, value));
}

function positive(raw: unknown): number | null {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseZoom(raw: unknown): number {
  const n = positive(raw);
  return n === null ? DEFAULT_ZOOM : clampZoom(n);
}

/** A preference saved before M12.1 (scene units), as the same view in the player's scale; null when there is none. */
export function parseLegacyZoom(raw: unknown): number | null {
  const n = positive(raw);
  return n === null ? null : clampZoom(fromScene(n));
}

type ZoomStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * The saved preference, or the default when there is none, it is not a number, or storage is unavailable. A
 * preference only the old key holds is carried over (same view), written under the new key, and the old one removed.
 */
export function readZoom(storage: Pick<Storage, 'getItem'> & Partial<ZoomStorage> | null = safeStorage()): number {
  try {
    const current = storage?.getItem(ZOOM_STORAGE_KEY);
    if (current != null) return parseZoom(current);
    const legacy = parseLegacyZoom(storage?.getItem(LEGACY_ZOOM_STORAGE_KEY));
    if (legacy === null) return DEFAULT_ZOOM;
    try {
      if (storage?.setItem && storage.removeItem) {
        writeZoom(legacy, storage as ZoomStorage);
        storage.removeItem(LEGACY_ZOOM_STORAGE_KEY);
      }
    } catch {
      /* read as carried over for this visit; tried again next time */
    }
    return legacy;
  } catch {
    return DEFAULT_ZOOM;
  }
}

/** Remember the preference; false if this browser would not store it. */
export function writeZoom(zoom: number, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage()): boolean {
  try {
    if (!storage) return false;
    if (Math.abs(zoom - DEFAULT_ZOOM) < 0.0005) storage.removeItem(ZOOM_STORAGE_KEY);
    else storage.setItem(ZOOM_STORAGE_KEY, String(Math.round(zoom * 1000) / 1000));
    return true;
  } catch {
    return false;
  }
}

export interface RoomZoom {
  /** The player's zoom (1 = the recommended view): what the settings show as a percentage. */
  value: number;
  /** The same, as the scene's factor: what the room's camera is given. */
  scene: number;
  /** Set the player's zoom (clamped to the general limits; the scene may hold it lower still). */
  set: (next: number) => void;
  /** Take the scene's factor (a pinch or the wheel, reported by the shell) as the player's zoom. */
  setScene: (sceneZoom: number) => void;
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
  const setScene = useCallback((sceneZoom: number) => set(fromScene(sceneZoom)), [set]);
  const by = useCallback((factor: number) => setValue((v) => {
    const next = clampZoom(v * factor);
    writeZoom(next);
    return next;
  }), []);
  const reset = useCallback(() => set(DEFAULT_ZOOM), [set]);
  return { value, scene: toScene(value), set, setScene, by, reset };
}
