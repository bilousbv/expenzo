'use client';

import {
  useCategories,
  useCategorySpend,
  useCreateExpense,
  useCurrentHousehold,
  useDisplayCurrency,
  useHouseholdMembers,
  useLimits,
  usePeriodSummary,
  useSupportedCurrencies,
} from '@expenzo/data';
import {
  describePeriod,
  isIsoDate,
  periodUnit,
  localDateIn,
  presetRange,
  shiftPeriod,
  type CreateExpenseInput,
  type DateRange,
} from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import {
  buttonContainerClass,
  buttonLabelClass,
  Card,
  formatApprox,
  formatMonthLabel,
  formatRange,
  PeriodBar,
  SavedCard,
  type CategoryOption,
} from '@expenzo/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ExpenseDialog } from '@/features/expenses/expense-dialog';
import { ExpenseForm } from '@/features/expenses/expense-form';

import { BudgetSummary } from './budget-summary';
import { PeriodPicker } from './period-picker';
import { CategoryBreakdown, type CategoryBreakdownRow } from './category-breakdown';

export function Dashboard({ userId }: { userId: string | undefined }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  /*
   * What this member reads in. The household still records everything in its
   * own currency; this converts on the way to the screen, so two people can
   * read one ledger in two currencies without either of them changing it.
   */
  const display = useDisplayCurrency();
  const timeZone = household.data?.timezone ?? 'UTC';

  const [memberId, setMemberId] = useState<string | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false);

  /*
   * The period lives in the URL, so it survives a reload, the back button and
   * being sent to somebody else — and the category page already reads the same
   * two parameters, which is what keeps the drill-down on the window the
   * dashboard was showing.
   *
   * Resolved in the household's timezone: an expense entered at 23:30 in Madrid
   * belongs to the month it was entered in there, not in UTC.
   */
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const range = useMemo(
    () =>
      from && to && isIsoDate(from) && isIsoDate(to) && from <= to
        ? { start: from, end: to }
        : presetRange('this-month', new Date(), timeZone),
    [from, to, timeZone],
  );

  function setRange(next: DateRange) {
    // replace rather than push: stepping through periods would otherwise fill
    // the history with entries the back button has to walk out of one by one.
    router.replace(`/?from=${next.start}&to=${next.end}`, { scroll: false });
  }

  const described = describePeriod(range, new Date(), timeZone);

  const periodLabel =
    described.kind === 'preset'
      ? t(`period.${described.preset}`)
      : described.kind === 'month'
        ? formatMonthLabel(described.year, described.month, i18n.language)
        : t('period.custom');

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

  /** What the household kept over the period: income minus spending. */
  const saved = summary.data?.balanceMinor ?? 0;

  /** Converted into the reader's currency, and marked when it was converted. */
  const amount = (minor: number) =>
    formatApprox(display.convert(minor), display.currency, display.approximate);

  async function handleCreate(input: CreateExpenseInput) {
    await create.mutateAsync(input);
    setAdding(false);
  }

  return (
    <div className="flex flex-col">
      {/* At the top of the page, above everything it filters. The arrows step
          by whatever unit the period is: a month by a month, a quarter by a
          quarter, a year by a year, a week by seven days. An arbitrary range
          has no unit, so they are hidden for it. */}
      <div className="p-gutter pb-0">
        <PeriodBar
          label={periodLabel}
          dates={formatRange(range, i18n.language)}
          onStep={periodUnit(range) ? (steps) => setRange(shiftPeriod(range, steps)) : undefined}
          onOpen={() => setPicking(true)}
          openLabel={t('period.change')}
          previousLabel={t('period.previousPeriod')}
          nextLabel={t('period.nextPeriod')}
        />
      </div>

      <BudgetSummary
        spentMinor={summary.data?.spentMinor ?? 0}
        incomeMinor={summary.data?.incomeMinor ?? 0}
        balanceMinor={summary.data?.balanceMinor ?? 0}
        display={display}
        loading={summary.isPending}
      />

      {/* Directly under the panel, in the same family of surfaces. It answers
          the one question the panel does not name: what was kept. */}
      <div className="p-gutter pb-0">
        <SavedCard
          savedMinor={saved}
          savedLabel={amount(saved)}
          title={t('saved.title')}
          explainer={t('saved.explainer')}
        />
      </div>

      {/* Everything below the panel sits on the grey app background, which is
          what makes the panel read as the one thing worth looking at first. */}
      <div className="flex flex-col gap-gutter p-gutter">
        <Card className="gap-gutter">
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
              className={buttonContainerClass(
                memberId === undefined ? 'primary' : 'secondary',
                'sm',
              )}
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

        {/* The rollup is the way into the expenses now that the dashboard does
            not list them, so every row is a link. The period travels with it,
            so the category page opens on the window the rollup was showing
            rather than resetting to this month. */}
        <CategoryBreakdown
          rows={breakdown}
          display={display}
          loading={categorySpend.isPending}
          hrefFor={(categoryId) =>
            `/categories/${categoryId ?? 'uncategorised'}?from=${range.start}&to=${range.end}`
          }
        />

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
            display={display}
          />
        ) : null}

        <ExpenseDialog
          open={adding}
          onClose={() => setAdding(false)}
          title={t('expenses.addDialogTitle')}
        >
          <ExpenseForm
            // The currency a new expense defaults to is the one this member
            // lives in, not the one the household reports in.
            currency={display.currency}
            timeZone={timeZone}
            today={localDateIn(new Date(), timeZone)}
            categories={options}
            currencies={currencies.data}
            onCreate={handleCreate}
            disabled={!householdId}
          />
        </ExpenseDialog>

        <PeriodPicker
          open={picking}
          onClose={() => setPicking(false)}
          range={range}
          timeZone={timeZone}
          onPick={setRange}
        />
      </div>
    </div>
  );
}
