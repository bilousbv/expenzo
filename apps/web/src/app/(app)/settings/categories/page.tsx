import { Card } from '@expenzo/ui';

import { CategoryManager } from '@/features/categories/category-manager';
import { getTranslations } from '@/lib/i18n/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.categories') };
}

export default async function CategoriesPage() {
  const { t } = await getTranslations();
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-gutter p-gutter">
      <h1 className="text-3xl font-bold text-content">{t('categories.title')}</h1>

      <Card className="gap-gutter">
        {/* A client component rather than a server one: the list is read and
            written from the same screen, and TanStack Query is what keeps the
            two in step here and on mobile alike. */}
        <CategoryManager />
      </Card>
    </main>
  );
}
