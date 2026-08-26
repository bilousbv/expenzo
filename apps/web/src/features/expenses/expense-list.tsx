'use client';

import {
  useCategories,
  useCurrentHousehold,
  useDeleteExpense,
  useExpenses,
  useHouseholdMembers,
} from '@expenzo/data';
import type { ExpenseFilter } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import {
  buttonContainerClass,
  buttonLabelClass,
  Card,
  categoryDotClass,
  categoryDotStyle,
  formatCurrency,
} from '@expenzo/ui';

/**
 * The chronological list.
 *
 * Takes its filter from the dashboard rather than owning one: the period and
 * author controls sit above the whole screen, and a list with its own copy
 * would disagree with the totals sitting next to it.
 */
export function ExpenseList({
  userId: _userId,
  filter,
}: {
  userId: string | undefined;
  filter: ExpenseFilter;
}) {
  const { t } = useTranslation();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  const baseCurrency = household.data?.base_currency;

  const categories = useCategories(householdId);
  const members = useHouseholdMembers(householdId);
  const expenses = useExpenses({ householdId, filter });
  const remove = useDeleteExpense(householdId);

  const categoryById = new Map((categories.data ?? []).map((category) => [category.id, category]));
  const authorFor = new Map(
    (members.data ?? []).map((member) => [member.userId, member.displayName]),
  );

  const rows = (expenses.data ?? []).flatMap((page) => page.rows);

  return (
    <Card className="gap-gutter">
      {expenses.isPending ? (
        <p className="text-sm text-content-muted">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p data-testid="no-expenses" className="text-sm text-content-muted">
          {t('expenses.nothingRecorded')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const category = row.category_id ? categoryById.get(row.category_id) : undefined;
            const income = row.direction === 'income';

            return (
              <li
                key={row.id}
                data-testid="expense-row"
                className="flex flex-row items-center justify-between border-b border-brand-100 pb-2"
              >
                <div className="flex flex-col">
                  <span className="text-content">{row.merchant ?? t('expenses.fallbackName')}</span>
                  <span className="flex flex-row items-center gap-2 text-xs text-content-muted">
                    {category ? (
                      <>
                        <span
                          aria-hidden
                          className={categoryDotClass()}
                          style={categoryDotStyle(category.color)}
                        />
                        {category.name}
                      </>
                    ) : (
                      t('common.uncategorised')
                    )}
                    <span>{row.occurred_on}</span>
                    <span data-testid="expense-author">
                      {authorFor.get(row.created_by) ?? t('common.member')}
                    </span>
                  </span>
                </div>

                <div className="flex flex-row items-center gap-3">
                  <span className="flex flex-col items-end">
                    {/* Income is signed here for the reader's benefit only — the
                        stored amount is positive and the direction carries the
                        meaning. */}
                    <span
                      data-testid="expense-amount"
                      className={income ? 'text-green-700' : 'text-content'}
                    >
                      {income ? '+' : ''}
                      {formatCurrency(row.amount_minor, row.currency)}
                    </span>

                    {/* What this row contributed to the totals above. Shown only
                        when it differs, so the common case stays uncluttered
                        and a foreign amount never looks like it was ignored. */}
                    {baseCurrency && row.currency !== baseCurrency ? (
                      <span
                        data-testid="expense-base-amount"
                        className="text-xs text-content-muted"
                      >
                        ≈ {formatCurrency(row.base_amount_minor, baseCurrency)}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    aria-label={t('expenses.deleteLabel', {
                      name: row.merchant ?? t('expenses.fallbackName'),
                    })}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(row.id)}
                    className="text-sm text-content-muted"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {expenses.hasNextPage ? (
        <button
          type="button"
          data-testid="load-more"
          disabled={expenses.isFetchingNextPage}
          onClick={() => void expenses.fetchNextPage()}
          className={buttonContainerClass('secondary', 'md', expenses.isFetchingNextPage)}
        >
          <span className={buttonLabelClass('secondary', 'md')}>
            {t(expenses.isFetchingNextPage ? 'common.loading' : 'expenses.loadMore')}
          </span>
        </button>
      ) : null}
    </Card>
  );
}
