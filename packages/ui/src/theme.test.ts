import { describe, expect, it } from 'vitest';

import { isTheme, resolveTheme, THEME_COOKIE, THEMES } from './theme';

describe('resolveTheme', () => {
  it('keeps a scheme it recognises', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  /*
   * Dark is the default, so anything unrecognised has to land there rather
   * than on light: the stylesheet puts dark on :root and light is the
   * override, and the two have to agree about which is the fallback.
   */
  it('falls back to dark', () => {
    expect(resolveTheme(undefined)).toBe('dark');
    expect(resolveTheme('')).toBe('dark');
    expect(resolveTheme('DARK')).toBe('dark');
    expect(resolveTheme('solarized')).toBe('dark');
  });

  /*
   * The value arrives from a cookie, which anyone with dev tools can edit, and
   * from a server action, which is a public endpoint. It is narrowed rather
   * than trusted — otherwise an arbitrary string ends up as a class name on
   * the root element.
   */
  it('refuses anything that is not a scheme', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('<script>')).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(42)).toBe(false);
  });

  it('offers both schemes to choose from', () => {
    expect([...THEMES]).toEqual(['dark', 'light']);
  });

  it('names the cookie once, for the reader and the writer', () => {
    expect(THEME_COOKIE).toBe('expenzo-theme');
  });
});
