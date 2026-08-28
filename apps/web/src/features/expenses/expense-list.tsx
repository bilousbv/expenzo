'use client';

import {
  useCategories,
  useCurrentHousehold,
  useDeleteExpense,
  useDisplayCurrency,
  useExpenses,
  useHouseholdMembers,
} from '@expenzo/data';
import { groupByDay, localDateIn, relativeDayKey, type ExpenseFilter } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import {
  buttonContainerClass,
  buttonLabelClass,
  Card,
  formatApprox,
  formatCurrency,
  IconTile,
  iconTileGlyphClass,
  iconTileGlyphStyle,
  monogramFor,
} from '@expenzo/ui';

/**
 * The chronological list, grouped by day.
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
  // What this member reads in; the household still records in its own.
  const display = useDisplayCurrency();
  const timeZone = household.data?.timezone ?? 'UTC';

  const categories = useCategories(householdId);
  const members = useHouseholdMembers(householdId);
  const expenses = useExpenses({ householdId, filter });
  const remove = useDeleteExpense(householdId);

  const categoryById = new Map((categories.data ?? []).map((category) => [category.id, category]));
  const authorFor = new Map(
    (members.data ?? []).map((member) => [member.userId, member.displayName]),
  );

  const rows = (expenses.data ?? []).flatMap((page) => page.rows);
  const days = groupByDay(rows, (row) => row.occurred_on);
  const today = localDateIn(new Date(), timeZone);

  if (expenses.isPending) {
    return (
      <Card>
        <p className="text-sm text-content-muted">{t('common.loading')}</p>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <p data-testid="no-expenses" className="text-sm text-content-muted">
          {t('expenses.nothingRecorded')}
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-gutter">
      {days.map((day) => {
        const relative = relativeDayKey(day.date, today);
        // Net for the day, summed in the household's own currency so a day
        // holding two currencies still adds to one figure.
        const netMinor = day.items.reduce(
          (total, row) =>
            row.direction === 'income'
              ? total + row.base_amount_minor
              : total - row.base_amount_minor,
          0,
        );

        return (
          <section key={day.date} className="flex flex-col gap-2">
            <div className="flex flex-row items-baseline justify-between px-1">
              <h3 className="text-sm font-medium text-content">
                {relative ? t(`common.${relative}`) : day.date}
              </h3>
              <span
                data-testid="day-total"
                className={`text-sm ${netMinor > 0 ? 'text-positive' : 'text-content-muted'}`}
              >
                {netMinor > 0 ? '+' : ''}
                {formatApprox(display.convert(netMinor), display.currency, display.approximate)}
              </span>
            </div>

            {/* One card per day rather than one per row: the rows inside share
                a surface and are separated by rules, which is what makes the
                grouping read as a group. */}
            <Card className="gap-0 p-0">
              {day.items.map((row, index) => {
                const category = row.category_id ? categoryById.get(row.category_id) : undefined;
                const income = row.direction === 'income';

                return (
                  <div
                    key={row.id}
                    data-testid="expense-row"
                    className={`flex flex-row items-center gap-3 px-gutter py-3 ${
                      index > 0 ? 'border-t border-surface-muted' : ''
                    }`}
                  >
                    <IconTile color={category?.color ?? null}>
                      <span
                        className={iconTileGlyphClass}
                        style={iconTileGlyphStyle(category?.color ?? null)}
                      >
                        {monogramFor(row.merchant ?? category?.name)}
                      </span>
                    </IconTile>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-content">
                        {row.merchant ?? t('expenses.fallbackName')}
                      </span>
                      <span className="truncate text-xs text-content-muted">
                        {category ? category.name : t('common.uncategorised')} ·{' '}
                        <span data-testid="expense-author">
                          {authorFor.get(row.created_by) ?? t('common.member')}
                        </span>
                      </span>
                    </div>

                    <div className="flex flex-row items-center gap-3">
                      <span className="flex flex-col items-end">
                        {/* Income is signed here for the reader's benefit only
                            — the stored amount is positive and the direction
                            carries the meaning. */}
                        <span
                          data-testid="expense-amount"
                          className={income ? 'font-semibold text-positive' : 'text-content'}
                        >
                          {income ? '+' : ''}
                          {formatCurrency(row.amount_minor, row.currency)}
                        </span>

                        {/* What this row contributed to the totals above. Shown
                            only when it differs, so the common case stays
                            uncluttered and a foreign amount never looks like it
                            was ignored. */}
                        {row.currency !== display.currency ? (
                          <span
                            data-testid="expense-base-amount"
                            className="text-xs text-content-muted"
                          >
                            {/* Always marked: this figure was converted
                                whichever currency the reader is in. */}
                            {formatApprox(
                              display.convert(row.base_amount_minor),
                              display.currency,
                              true,
                            )}
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
                  </div>
                );
              })}
            </Card>
          </section>
        );
      })}

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
    </div>
  );
}
