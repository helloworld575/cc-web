import { describe, expect, it } from 'vitest';
import { getInitialTheme, getNextTheme, themeScript } from '@/lib/theme';

describe('theme resolution', () => {
  it('prefers an explicit stored theme and falls back to the system choice', () => {
    expect(getInitialTheme('dark', 'light')).toBe('dark');
    expect(getInitialTheme('light', 'dark')).toBe('light');
    expect(getInitialTheme(null, 'dark')).toBe('dark');
    expect(getInitialTheme('sepia', 'dark')).toBe('dark');
  });

  it('toggles between the two supported themes', () => {
    expect(getNextTheme('light')).toBe('dark');
    expect(getNextTheme('dark')).toBe('light');
  });

  it('contains a pre-paint localStorage and prefers-color-scheme resolver', () => {
    expect(themeScript).toContain('localStorage');
    expect(themeScript).toContain('prefers-color-scheme: dark');
    expect(themeScript).toContain('data-theme');
  });
});
