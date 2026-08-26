import Link from 'next/link';

import { Dashboard } from '@/features/dashboard/dashboard';
import { getTranslations } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.dashboard') };
}

export default async function Home() {
  const { t } = await getTranslations();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-gutter p-gutter">
      <div className="flex flex-row items-baseline justify-between">
        <h1 className="text-3xl font-bold text-content">{t('common.appName')}</h1>
        <div className="flex flex-row gap-3">
          <Link href="/subscriptions" className="text-sm text-brand-600 underline">
            {t('nav.subscriptions')}
          </Link>
          <Link href="/settings/limits" className="text-sm text-brand-600 underline">
            {t('nav.limits')}
          </Link>
          <Link href="/settings/household" className="text-sm text-brand-600 underline">
            {t('nav.settings')}
          </Link>
        </div>
      </div>

      {/* The user id comes from the server, where the token has already been
          revalidated, rather than from a second client-side round trip. */}
      <Dashboard userId={user?.id} />
    </main>
  );
}
