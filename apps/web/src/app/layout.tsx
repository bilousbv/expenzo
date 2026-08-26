import type { Metadata } from 'next';

import { getLocale, getTranslations } from '@/lib/i18n/server';

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
  const locale = await getLocale();

  return (
    // `lang` is not decoration: it tells screen readers which voice to use and
    // the browser which hyphenation and quotation rules apply. Leaving it at a
    // hard-coded "en" while rendering Ukrainian makes the page announce itself
    // in the wrong language to exactly the users who most depend on it.
    <html lang={locale}>
      <body className="bg-surface-muted text-content antialiased">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
