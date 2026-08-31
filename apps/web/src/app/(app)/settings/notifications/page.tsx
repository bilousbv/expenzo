import Link from 'next/link';

import { NotificationPreferences } from '@/features/notifications/notification-preferences';
import { getTranslations } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.notificationSettings') };
}

export default async function NotificationSettingsPage() {
  const { t } = await getTranslations();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-gutter p-gutter">
      <div className="flex flex-row items-baseline justify-between gap-4">
        <h1 className="text-3xl font-bold text-content">{t('notifications.preferences.title')}</h1>
        <Link href="/notifications" className="text-sm text-link underline">
          {t('notifications.title')}
        </Link>
      </div>

      <NotificationPreferences userId={user?.id} />
    </main>
  );
}
