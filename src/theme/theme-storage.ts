import { DEFAULT_THEME_ID, isBlobbiHomeThemeId, type BlobbiHomeThemeId } from './themes';

/**
 * Device-local theme preference. Namespaced so it can never collide with the
 * login store or the kit's own keys, and versioned so a future registry change
 * can migrate rather than misread. A theme is never published to Nostr.
 */
export const THEME_STORAGE_KEY = 'blobbi:home-theme:v1';

export function readStoredThemeId(storage: Pick<Storage, 'getItem'> | null = safeStorage()): BlobbiHomeThemeId {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return isBlobbiHomeThemeId(value) ? value : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function writeStoredThemeId(id: BlobbiHomeThemeId, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* private mode or full storage: the theme still applies for this session */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
