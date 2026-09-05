import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: 'system',
  setTheme: () => null,
});

function readStoredTheme(storageKey: string): Theme | undefined {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === 'dark' || value === 'light' || value === 'system' ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Light/dark/system theme on the `<html>` class. Recovered as-is from the pre-nuke app. */
export function ThemeProvider({ children, defaultTheme = 'system', storageKey = 'blobbi-theme' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme(storageKey) ?? defaultTheme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
      return;
    }
    root.classList.add(theme);
  }, [theme]);

  const setTheme = (next: Theme) => {
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      /* storage may be unavailable; theme still applies for this session */
    }
    setThemeState(next);
  };

  return <ThemeProviderContext.Provider value={{ theme, setTheme }}>{children}</ThemeProviderContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook and provider share a context
export function useTheme() {
  return useContext(ThemeProviderContext);
}
