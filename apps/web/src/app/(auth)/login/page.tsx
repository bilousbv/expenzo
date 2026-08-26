import { Card } from '@expenzo/ui';
import { Suspense } from 'react';

import { AuthPanel } from '@/features/auth/auth-panel';
import { getTranslations } from '@/lib/i18n/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.signIn') };
}

export default async function LoginPage() {
  const { t } = await getTranslations();
  return (
    <main className="flex min-h-screen items-center justify-center p-gutter">
      <Card className="w-full max-w-sm gap-gutter">
        <h1 className="text-2xl font-bold text-content">{t('auth.signInTitle')}</h1>

        {/* useSearchParams needs a Suspense boundary to stay statically renderable. */}
        <Suspense fallback={null}>
          <AuthPanel mode="signIn" />
        </Suspense>
      </Card>
    </main>
  );
}
