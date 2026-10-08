export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'pantrypal_theme';

export function loadTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch (e) {}
  return 'system';
}

export function saveTheme(theme: ThemeChoice) {
  try {
    localStorage.setItem(KEY, theme);
  } catch (e) {}
}

export const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

/** Turns dark mode on or off by toggling the `dark` class on <html>. */
export function applyTheme(theme: ThemeChoice) {
  const dark = theme === 'dark' || (theme === 'system' && prefersDark());
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0c0a09' : '#059669');
}
