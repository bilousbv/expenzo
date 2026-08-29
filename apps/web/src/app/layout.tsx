import type { Metadata } from 'next';

import { getLocale, getTranslations } from '@/lib/i18n/server';
import { getTheme } from '@/lib/theme/server';

import { Providers } from './providers';

import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();

  return {
    // The product's own name, which is not translated.
    title: t('common.appName'),
    description: t('pageTitle.description'),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);

  return (
    // `lang` is not decoration: it tells screen readers which voice to use and
    // the browser which hyphenation and quotation rules apply. Leaving it at a
    // hard-coded "en" while rendering Ukrainian makes the page announce itself
    // in the wrong language to exactly the users who most depend on it.
    // Light is the base and dark is the .dark override, so only dark needs a
    // class. Written here, during the server render, so the scheme is right in
    // the first byte rather than after a flash of the default.
    <html lang={locale} className={theme === 'dark' ? 'dark' : undefined}>
      <body className="bg-background text-content antialiased">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
