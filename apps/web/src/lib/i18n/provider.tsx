'use client';

import { createI18n, I18nextProvider, type Locale } from '@expenzo/i18n';
import { useState, type ReactNode } from 'react';

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

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
