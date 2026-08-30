'use client';

import { createI18n, I18nextProvider, type Locale } from '@expenzo/i18n';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * Hands client components the same locale the server rendered with.
 *
 * Built in a lazy `useState` initialiser rather than an effect, so the very
 * first render already has a translator. react-i18next renders the raw key when
 * it has none, which would show `auth.signIn` for a frame before the real text
 * arrived — and on a slow device, for rather more than a frame.
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const [instance] = useState(() => createI18n(locale));

  /*
   * Switching language writes a cookie and calls `router.refresh()`, which
   * re-renders the server tree and delivers the new locale as this prop. The
   * instance is built once and would otherwise keep whatever language the page
   * first loaded in, so every client component on screen stayed in the old one
   * until a full page load — invisible while only server components carried
   * translated text, and wrong the moment one of them did not.
   *
   * Both catalogues are already in the instance, so this resolves immediately
   * and touches no network. Never runs on the server, where each request builds
   * its own instance for its own locale.
   */
  useEffect(() => {
    if (instance.language !== locale) void instance.changeLanguage(locale);
  }, [instance, locale]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
