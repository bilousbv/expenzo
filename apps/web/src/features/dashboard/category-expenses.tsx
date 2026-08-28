'use client';

import { useCategories, useCurrentHousehold } from '@expenzo/data';
import { categoryFilter, UNCATEGORISED } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import Link from 'next/link';

import { ExpenseList } from '@/features/expenses/expense-list';

export interface CategoryExpensesProps {
  /** A category id, or `uncategorised`. */
  categoryId: string;
  from?: string;
  to?: string;
}

/**
 * One category's expenses, grouped by day.
 *
 * The list component is the same one the dashboard used to render inline; only
 * the filter differs. Expenses with no category reach this through the
 * `uncategorised` segment, because "none" cannot be a category id — that column
 * is a uuid, and any sentinel could one day collide with a real one.
 */
export function CategoryExpenses({ categoryId, from, to }: CategoryExpensesProps) {
  const { t } = useTranslation();
  const household = useCurrentHousehold();
  const categories = useCategories(household.data?.id);

  const uncategorised = categoryId === UNCATEGORISED;

  const name = uncategorised
    ? t('common.uncategorised')
    : ((categories.data ?? []).find((category) => category.id === categoryId)?.name ??
      t('limits.fallbackCategory'));

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/" data-testid="back-to-dashboard" className="text-sm text-brand-600">
          {t('nav.backToDashboard')}
        </Link>
        <h1 data-testid="category-title" className="text-2xl font-bold text-content">
          {name}
        </h1>
        {from && to ? (
          <p data-testid="category-range" className="text-xs text-content-muted">
            {from} {t('dashboard.rangeSeparator')} {to}
          </p>
        ) : null}
      </div>

      <ExpenseList userId={undefined} filter={{ from, to, ...categoryFilter(categoryId) }} />
    </>
  );
}
