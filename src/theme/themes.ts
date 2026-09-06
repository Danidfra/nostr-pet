/**
 * The Blobbi home themes: a data-driven registry.
 *
 * A theme is a STANDALONE presentation concern. It decides what the home
 * around the Blobbi looks like (environment, surfaces, borders, text, buttons,
 * glow) and nothing else: it never touches Blobbi protocol state, traits,
 * `visual_generation`, Nostr events or care maths. The renderer draws the same
 * Blobbi in every theme.
 *
 * Recovered from the pre-nuke app as a visual reference: the warm "elegant"
 * light/dark palettes became Cozy Home and Space; Forest, Beach and Garden
 * reuse the illustrated backdrops the old Polaroid feature shipped as unlocks
 * (`public/assets/bg/*`, now `public/environments/*`, re-encoded smaller).
 *
 * Tokens are the HSL triplets Tailwind reads through `hsl(var(--x))`, so a
 * theme switch is one attribute on `<html>` plus a handful of custom
 * properties; no component branches on the theme id.
 */

export type BlobbiHomeThemeId = 'cozy' | 'forest' | 'beach' | 'garden' | 'space';

/** The design-system variables a theme may set (HSL triplets, no `hsl()`). */
export type ThemeTokenName =
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

export interface BlobbiHomeTheme {
  id: BlobbiHomeThemeId;
  name: string;
  /** One short line for the picker. */
  tagline: string;
  /** Light or dark surfaces: decides the `dark` class and the default contrast. */
  mood: 'light' | 'dark';
  tokens: Record<ThemeTokenName, string>;
  environment: {
    /** Illustrated backdrop for the scene, served from this origin. Optional. */
    image?: string;
    /** CSS background layered over (or instead of) the image: the sky/light. */
    sky: string;
    /** Soft light under the Blobbi's feet, `hsl()` or `rgba()`. */
    groundGlow: string;
    /** Where the illustrated horizon sits, so the ground line matches. */
    horizon: 'low' | 'mid' | 'none';
  };
  /** Three colours the picker uses as a swatch preview: sky, ground, accent. */
  swatch: [string, string, string];
}

