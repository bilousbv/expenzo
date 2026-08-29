import { Card } from '@expenzo/ui';
import { Suspense } from 'react';

import { MagicLinkPanel } from '@/features/auth/magic-link-panel';
import { getTranslations } from '@/lib/i18n/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.magicLink') };
}

export default async function MagicLinkPage() {
  const { t } = await getTranslations();
  return (
    <main className="flex min-h-screen items-center justify-center p-gutter">
      <Card className="w-full max-w-sm gap-gutter">
        <h1 className="text-2xl font-bold text-content">{t('auth.magicLinkTitle')}</h1>

        {/* useSearchParams needs a Suspense boundary to stay statically renderable. */}
        <Suspense fallback={null}>
          <MagicLinkPanel />
        </Suspense>
      </Card>
    </main>
  );
}
