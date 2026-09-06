import type { BlobbiHomeTheme } from './themes';

/**
 * Paint a theme onto the document: the design tokens as custom properties, the
 * environment as custom properties the scene reads, `data-blobbi-theme` for
 * anything that wants to know, and the `dark` class for dark moods.
 */
export function applyThemeToDocument(theme: BlobbiHomeTheme, root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--${name}`, value);
  }
  root.style.setProperty('--home-sky', theme.environment.sky);
  root.style.setProperty('--home-ground-glow', theme.environment.groundGlow);
  root.style.setProperty('--home-environment-image', theme.environment.image ? `url("${theme.environment.image}")` : 'none');
  root.dataset.blobbiTheme = theme.id;
  root.dataset.blobbiHorizon = theme.environment.horizon;
  root.classList.toggle('dark', theme.mood === 'dark');
  root.style.colorScheme = theme.mood;
}