const ELEGANT_LIGHT: Record<ThemeTokenName, string> = {
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

export const BLOBBI_HOME_THEMES: readonly BlobbiHomeTheme[] = [
  {
    id: 'cozy',
    name: 'Cozy Home',
    tagline: 'Warm cream, soft purple. The Blobbi default.',
    mood: 'light',
    tokens: ELEGANT_LIGHT,
    environment: {
      sky: 'radial-gradient(120% 80% at 50% 0%, hsl(270 70% 92%) 0%, hsl(45 67% 97%) 55%, hsl(38 60% 92%) 100%)',
      groundGlow: 'hsl(270 60% 70% / 0.35)',
      horizon: 'none',
    },
    swatch: ['#ede4ff', '#f5ecd9', '#7c3aed'],
  },
  {
    id: 'forest',
    name: 'Forest',
    tagline: 'A shaded path between old trees.',
    mood: 'light',
    tokens: {
      ...ELEGANT_LIGHT,
      background: '96 30% 95%',
      card: '90 30% 96%',
      primary: '140 45% 32%',
      'primary-foreground': '96 30% 97%',
      secondary: '95 22% 84%',
      muted: '95 22% 87%',
      'muted-foreground': '120 15% 32%',
      accent: '95 22% 87%',
      border: '95 22% 80%',
      input: '95 22% 80%',
      ring: '140 45% 30%',
    },
    environment: {
      image: '/environments/forest.jpg',
      sky: 'linear-gradient(180deg, hsl(170 45% 85%) 0%, hsl(120 35% 60%) 100%)',
      groundGlow: 'hsl(80 60% 50% / 0.35)',
      horizon: 'low',
    },
    swatch: ['#a9e0d2', '#4c9a3f', '#c98b3d'],
  },
  {
    id: 'beach',
    name: 'Beach',
    tagline: 'Blue water, warm sand, a bright sky.',
    mood: 'light',
    tokens: {
      ...ELEGANT_LIGHT,
      background: '43 80% 95%',
      card: '45 70% 96%',
      primary: '192 85% 36%',
      'primary-foreground': '45 80% 97%',
      secondary: '43 60% 85%',
      muted: '43 55% 88%',
      'muted-foreground': '200 25% 32%',
      accent: '43 55% 88%',
      border: '43 55% 80%',
      input: '43 55% 80%',
      ring: '192 85% 32%',
    },
    environment: {
      image: '/environments/beach.jpg',
      sky: 'linear-gradient(180deg, hsl(200 90% 60%) 0%, hsl(185 80% 55%) 50%, hsl(43 85% 72%) 100%)',
      groundGlow: 'hsl(43 90% 60% / 0.4)',
      horizon: 'mid',
    },
    swatch: ['#3fb6ec', '#f6d58a', '#0b8aa8'],
  },
  {
    id: 'garden',
    name: 'Garden',
    tagline: 'Flowers, a fence and a friendly hillside.',
    mood: 'light',
    tokens: {
      ...ELEGANT_LIGHT,
      background: '80 40% 95%',
      card: '75 40% 96%',
      primary: '10 75% 50%',
      'primary-foreground': '45 80% 97%',
      secondary: '85 30% 85%',
      muted: '85 30% 88%',
      'muted-foreground': '100 18% 32%',
      accent: '85 30% 88%',
      border: '85 30% 80%',
      input: '85 30% 80%',
      ring: '10 75% 45%',
    },
    environment: {
      image: '/environments/garden.jpg',
      sky: 'linear-gradient(180deg, hsl(175 50% 85%) 0%, hsl(95 45% 62%) 100%)',
      groundGlow: 'hsl(90 65% 55% / 0.35)',
      horizon: 'low',
    },
    swatch: ['#bfe8dd', '#8fcb52', '#f0522a'],
  },
  {
    id: 'space',
    name: 'Space',
    tagline: 'A quiet night among the stars.',
    mood: 'dark',
    tokens: {
      background: '255 35% 8%',
      foreground: '260 30% 92%',
      card: '255 30% 13%',
      'card-foreground': '260 30% 92%',
      primary: '275 85% 70%',
      'primary-foreground': '255 35% 8%',
      secondary: '255 25% 20%',
      'secondary-foreground': '260 30% 92%',
      muted: '255 25% 20%',
      'muted-foreground': '260 20% 70%',
      accent: '255 25% 22%',
      'accent-foreground': '260 30% 92%',
      destructive: '4 71% 60%',
      'destructive-foreground': '260 30% 95%',
      border: '255 25% 24%',
      input: '255 25% 24%',
      ring: '275 85% 60%',
    },
    environment: {
      image: '/environments/space.jpg',
      sky: 'radial-gradient(90% 60% at 50% 40%, hsl(270 60% 22%) 0%, hsl(255 40% 8%) 70%)',
      groundGlow: 'hsl(275 80% 70% / 0.4)',
      horizon: 'none',
    },
    swatch: ['#12071f', '#3b1a6b', '#c084fc'],
  },
];

export const DEFAULT_THEME_ID: BlobbiHomeThemeId = 'cozy';

const BY_ID = new Map(BLOBBI_HOME_THEMES.map((theme) => [theme.id, theme]));

export function isBlobbiHomeThemeId(value: unknown): value is BlobbiHomeThemeId {
  return typeof value === 'string' && BY_ID.has(value as BlobbiHomeThemeId);
}

/** The theme for an id, or the default for anything this build does not know. */
export function resolveTheme(id: unknown): BlobbiHomeTheme {
  return (isBlobbiHomeThemeId(id) && BY_ID.get(id)) || BY_ID.get(DEFAULT_THEME_ID)!;
}
