'use client';

import {
  useCategories,
  useCreateExpense,
  useCurrentHousehold,
  useDeleteExpense,
  useExpenses,
} from '@expenzo/data';
import type { CreateExpenseInput, ExpenseFilter } from '@expenzo/domain';
import { localDateIn } from '@expenzo/domain';
import {
  buttonContainerClass,
  buttonLabelClass,
  Card,
  categoryDotClass,
  categoryDotStyle,
  formatCurrency,
  type CategoryOption,
} from '@expenzo/ui';
import { useMemo, useState } from 'react';

import { ExpenseForm } from './expense-form';

const SCOPES = [
  { value: 'all', label: 'Everything' },
  { value: 'shared', label: 'Shared' },
  { value: 'personal', label: 'Personal' },
] as const;

export function ExpenseList({ userId }: { userId: string | undefined }) {
  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  const currency = household.data?.base_currency ?? 'USD';
  const timeZone = household.data?.timezone ?? 'UTC';

  const [scope, setScope] = useState<ExpenseFilter['scope']>('all');
  const filter = useMemo(() => ({ scope }), [scope]);

  const categories = useCategories(householdId);
  const expenses = useExpenses({ householdId, filter });
  const create = useCreateExpense(householdId, userId);
  const remove = useDeleteExpense(householdId);

  const options: CategoryOption[] = (categories.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
  }));

  const nameFor = new Map(options.map((option) => [option.id, option]));
  const rows = (expenses.data ?? []).flatMap((page) => page.rows);

  // The visible total only, and labelled as such. Calling a running sum of the
  // loaded pages "total spent" would be a lie the moment there is a page two.
  const visibleTotal = rows.reduce((sum, row) => sum + row.base_amount_minor, 0);

  async function handleCreate(input: CreateExpenseInput) {
    await create.mutateAsync(input);
  }

  return (
    <div className="flex flex-col gap-gutter">
      <Card className="gap-gutter">
        <h2 className="text-lg font-semibold text-content">Add an expense</h2>
        <ExpenseForm
          currency={currency}
          timeZone={timeZone}
          today={localDateIn(new Date(), timeZone)}
          categories={options}
          onCreate={handleCreate}
          disabled={!householdId}
        />
      </Card>

      <Card className="gap-gutter">
        <div className="flex flex-row items-baseline justify-between">
          <h2 className="text-lg font-semibold text-content">Expenses</h2>
          <span data-testid="visible-total" className="text-xl font-semibold text-content">
            {formatCurrency(visibleTotal, currency)}
          </span>
        </div>
        <p className="text-xs text-content-muted">Total of the {rows.length} shown</p>

        <div role="radiogroup" aria-label="Scope" className="flex flex-row gap-2">
          {SCOPES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={scope === option.value}
              data-testid={`scope-${option.value}`}
              onClick={() => setScope(option.value)}
              className={buttonContainerClass(
                scope === option.value ? 'primary' : 'secondary',
                'sm',
              )}
            >
              <span
                className={buttonLabelClass(scope === option.value ? 'primary' : 'secondary', 'sm')}
              >
                {option.label}
              </span>
            </button>
          ))}
        </div>

        {expenses.isPending ? (
          <p className="text-sm text-content-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p data-testid="no-expenses" className="text-sm text-content-muted">
            Nothing recorded yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => {
              const category = row.category_id ? nameFor.get(row.category_id) : undefined;

              return (
                <li
                  key={row.id}
                  data-testid="expense-row"
                  className="flex flex-row items-center justify-between border-b border-brand-100 pb-2"
                >
                  <div className="flex flex-col">
                    <span className="text-content">{row.merchant ?? 'Expense'}</span>
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
                        'Uncategorised'
                      )}
                      <span>{row.occurred_on}</span>
                      {row.visibility === 'personal' ? <span>Personal</span> : null}
                    </span>
                  </div>

                  <div className="flex flex-row items-center gap-3">
                    <span data-testid="expense-amount" className="text-content">
                      {formatCurrency(row.amount_minor, row.currency)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete ${row.merchant ?? 'expense'}`}
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
              {expenses.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </span>
          </button>
        ) : null}
      </Card>
    </div>
  );
}
