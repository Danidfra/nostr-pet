/**
 * The home environment: one place, lit by the Island's shared clock.
 *
 * There is no ecosystem registry of environments (audited 2026-09-23):
 * Island's places are its own art, Ditto's rooms are CSS. What IS shared
 * is the Island's time of day, so the home follows it: the same dawn, day,
 * sunset and night every other Blobbonaut sees, on the same schedule.
 *
 * The old five themes (Cozy, Forest, Beach, Garden, Space) were the
 * standalone's own invention from Polaroid backdrops and are gone. What
 * remains data-driven is a table of tokens per phase, applied as CSS custom
 * properties; no component branches on a phase name.
 *
 * An APPEARANCE preference lets a player lock the home to day or night
 * (device-local, never published). It changes lighting and surfaces only;
 * the Blobbi is drawn identically under every phase, which a test pins.
 */
import type { IslandPhase } from './island-clock';

export type Appearance = 'island' | 'day' | 'night';
export const APPEARANCES: readonly Appearance[] = ['island', 'day', 'night'];
export const DEFAULT_APPEARANCE: Appearance = 'island';

/** The Tailwind semantic tokens (HSL triplets, no `hsl()`). */
export type SurfaceTokenName =
  | 'background'
  | 'foreground'
  | 'card'
  | 'card-foreground'
  | 'primary'
  | 'primary-foreground'
  | 'secondary'
  | 'secondary-foreground'
  | 'muted'
  | 'muted-foreground'
  | 'accent'
  | 'accent-foreground'
  | 'destructive'
  | 'destructive-foreground'
  | 'border'
  | 'input'
  | 'ring';

/** The scene tokens the home's layers read. Plain CSS values. */
export interface SceneTokens {
  /** The sky seen through the window. */
  skyTop: string;
  skyBottom: string;
  /** How bright the stars are (0 hides them). */
  stars: string;
  /** The room's wall and its shaded edge. */
  wall: string;
  wallShade: string;
  /** The floor band and its rug. */
  floor: string;
  floorEdge: string;
  rug: string;
  /** Light spilling from the window onto the floor. */
  windowGlow: string;
  /** The lamp's glow (night only). */
  lamp: string;
  /** The warm patch under the Blobbi's feet. */
  groundGlow: string;
  /** The garden: grass underfoot, its front edge, and the far hills. */
  grass: string;
  grassEdge: string;
  hill: string;
  /** A colour laid over every room surface (multiply) so the rooms follow the clock. */
  tint: string;
}

export interface PhaseLook {
  phase: IslandPhase;
  /** Which surface set to use: warm daylight surfaces or the night set. */
  mood: 'light' | 'dark';
  scene: SceneTokens;
}

const WARM_LIGHT: Record<SurfaceTokenName, string> = {
  background: '45 67% 97%',
  foreground: '32 33% 15%',
  card: '42 43% 95%',
  'card-foreground': '32 33% 15%',
  primary: '258 80% 50%',
  'primary-foreground': '45 67% 97%',
  secondary: '38 29% 84%',
  'secondary-foreground': '32 33% 15%',
  muted: '35 25% 87%',
  'muted-foreground': '28 17% 37%',
  accent: '35 25% 87%',
  'accent-foreground': '32 33% 15%',
  destructive: '20 42% 39%',
  'destructive-foreground': '45 67% 97%',
  border: '38 29% 84%',
  input: '38 29% 84%',
  ring: '258 80% 40%',
};

const WARM_DARK: Record<SurfaceTokenName, string> = {
  background: '255 30% 9%',
  foreground: '260 30% 92%',
  card: '255 26% 14%',
  'card-foreground': '260 30% 92%',
  primary: '275 85% 70%',
  'primary-foreground': '255 35% 8%',
  secondary: '255 22% 20%',
  'secondary-foreground': '260 30% 92%',
  muted: '255 22% 20%',
  'muted-foreground': '260 20% 70%',
  accent: '255 22% 22%',
  'accent-foreground': '260 30% 92%',
  destructive: '4 71% 60%',
  'destructive-foreground': '260 30% 95%',
  border: '255 22% 24%',
  input: '255 22% 24%',
  ring: '275 85% 60%',
};

export const SURFACES: Record<PhaseLook['mood'], Record<SurfaceTokenName, string>> = { light: WARM_LIGHT, dark: WARM_DARK };

