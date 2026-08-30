import { Card } from '@expenzo/ui';
import Link from 'next/link';

import { HouseholdManager } from '@/features/household/household-manager';
import { LanguageSwitcher } from '@/features/settings/language-switcher';
import { ThemeSwitcher } from '@/features/settings/theme-switcher';
import { getLocale, getTranslations } from '@/lib/i18n/server';
import { getTheme } from '@/lib/theme/server';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.household') };
}

export default async function HouseholdSettingsPage() {
  const { t } = await getTranslations();
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  const supabase = await createClient();

  // Row-level security limits this to the caller's own household, so it needs
  // no filter. The roster and the invitations are read by the client component
  // below instead: every control on them mutates, and the list has to change
  // the moment one lands.
  const [{ data: household }, { data: auth }] = await Promise.all([
    supabase.from('households').select('id, name').maybeSingle(),
    supabase.auth.getUser(),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-gutter p-gutter">
      <h1 className="text-3xl font-bold text-content">{household?.name ?? t('household.title')}</h1>

      <HouseholdManager userId={auth.user?.id} />

      <Card className="gap-gutter">
        <LanguageSwitcher locale={locale} />
        <ThemeSwitcher theme={theme} />
      </Card>

      <Card className="gap-gutter">
        <h2 className="text-lg font-semibold text-content">{t('categories.title')}</h2>
        <Link href="/settings/categories" className="text-link underline">
          {t('nav.manageCategories')}
        </Link>
      </Card>
    </main>
  );
}
