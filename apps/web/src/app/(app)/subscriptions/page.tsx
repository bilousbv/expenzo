import { SubscriptionManager } from '@/features/subscriptions/subscription-manager';
import { getTranslations } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.subscriptions') };
}

export default async function SubscriptionsPage() {
  const { t } = await getTranslations();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-gutter p-gutter">
      <h1 className="text-3xl font-bold text-content">{t('subscriptions.title')}</h1>

      <SubscriptionManager userId={user?.id} />
    </main>
  );
}
