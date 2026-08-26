'use server';

import { isLocale, LOCALE_COOKIE } from '@expenzo/i18n';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

/**
 * Records the language choice.
 *
 * A server action rather than a client-side `document.cookie` write, because
 * the locale is read during the server render: setting it in the browser alone
 * would leave the next server-rendered page still in the old language until
 * something happened to refresh it.
 *
 * The argument crosses the network and is therefore untrusted, however it is
 * typed here — a server action is a public endpoint. `isLocale` is what stops
 * an arbitrary string being written into the cookie and handed back to i18next
 * on every subsequent request.
 */
export async function setLocale(value: string): Promise<void> {
  if (!isLocale(value)) return;

  const store = await cookies();

  store.set(LOCALE_COOKIE, value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    // Lax rather than Strict: the magic-link and OAuth callbacks arrive as
    // top-level navigations from another origin, and Strict would withhold the
    // cookie on exactly those, dropping the user back into the default
    // language at the moment they finish signing in.
    sameSite: 'lax',
    httpOnly: false,
  });

  revalidatePath('/', 'layout');
}
