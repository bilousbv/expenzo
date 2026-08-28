'use client';

import { useTranslation } from '@expenzo/i18n';
import type { DisplayCurrency } from '@expenzo/data';
import { formatApprox, GradientSurface } from '@expenzo/ui';
import type { ReactNode } from 'react';

export interface BudgetSummaryProps {
  spentMinor: number;
  incomeMinor: number;
  balanceMinor: number;
  /**
   * What this member reads in. Figures arrive in the household currency and
   * are converted on the way to the screen, which is why a converted one is
   * marked rather than silently relabelled.
   */
  display: DisplayCurrency;
  loading?: boolean;
  /** Rendered inside the panel, above the figure — the app name and its links. */
  header?: ReactNode;
}

/**
 * The balance panel.
 *
 * The one place in the app that is not a white card on grey: a single figure
 * on a deep gradient, with everything else on the screen subordinate to it.
 * The point is that the answer to "how are we doing" should be legible from
 * arm's length, which a figure set in the same size as its neighbours is not.
 */
export function BudgetSummary({
  spentMinor,
  incomeMinor,
  balanceMinor,
  display,
  loading = false,
  header,
}: BudgetSummaryProps) {
  const { t } = useTranslation();

  return (
    <GradientSurface className="rounded-b-card px-gutter pb-gutter pt-6">
      {header}

      <div className="flex flex-col items-center gap-2 py-10">
        <span className="text-sm text-content-inverse/70">{t('dashboard.leftThisPeriod')}</span>

        <p
          data-testid="budget-balance"
          // Not coloured red when negative any more: the figure sits on a dark
          // panel where red reads as an error rather than as a number, and the
          // minus sign already says it.
          className="text-5xl font-bold text-content-inverse"
        >
          {formatApprox(display.convert(balanceMinor), display.currency, display.approximate)}
        </p>

        {loading ? (
          <span className="text-sm text-content-inverse/70">{t('common.loading')}</span>
        ) : null}
      </div>

      {/* The two halves of the budget, split the way the reference splits
          spending spaces from the total. */}
      <div className="flex flex-row rounded-card bg-black/15 px-gutter py-4">
        <div className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs text-content-inverse/70">{t('dashboard.income')}</span>
          <span data-testid="budget-income" className="text-lg font-semibold text-content-inverse">
            {formatApprox(display.convert(incomeMinor), display.currency, display.approximate)}
          </span>
        </div>

        <div className="w-px bg-content-inverse/20" />

        <div className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs text-content-inverse/70">{t('dashboard.spent')}</span>
          <span data-testid="budget-spent" className="text-lg font-semibold text-content-inverse">
            {formatApprox(display.convert(spentMinor), display.currency, display.approximate)}
          </span>
        </div>
      </div>

      {/* These come from an aggregate query rather than the loaded page, which
          is what lets them be called the period's figures at all. */}
      <p className="pt-3 text-center text-xs text-content-inverse/60">
        {t('dashboard.wholePeriodNote')}
      </p>
    </GradientSurface>
  );
}
