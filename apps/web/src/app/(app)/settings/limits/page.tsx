import Link from 'next/link';

import { LimitManager } from '@/features/limits/limit-manager';
import { getTranslations } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.limits') };
}

export default async function LimitsPage() {
  const { t } = await getTranslations();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-gutter p-gutter">
      <div className="flex flex-row items-baseline justify-between">
        <h1 className="text-3xl font-bold text-content">{t('limits.title')}</h1>
        <Link href="/" className="text-sm text-link underline">
          Dashboard
        </Link>
      </div>

      <LimitManager userId={user?.id} />
    </main>
  );
}
