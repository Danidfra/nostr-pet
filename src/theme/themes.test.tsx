/**
 * Themes: a device-local presentation choice. Default is Cozy Home, every
 * theme is genuinely different, selection applies at once and persists,
 * garbage in storage falls back, and nothing is ever published.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BLOBBI_HOME_THEMES, DEFAULT_THEME_ID, resolveTheme, isBlobbiHomeThemeId } from './themes';
import { THEME_STORAGE_KEY, readStoredThemeId, writeStoredThemeId } from './theme-storage';
import { applyThemeToDocument } from './apply-theme';
import { ThemeProvider, useBlobbiTheme } from './ThemeProvider';
import { ThemePicker } from './ThemePicker';

function Current() {
  const { theme } = useBlobbiTheme();
  return <p data-testid="current">{theme.id}</p>;
}

function renderPicker() {
  return render(
    <ThemeProvider>
      <ThemePicker />
      <Current />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('style');
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('registry', () => {
  it('has a handful of themes, each with its own environment and swatch', () => {
    expect(BLOBBI_HOME_THEMES.length).toBeGreaterThanOrEqual(3);
    expect(BLOBBI_HOME_THEMES.length).toBeLessThanOrEqual(6);
    const ids = new Set(BLOBBI_HOME_THEMES.map((t) => t.id));
    expect(ids.size).toBe(BLOBBI_HOME_THEMES.length);
    const skies = new Set(BLOBBI_HOME_THEMES.map((t) => t.environment.sky));
    expect(skies.size).toBe(BLOBBI_HOME_THEMES.length);
    const primaries = new Set(BLOBBI_HOME_THEMES.map((t) => t.tokens.primary));
    expect(primaries.size).toBe(BLOBBI_HOME_THEMES.length);
  });

  it('keeps the historical environment names', () => {
    const names = BLOBBI_HOME_THEMES.map((t) => t.name);
    for (const historical of ['Forest', 'Beach', 'Garden', 'Space']) expect(names).toContain(historical);
  });

  it('serves every backdrop from this origin', () => {
    for (const theme of BLOBBI_HOME_THEMES) {
      if (theme.environment.image) expect(theme.environment.image).toMatch(/^\/environments\/[a-z]+\.(jpg|png|svg)$/);
    }
  });

  it('defaults to Cozy Home and resolves anything unknown to it', () => {
    expect(resolveTheme(DEFAULT_THEME_ID).id).toBe('cozy');
    for (const bad of [undefined, null, '', 'neon', 42, {}]) expect(resolveTheme(bad).id).toBe('cozy');
    expect(isBlobbiHomeThemeId('forest')).toBe(true);
    expect(isBlobbiHomeThemeId('Forest')).toBe(false);
  });
});

describe('persistence', () => {
  it('reads the default when nothing is stored', () => {
    expect(readStoredThemeId()).toBe('cozy');
  });

  it('round-trips a selection under a namespaced key', () => {
    writeStoredThemeId('beach');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('beach');
    expect(THEME_STORAGE_KEY).toMatch(/^blobbi:/);
    expect(readStoredThemeId()).toBe('beach');
  });

  it('falls back when the stored theme no longer exists or storage is broken', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'lava-lamp');
    expect(readStoredThemeId()).toBe('cozy');
    const broken = { getItem: () => { throw new Error('nope'); } };
    expect(readStoredThemeId(broken)).toBe('cozy');
    expect(() => writeStoredThemeId('space', { setItem: () => { throw new Error('full'); } })).not.toThrow();
  });
});

describe('applying a theme', () => {
  it('paints tokens, environment and the dark class on the document', () => {
    const root = document.documentElement;
    applyThemeToDocument(resolveTheme('space'), root);
    expect(root.dataset.blobbiTheme).toBe('space');
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.getPropertyValue('--primary')).toBe(resolveTheme('space').tokens.primary);
    expect(root.style.getPropertyValue('--home-environment-image')).toContain('/environments/space.jpg');

    applyThemeToDocument(resolveTheme('cozy'), root);
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.style.getPropertyValue('--home-environment-image')).toBe('none');
  });
});

describe('picker', () => {
  it('starts on the default, shows every theme with the current one checked', async () => {
    renderPicker();
    expect(screen.getByTestId('current')).toHaveTextContent('cozy');
    await userEvent.click(screen.getByRole('button', { name: /theme/i }));
    const group = screen.getByRole('radiogroup', { name: /home theme/i });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(BLOBBI_HOME_THEMES.length);
    expect(within(group).getByRole('radio', { name: /cozy home/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('selecting applies immediately, persists, and publishes nothing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderPicker();
    await userEvent.click(screen.getByRole('button', { name: /theme/i }));
    await userEvent.click(screen.getByRole('radio', { name: /forest/i }));
    expect(screen.getByTestId('current')).toHaveTextContent('forest');
    expect(document.documentElement.dataset.blobbiTheme).toBe('forest');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('forest');
    expect(screen.getByRole('radio', { name: /forest/i })).toHaveAttribute('aria-checked', 'true');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('is keyboard operable: arrows move and select, Escape closes', async () => {
    renderPicker();
    await userEvent.click(screen.getByRole('button', { name: /theme/i }));
    const cozy = screen.getByRole('radio', { name: /cozy home/i });
    expect(cozy).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByTestId('current')).toHaveTextContent(BLOBBI_HOME_THEMES[1].id);
    await userEvent.keyboard('{End}');
    expect(screen.getByTestId('current')).toHaveTextContent(BLOBBI_HOME_THEMES.at(-1)!.id);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /theme/i })).toHaveFocus();
  });

  it('remembers the stored theme on the next visit', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'garden');
    renderPicker();
    expect(screen.getByTestId('current')).toHaveTextContent('garden');
  });

  it('a deleted stored theme falls back to the default without complaint', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'retired-theme');
    renderPicker();
    expect(screen.getByTestId('current')).toHaveTextContent('cozy');
  });
});
