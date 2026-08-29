import { resolveTheme, THEME_COOKIE, type Theme } from '@expenzo/ui';
import { cookies } from 'next/headers';

/**
 * The colour scheme for the request being rendered.
 *
 * Read on the server so the class is already on `<html>` in the first byte.
 * Doing it in the browser instead means the page paints once in the default
 * scheme and then switches, which on a dark-default app is a white flash on
 * every cold load.
 */
export async function getTheme(): Promise<Theme> {
  const store = await cookies();

  return resolveTheme(store.get(THEME_COOKIE)?.value);
}
