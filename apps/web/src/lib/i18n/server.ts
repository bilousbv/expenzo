import { createI18n, LOCALE_COOKIE, resolveLocale, type Locale } from '@expenzo/i18n';
import { cookies } from 'next/headers';

/**
 * The locale for the request being rendered.
 *
 * Read from a cookie rather than a URL segment: every screen sits behind auth,
 * so there is nothing for a crawler to index in either language and nothing to
 * gain from `/uk/...` — which would otherwise mean moving the whole route tree
 * under a `[locale]` segment.
 *
 * `resolveLocale` is not decoration. The cookie is editable by anyone with dev
 * tools, so its value arrives as `unknown` and is narrowed rather than trusted;
 * anything unrecognised falls back to the default instead of reaching i18next
 * as an unknown language.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();

  return resolveLocale(store.get(LOCALE_COOKIE)?.value);
}

/**
 * A translator for a server component.
 *
 * Each call builds its own i18next instance — see the note in
 * packages/i18n/src/create-instance.ts on why a shared one would let two
 * concurrent requests in different languages overwrite each other's language.
 */
export async function getTranslations() {
  const locale = await getLocale();
  const instance = createI18n(locale);

  return { locale, t: instance.t.bind(instance) };
}
