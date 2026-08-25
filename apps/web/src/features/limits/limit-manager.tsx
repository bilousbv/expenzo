'use client';

import {
  useCategories,
  useCreateLimit,
  useCurrentHousehold,
  useDeleteLimit,
  useLimits,
} from '@expenzo/data';
import { createLimitInput, parseAmountInput } from '@expenzo/domain';
import {
  buttonContainerClass,
  buttonLabelClass,
  Card,
  CategorySelect,
  formatCurrency,
  type CategoryOption,
} from '@expenzo/ui';
import { useId, useState, type FormEvent } from 'react';

export function LimitManager({ userId }: { userId: string | undefined }) {
  const amountId = useId();

  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  const currency = household.data?.base_currency ?? 'USD';

  const categories = useCategories(householdId);
  const limits = useLimits(householdId);
  const create = useCreateLimit(householdId, userId);
  const remove = useDeleteLimit(householdId);

  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const options: CategoryOption[] = (categories.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
  }));
  const categoryById = new Map(options.map((option) => [option.id, option]));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (pending || !householdId) return;

    setError(null);

    const amountMinor = parseAmountInput(amountText, currency);
    const parsed = createLimitInput.safeParse({ categoryId, amountMinor: amountMinor ?? 0 });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'That is not a limit.');
      return;
    }

    setPending(true);
    try {
      await create.mutateAsync(parsed.data);
      setAmountText('');
      setCategoryId(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not set the limit.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-gutter">
      <Card className="gap-gutter">
        <h2 className="text-lg font-semibold text-content">Set a limit</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-gutter" noValidate>
          {/* No category means the household-wide limit — the one the dashboard
              shows against everything spent. */}
          <CategorySelect
            options={options}
            value={categoryId}
            onChange={setCategoryId}
            placeholder="Everything (household-wide)"
            disabled={!householdId}
          />

          <label htmlFor={amountId} className="text-sm font-medium text-content-muted">
            Monthly limit
          </label>
          <input
            id={amountId}
            name="amount"
            type="text"
            inputMode="decimal"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            placeholder="500"
            className="rounded-card border border-brand-100 bg-white px-4 py-3 text-content outline-none focus:border-brand-500"
          />

          <button
            type="submit"
            disabled={pending || !householdId}
            className={buttonContainerClass('primary', 'md', pending || !householdId)}
          >
            <span className={buttonLabelClass('primary', 'md')}>
              {pending ? 'Saving…' : 'Set limit'}
            </span>
          </button>

          {error ? (
            <p role="alert" data-testid="limit-error" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
        </form>
      </Card>

      <Card className="gap-gutter">
        <h2 className="text-lg font-semibold text-content">Current limits</h2>

        {limits.isPending ? (
          <p className="text-sm text-content-muted">Loading…</p>
        ) : (limits.data ?? []).length === 0 ? (
          <p data-testid="no-limits" className="text-sm text-content-muted">
            No limits set. Spending is shown without one until you add it.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(limits.data ?? []).map((limit) => (
              <li
                key={limit.id}
                data-testid="limit-row"
                className="flex flex-row items-center justify-between"
              >
                <span className="text-content">
                  {limit.category_id
                    ? (categoryById.get(limit.category_id)?.name ?? 'Category')
                    : 'Everything'}
                </span>

                <span className="flex flex-row items-center gap-3">
                  <span data-testid="limit-amount" className="text-content">
                    {formatCurrency(limit.amount_minor, currency)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove limit`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(limit.id)}
                    className="text-sm text-content-muted"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
