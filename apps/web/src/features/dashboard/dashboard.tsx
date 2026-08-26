'use client';

import {
  useCategories,
  useCategorySpend,
  useCreateExpense,
  useCurrentHousehold,
  useHouseholdMembers,
  useLimits,
  usePeriodSummary,
  useSupportedCurrencies,
} from '@expenzo/data';
import {
  localDateIn,
  PERIOD_PRESETS,
  presetRange,
  type CreateExpenseInput,
  type PeriodPreset,
} from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { buttonContainerClass, buttonLabelClass, Card, type CategoryOption } from '@expenzo/ui';
import { useMemo, useState } from 'react';

import { ExpenseDialog } from '@/features/expenses/expense-dialog';
import { ExpenseForm } from '@/features/expenses/expense-form';
import { ExpenseList } from '@/features/expenses/expense-list';

import { BudgetSummary } from './budget-summary';
import { CategoryBreakdown, type CategoryBreakdownRow } from './category-breakdown';

export function Dashboard({ userId }: { userId: string | undefined }) {
  const { t } = useTranslation();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  const currency = household.data?.base_currency ?? 'USD';
  const timeZone = household.data?.timezone ?? 'UTC';

  const [preset, setPreset] = useState<PeriodPreset>('this-month');
  const [memberId, setMemberId] = useState<string | undefined>(undefined);
  const [adding, setAdding] = useState(false);

  // Resolved in the household's timezone: an expense entered at 23:30 in Madrid
  // belongs to the month it was entered in there, not in UTC.
  const range = useMemo(() => presetRange(preset, new Date(), timeZone), [preset, timeZone]);

  const window = useMemo(
    () => ({ from: range.start, to: range.end, memberId }),
    [range.start, range.end, memberId],
  );

  const members = useHouseholdMembers(householdId);
  const categories = useCategories(householdId);
  const limits = useLimits(householdId);
  // Held for a day: rates change daily, the set of quoted currencies does not.
  const currencies = useSupportedCurrencies(household.data?.base_currency);
  const summary = usePeriodSummary(householdId, window);
  const categorySpend = useCategorySpend(householdId, window);
  const create = useCreateExpense(householdId, userId);

  const options: CategoryOption[] = (categories.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
  }));

  const limitFor = new Map(
    (limits.data ?? []).map((limit) => [limit.category_id, limit.amount_minor]),
  );
  const categoryById = new Map(options.map((option) => [option.id, option]));

  const breakdown: CategoryBreakdownRow[] = (categorySpend.data ?? [])
    .map((entry) => {
      const category = entry.categoryId ? categoryById.get(entry.categoryId) : undefined;

      return {
        categoryId: entry.categoryId,
        // Expenses with no category still sum to something, and dropping them
        // would make the rollup disagree with the period total.
        name: category?.name ?? t('common.uncategorised'),
        color: category?.color ?? null,
        spentMinor: entry.totalMinor,
        limitMinor: limitFor.get(entry.categoryId) ?? null,
      };
    })
    .sort((a, b) => b.spentMinor - a.spentMinor);

  const overallLimit = limitFor.get(null) ?? null;

  async function handleCreate(input: CreateExpenseInput) {
    await create.mutateAsync(input);
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-gutter">
      <BudgetSummary
        spentMinor={summary.data?.spentMinor ?? 0}
        incomeMinor={summary.data?.incomeMinor ?? 0}
        balanceMinor={summary.data?.balanceMinor ?? 0}
        currency={currency}
        loading={summary.isPending}
      />

      <Card className="gap-gutter">
        <div
          role="radiogroup"
          aria-label={t('dashboard.period')}
          className="flex flex-row flex-wrap gap-2"
        >
          {PERIOD_PRESETS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={preset === option}
              data-testid={`period-${option}`}
              onClick={() => setPreset(option)}
              className={buttonContainerClass(preset === option ? 'primary' : 'secondary', 'sm')}
            >
              <span className={buttonLabelClass(preset === option ? 'primary' : 'secondary', 'sm')}>
                {t(`period.${option}`)}
              </span>
            </button>
          ))}
        </div>

        <div
          role="radiogroup"
          aria-label={t('dashboard.author')}
          className="flex flex-row flex-wrap gap-2"
        >
          <button
            type="button"
            role="radio"
            aria-checked={memberId === undefined}
            data-testid="author-all"
            onClick={() => setMemberId(undefined)}
            className={buttonContainerClass(memberId === undefined ? 'primary' : 'secondary', 'sm')}
          >
            <span
              className={buttonLabelClass(memberId === undefined ? 'primary' : 'secondary', 'sm')}
            >
              {t('common.everyone')}
            </span>
          </button>

          {(members.data ?? []).map((member) => (
            <button
              key={member.userId}
              type="button"
              role="radio"
              aria-checked={memberId === member.userId}
              data-testid={`author-${member.userId}`}
              onClick={() => setMemberId(member.userId)}
              className={buttonContainerClass(
                memberId === member.userId ? 'primary' : 'secondary',
                'sm',
              )}
            >
              <span
                className={buttonLabelClass(
                  memberId === member.userId ? 'primary' : 'secondary',
                  'sm',
                )}
              >
                {member.displayName}
              </span>
            </button>
          ))}
        </div>

        <p data-testid="period-range" className="text-xs text-content-muted">
          {range.start} {t('dashboard.rangeSeparator')} {range.end}
        </p>
      </Card>

      <div className="flex flex-row items-center justify-between">
        <h2 className="text-xl font-semibold text-content">{t('expenses.title')}</h2>
        <button
          type="button"
          data-testid="open-expense-dialog"
          disabled={!householdId}
          onClick={() => setAdding(true)}
          className={buttonContainerClass('primary', 'md', !householdId)}
        >
          <span className={buttonLabelClass('primary', 'md')}>{t('expenses.add')}</span>
        </button>
      </div>

      <CategoryBreakdown rows={breakdown} currency={currency} loading={categorySpend.isPending} />

      {overallLimit !== null ? (
        <CategoryBreakdown
          rows={[
            {
              categoryId: null,
              name: t('common.everything'),
              color: null,
              spentMinor: summary.data?.spentMinor ?? 0,
              limitMinor: overallLimit,
            },
          ]}
          currency={currency}
        />
      ) : null}

      <ExpenseList userId={userId} filter={window} />

      <ExpenseDialog
        open={adding}
        onClose={() => setAdding(false)}
        title={t('expenses.addDialogTitle')}
      >
        <ExpenseForm
          currency={currency}
          timeZone={timeZone}
          today={localDateIn(new Date(), timeZone)}
          categories={options}
          currencies={currencies.data}
          onCreate={handleCreate}
          disabled={!householdId}
        />
      </ExpenseDialog>
    </div>
  );
}
