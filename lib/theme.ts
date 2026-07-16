export type Theme = 'light' | 'dark';

export const themeStorageKey = 'theme';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

export function getInitialTheme(storedTheme: string | null | undefined, systemTheme: Theme) {
  return isTheme(storedTheme) ? storedTheme : systemTheme;
}

export function getNextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

export const themeScript = `(() => {
  try {
    const stored = window.localStorage.getItem('${themeStorageKey}');
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const theme = stored === 'dark' || stored === 'light' ? stored : system;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch {}
})();`;
