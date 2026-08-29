import { Card } from '@expenzo/ui';
import Link from 'next/link';

import { getTranslations } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.invite') };
}

/**
 * Redeeming an invitation.
 *
 * This route sits inside the (app) group, so an unauthenticated visitor is
 * sent to sign in first and arrives back here afterwards — which is what we
 * want, since accepting has to attribute the membership to someone.
 */
export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { t } = await getTranslations();
  const { token } = await params;
  const supabase = await createClient();

  const { error } = await supabase.rpc('accept_household_invitation', { token });

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-gutter">
        <Card className="w-full max-w-sm gap-gutter">
          <h1 className="text-2xl font-bold text-content">{t('invite.failed')}</h1>
          <p role="alert" data-testid="invite-error" className="text-sm text-negative">
            {error.message}
          </p>
          <p className="text-sm text-content-muted">{t('invite.explainer')}</p>
          <Link href="/" className="text-sm text-link">
            {t('nav.backToExpenses')}
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-gutter">
      <Card className="w-full max-w-sm gap-gutter">
        <h1 className="text-2xl font-bold text-content" data-testid="invite-accepted">
          {t('household.joined')}
        </h1>
        <p className="text-sm text-content-muted">{t('household.joinedExplainer')}</p>
        <Link href="/" className="text-sm text-link">
          {t('nav.goToExpenses')}
        </Link>
      </Card>
    </main>
  );
}
