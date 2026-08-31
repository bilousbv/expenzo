import Link from 'next/link';

import { NotificationCentre } from '@/features/notifications/notification-centre';
import { getTranslations } from '@/lib/i18n/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.notifications') };
}

export default async function NotificationsPage() {
  const { t } = await getTranslations();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-gutter p-gutter">
      <div className="flex flex-row items-baseline justify-between gap-4">
        <h1 className="text-3xl font-bold text-content">{t('notifications.title')}</h1>
        <Link href="/settings/notifications" className="text-sm text-link underline">
          {t('notifications.preferences.title')}
        </Link>
      </div>

      <NotificationCentre />
    </main>
  );
}
