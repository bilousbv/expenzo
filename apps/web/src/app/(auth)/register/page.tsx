import { Card } from '@expenzo/ui';
import { Suspense } from 'react';

import { AuthPanel } from '@/features/auth/auth-panel';
import { getTranslations } from '@/lib/i18n/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.register') };
}

export default async function RegisterPage() {
  const { t } = await getTranslations();
  return (
    <main className="flex min-h-screen items-center justify-center p-gutter">
      <Card className="w-full max-w-sm gap-gutter">
        <h1 className="text-2xl font-bold text-content">{t('auth.createAccountTitle')}</h1>
        <p className="text-sm text-content-muted">{t('auth.createAccountExplainer')}</p>

        <Suspense fallback={null}>
          <AuthPanel mode="signUp" />
        </Suspense>
      </Card>
    </main>
  );
}
