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

  /**
   * Handed to the dashboard rather than rendered above it, because it belongs
   * inside the teal panel: a header on the grey background above a full-bleed
   * gradient leaves a stripe of nothing at the top of the screen.
   */
  const header = (
    <div className="flex flex-row items-baseline justify-between">
      <h1 className="text-2xl font-bold text-content-inverse">{t('common.appName')}</h1>
      <div className="flex flex-row gap-4">
        <Link href="/subscriptions" className="text-sm text-content-inverse/80">
          {t('nav.subscriptions')}
        </Link>
        <Link href="/settings/limits" className="text-sm text-content-inverse/80">
          {t('nav.limits')}
        </Link>
        <Link href="/settings/household" className="text-sm text-content-inverse/80">
          {t('nav.settings')}
        </Link>
        <Link
          href="/settings/profile"
          data-testid="go-to-profile"
          className="text-sm text-content-inverse/80"
        >
          {t('nav.profile')}
        </Link>
      </div>
    </div>
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col">
      {/* The user id comes from the server, where the token has already been
          revalidated, rather than from a second client-side round trip. */}
      <Dashboard userId={user?.id} header={header} />
    </main>
  );
}
