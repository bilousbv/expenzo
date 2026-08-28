import { CategoryExpenses } from '@/features/dashboard/category-expenses';
import { getTranslations } from '@/lib/i18n/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.categories') };
}

/**
 * One category's expenses, grouped by day.
 *
 * Its own route rather than an expanding row: it is linkable, the back button
 * does the obvious thing, and the dashboard stays a summary rather than growing
 * a list underneath every category.
 *
 * `from` and `to` arrive from the dashboard so the page opens on the period the
 * rollup was showing rather than resetting to this month.
 */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { categoryId } = await params;
  const { from, to } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-gutter p-gutter">
      <CategoryExpenses categoryId={categoryId} from={from} to={to} />
    </main>
  );
}