export const PHASE_LOOKS: Record<IslandPhase, PhaseLook> = {
  dawn: {
    phase: 'dawn',
    mood: 'light',
    scene: {
      skyTop: 'hsl(345 70% 78%)',
      skyBottom: 'hsl(35 90% 82%)',
      stars: '0.15',
      wall: 'hsl(38 55% 92%)',
      wallShade: 'hsl(30 40% 84%)',
      floor: 'hsl(28 42% 68%)',
      floorEdge: 'hsl(26 38% 58%)',
      rug: 'hsl(350 45% 78%)',
      windowGlow: 'hsl(30 90% 75% / 0.35)',
      lamp: 'transparent',
      groundGlow: 'hsl(30 80% 70% / 0.35)',
      grass: 'hsl(95 40% 58%)',
      grassEdge: 'hsl(100 35% 46%)',
      hill: 'hsl(120 30% 44%)',
      tint: 'hsl(20 80% 75% / 0.16)',
    },
  },
  day: {
    phase: 'day',
    mood: 'light',
    scene: {
      skyTop: 'hsl(205 85% 72%)',
      skyBottom: 'hsl(200 90% 90%)',
      stars: '0',
      wall: 'hsl(42 60% 94%)',
      wallShade: 'hsl(36 45% 86%)',
      floor: 'hsl(28 45% 70%)',
      floorEdge: 'hsl(26 40% 60%)',
      rug: 'hsl(262 55% 80%)',
      windowGlow: 'hsl(45 95% 80% / 0.35)',
      lamp: 'transparent',
      groundGlow: 'hsl(270 60% 70% / 0.32)',
      grass: 'hsl(100 45% 55%)',
      grassEdge: 'hsl(105 40% 44%)',
      hill: 'hsl(125 32% 40%)',
      tint: 'transparent',
    },
  },
  sunset: {
    phase: 'sunset',
    mood: 'light',
    scene: {
      skyTop: 'hsl(265 55% 62%)',
      skyBottom: 'hsl(22 95% 68%)',
      stars: '0.25',
      wall: 'hsl(30 60% 90%)',
      wallShade: 'hsl(22 50% 80%)',
      floor: 'hsl(24 48% 62%)',
      floorEdge: 'hsl(20 42% 52%)',
      rug: 'hsl(340 50% 74%)',
      windowGlow: 'hsl(22 95% 65% / 0.4)',
      lamp: 'transparent',
      groundGlow: 'hsl(22 90% 65% / 0.35)',
      grass: 'hsl(85 38% 50%)',
      grassEdge: 'hsl(90 36% 40%)',
      hill: 'hsl(110 28% 34%)',
      tint: 'hsl(22 90% 62% / 0.2)',
    },
  },
  night: {
    phase: 'night',
    mood: 'dark',
    scene: {
      skyTop: 'hsl(250 45% 12%)',
      skyBottom: 'hsl(240 40% 26%)',
      stars: '1',
      wall: 'hsl(255 28% 18%)',
      wallShade: 'hsl(255 30% 13%)',
      floor: 'hsl(30 22% 26%)',
      floorEdge: 'hsl(28 20% 20%)',
      rug: 'hsl(270 30% 32%)',
      windowGlow: 'hsl(240 60% 60% / 0.18)',
      lamp: 'hsl(40 95% 70% / 0.45)',
      groundGlow: 'hsl(40 80% 65% / 0.3)',
      grass: 'hsl(120 22% 20%)',
      grassEdge: 'hsl(125 22% 15%)',
      hill: 'hsl(135 25% 13%)',
      tint: 'hsl(250 55% 28% / 0.62)',
    },
  },
};

/** The phase an appearance resolves to at a given island phase. */
export function resolvePhase(appearance: Appearance, islandPhase: IslandPhase): IslandPhase {
  if (appearance === 'day') return 'day';
  if (appearance === 'night') return 'night';
  return islandPhase;
}

export function isAppearance(value: unknown): value is Appearance {
  return typeof value === 'string' && (APPEARANCES as readonly string[]).includes(value);
}

/** Copy for the appearance choice. */
export const APPEARANCE_COPY: Record<Appearance, { name: string; tagline: string }> = {
  island: { name: 'Island time', tagline: 'Dawn, day, sunset and night, on the same clock as the Island.' },
  day: { name: 'Always day', tagline: 'Bright and warm, whatever the Island clock says.' },
  night: { name: 'Always night', tagline: 'Lamplight and stars, whatever the Island clock says.' },
};
