/**
 * Light, dark, or whatever the machine says.
 *
 * Three states rather than two, because "follow the system" is a real answer
 * and not the absence of one: someone whose laptop flips to dark in the evening
 * wants the panel to flip with it, and a two-way toggle can only freeze them on
 * one side of that.
 *
 * "system" is stored as the absence of the attribute, so the stylesheet's media
 * query decides and nothing here has to listen for the OS changing its mind.
 */
export type Theme = 'light' | 'dark' | 'system';

const KEY = 'chronos.admin.theme';

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Private windows and blocked site data both throw here. Falling through to
    // "system" is the correct answer, not an error worth surfacing.
  }
  return 'system';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // The choice still applies for this page; it just will not be remembered.
  }
}

/** What the viewer actually sees right now, with "system" resolved. */
export function resolvedTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
