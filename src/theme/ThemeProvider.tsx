import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BLOBBI_HOME_THEMES, resolveTheme, type BlobbiHomeTheme, type BlobbiHomeThemeId } from './themes';
import { readStoredThemeId, writeStoredThemeId } from './theme-storage';
import { applyThemeToDocument } from './apply-theme';

interface ThemeContextValue {
  theme: BlobbiHomeTheme;
  themes: readonly BlobbiHomeTheme[];
  setTheme: (id: BlobbiHomeThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children, initialThemeId }: { children: ReactNode; initialThemeId?: BlobbiHomeThemeId }) {
  const [themeId, setThemeId] = useState<BlobbiHomeThemeId>(() => initialThemeId ?? readStoredThemeId());
  const theme = useMemo(() => resolveTheme(themeId), [themeId]);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setTheme = useCallback((id: BlobbiHomeThemeId) => {
    const next = resolveTheme(id).id;
    writeStoredThemeId(next);
    setThemeId(next);
  }, []);

  const value = useMemo(() => ({ theme, themes: BLOBBI_HOME_THEMES, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook and provider share a context
export function useBlobbiTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useBlobbiTheme must be used inside ThemeProvider');
  return ctx;
}
