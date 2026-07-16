'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getInitialTheme, getNextTheme, isTheme, themeStorageKey, type Theme } from '@/lib/theme';

interface ThemeContextValue {
  theme: Theme;
  ready: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(themeStorageKey);
    const systemTheme: Theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initialTheme = getInitialTheme(stored, systemTheme);
    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setReady(true);
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(getNextTheme(theme));
  }, [setTheme, theme]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === themeStorageKey && isTheme(event.newValue)) {
        setThemeState(event.newValue);
        applyTheme(event.newValue);
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(() => ({ theme, ready, setTheme, toggleTheme }), [ready, setTheme, theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
