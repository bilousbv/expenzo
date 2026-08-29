'use server';

import { isTheme, THEME_COOKIE } from '@expenzo/ui';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

/**
 * Records the colour scheme.
 *
 * A server action rather than a `document.cookie` write in the browser, for the
 * same reason the locale is one: the scheme is read during the server render,
 * so setting it client-side alone would leave the next server-rendered page
 * still carrying the old class until something happened to refresh it — which
 * on a dark-default app means a flash of the wrong scheme on every navigation.
 *
 * The argument crosses the network and is untrusted however it is typed here;
 * a server action is a public endpoint. `isTheme` is what stops an arbitrary
 * string being written into the cookie and rendered as a class on <html>.
 */
export async function setTheme(value: string): Promise<void> {
  if (!isTheme(value)) return;

  const store = await cookies();

  store.set(THEME_COOKIE, value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    // Lax rather than Strict, matching the locale cookie: the magic-link and
    // OAuth callbacks arrive as top-level navigations from another origin, and
    // Strict would withhold the cookie on exactly those.
    sameSite: 'lax',
    httpOnly: false,
  });

  revalidatePath('/', 'layout');
}
