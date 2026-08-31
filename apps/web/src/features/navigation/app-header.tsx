'use client';

import { useTranslation } from '@expenzo/i18n';
import Link from 'next/link';

import { NotificationBell } from './notification-bell';

/**
 * The site-wide header.
 *
 * It used to live inside the dashboard's gradient panel, which meant it existed
 * on exactly one page: every settings screen was a dead end you could only
 * leave with the browser's back button. It now sits in the (app) layout, above
 * the panel rather than inside it, so the same navigation is on every signed-in
 * page.
 *
 * A plain bar on the app background rather than teal. The gradient is the
 * dashboard's one loud surface, and repeating it on every screen would spend
 * the emphasis it exists to provide.
 */
export function AppHeader() {
  const { t } = useTranslation();

  const links = [
    { href: '/subscriptions', label: t('nav.subscriptions') },
    { href: '/settings/limits', label: t('nav.limits') },
    { href: '/settings/household', label: t('nav.settings') },
    { href: '/settings/profile', label: t('nav.profile'), testID: 'go-to-profile' },
  ];

  return (
    <header className="border-b border-surface-muted bg-surface">
      <nav
        aria-label={t('nav.primary')}
        className="mx-auto flex max-w-2xl flex-row items-baseline justify-between gap-gutter p-gutter"
      >
        <Link href="/" data-testid="go-home" className="text-xl font-bold text-content">
          {t('common.appName')}
        </Link>

        <div className="flex flex-row flex-wrap items-baseline gap-4">
          <NotificationBell />

          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-testid={link.testID}
              className="text-sm text-content-muted"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
