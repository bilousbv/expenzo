/**
 * The colour scheme, and how it is remembered.
 *
 * Dark is the default and light is the override, matching the stylesheets:
 * `:root` carries the dark variables and `.light` replaces them. The two have
 * to agree about which way round that is, or the app paints the wrong scheme
 * before the class lands.
 */

export const THEMES = ['dark', 'light'] as const;

export type Theme = (typeof THEMES)[number];

/** Read on the server during the render, so it cannot be httpOnly. */
export const THEME_COOKIE = 'expenzo-theme';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * Narrows an untrusted value to a scheme.
 *
 * The value arrives from a cookie, which anyone with dev tools can edit, and
 * from a server action, which is a public endpoint. Narrowing rather than
 * trusting is what stops an arbitrary string being written onto the root
 * element as a class name.
 */
export function resolveTheme(value: unknown): Theme {
  return isTheme(value) ? value : 'dark';
}
