import { DEFAULT_APPEARANCE, SURFACES, isAppearance, type Appearance, type PhaseLook } from './environments';

export const APPEARANCE_STORAGE_KEY = 'blobbi:home-appearance:v1';

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredAppearance(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Appearance {
  try {
    const value = storage?.getItem(APPEARANCE_STORAGE_KEY);
    return isAppearance(value) ? value : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function writeStoredAppearance(value: Appearance, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(APPEARANCE_STORAGE_KEY, value);
  } catch {
    /* private mode or full storage: the choice still applies for this session */
  }
}

/**
 * Paint a phase onto the document: the surface tokens Tailwind reads, the
 * scene tokens the home's layers read, `data-home-phase` for anything that
 * wants to know, and the `dark` class for the night surfaces.
 */
export function applyPhaseToDocument(look: PhaseLook, root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(SURFACES[look.mood])) root.style.setProperty(`--${name}`, value);
  const s = look.scene;
  root.style.setProperty('--sky-top', s.skyTop);
  root.style.setProperty('--sky-bottom', s.skyBottom);
  root.style.setProperty('--stars', s.stars);
  root.style.setProperty('--wall', s.wall);
  root.style.setProperty('--wall-shade', s.wallShade);
  root.style.setProperty('--floor', s.floor);
  root.style.setProperty('--floor-edge', s.floorEdge);
  root.style.setProperty('--rug', s.rug);
  root.style.setProperty('--window-glow', s.windowGlow);
  root.style.setProperty('--lamp', s.lamp);
  root.style.setProperty('--home-ground-glow', s.groundGlow);
  root.dataset.homePhase = look.phase;
  root.classList.toggle('dark', look.mood === 'dark');
  root.style.colorScheme = look.mood;
}
