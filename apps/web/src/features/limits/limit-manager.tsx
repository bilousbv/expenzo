'use client';

import {
  useCategories,
  useCreateLimit,
  useCurrentHousehold,
  useDeleteLimit,
  useLimits,
} from '@expenzo/data';
import { createLimitInput, parseAmountInput, VALIDATION_PARAMS } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import {
  buttonContainerClass,
  buttonLabelClass,
  Card,
  CategorySelect,
  fieldInputClass,
  formatCurrency,
  type CategoryOption,
} from '@expenzo/ui';
import { useId, useState, type FormEvent } from 'react';

export function LimitManager({ userId }: { userId: string | undefined }) {
  const { t } = useTranslation();
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
      setError(t(parsed.error.issues[0]?.message ?? 'limits.errors.invalid', VALIDATION_PARAMS));
      return;
    }

    setPending(true);
    try {
      await create.mutateAsync(parsed.data);
      setAmountText('');
      setCategoryId(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('limits.errors.setFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-gutter">
      <Card className="gap-gutter">
        <h2 className="text-lg font-semibold text-content">{t('limits.setHeading')}</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-gutter" noValidate>
          {/* No category means the household-wide limit — the one the dashboard
              shows against everything spent. */}
          <CategorySelect
            options={options}
            value={categoryId}
            onChange={setCategoryId}
            placeholder={t('limits.householdWide')}
            disabled={!householdId}
          />

          <label htmlFor={amountId} className="text-sm font-medium text-content-muted">
            {t('limits.monthly')}
          </label>
          <input
            id={amountId}
            name="amount"
            type="text"
            inputMode="decimal"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            placeholder="500"
            className={fieldInputClass()}
          />

          <button
            type="submit"
            disabled={pending || !householdId}
            className={buttonContainerClass('primary', 'md', pending || !householdId)}
          >
            <span className={buttonLabelClass('primary', 'md')}>
              {t(pending ? 'limits.saving' : 'limits.set')}
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
        <h2 className="text-lg font-semibold text-content">{t('limits.current')}</h2>

        {limits.isPending ? (
          <p className="text-sm text-content-muted">{t('common.loading')}</p>
        ) : (limits.data ?? []).length === 0 ? (
          <p data-testid="no-limits" className="text-sm text-content-muted">
            {t('limits.none')}
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
                    ? (categoryById.get(limit.category_id)?.name ?? t('limits.fallbackCategory'))
                    : t('common.everything')}
                </span>

                <span className="flex flex-row items-center gap-3">
                  <span data-testid="limit-amount" className="text-content">
                    {formatCurrency(limit.amount_minor, currency)}
                  </span>
                  <button
                    type="button"
                    aria-label={t('limits.removeLabel')}
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
