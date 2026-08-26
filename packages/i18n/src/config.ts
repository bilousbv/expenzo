/**
 * The languages the app ships, and the one it falls back on.
 *
 * Ukrainian leads the list and is the default: a household that has expressed
 * no preference gets Ukrainian, not the language its browser happens to report.
 * English is the fallback for a key that somehow resolves to nothing, which the
 * types are meant to make impossible.
 */
export const locales = ['uk', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'uk';

export const fallbackLocale: Locale = 'en';

/**
 * Each language named in itself. Someone who cannot read the language currently
 * on screen still has to be able to pick theirs out of the switcher, and
 * "Ukrainian" written in English is no use to them.
 */
export const LOCALE_LABEL: Record<Locale, string> = {
  uk: 'Українська',
  en: 'English',
};

/**
 * The cookie the browser and the server agree on. Deliberately not prefixed
 * `__Host-`: that requires Secure, and local development is plain http.
 */
export const LOCALE_COOKIE = 'expenzo_locale';

/**
 * Region-qualified tags for `Intl`. A bare "uk" leaves number formatting to the
 * implementation's default region, and Ukrainian groups thousands with a space
 * and marks decimals with a comma — 1 234,56. Getting that from the locale
 * rather than hard-coding it is the whole point of passing a tag.
 */
const INTL_TAG: Record<Locale, string> = {
  uk: 'uk-UA',
  en: 'en-US',
};

export function intlTagFor(locale: Locale): string {
  return INTL_TAG[locale];
}

/**
 * Narrows a value that came from outside — a cookie, a query string, a stored
 * preference. All three are user-editable, so none of them may be trusted into
 * `Locale` without this.
 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** The locale to use for a stored preference that is missing or unrecognised. */
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale;
}
