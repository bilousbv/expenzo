'use client';

import { useTranslation } from '@expenzo/i18n';
import { Card, formatCurrency } from '@expenzo/ui';

export interface BudgetSummaryProps {
  spentMinor: number;
  incomeMinor: number;
  balanceMinor: number;
  currency: string;
  loading?: boolean;
}

export function BudgetSummary({
  spentMinor,
  incomeMinor,
  balanceMinor,
  currency,
  loading = false,
}: BudgetSummaryProps) {
  const { t } = useTranslation();

  return (
    <Card className="gap-gutter">
      <div className="flex flex-row items-baseline justify-between">
        <span className="text-sm text-content-muted">{t('dashboard.leftThisPeriod')}</span>
        {loading ? <span className="text-sm text-content-muted">{t('common.loading')}</span> : null}
      </div>

      <p
        data-testid="budget-balance"
        // Negative is the state worth noticing, and it is the only one coloured.
        className={`text-4xl font-semibold ${balanceMinor < 0 ? 'text-red-600' : 'text-content'}`}
      >
        {formatCurrency(balanceMinor, currency)}
      </p>

      <div className="flex flex-row gap-gutter">
        <div className="flex flex-col">
          <span className="text-xs text-content-muted">{t('dashboard.income')}</span>
          <span data-testid="budget-income" className="text-lg text-content">
            {formatCurrency(incomeMinor, currency)}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-content-muted">{t('dashboard.spent')}</span>
          <span data-testid="budget-spent" className="text-lg text-content">
            {formatCurrency(spentMinor, currency)}
          </span>
        </div>
      </div>

      {/* These come from an aggregate query rather than the loaded page, which
          is what lets them be called the period's figures at all. */}
      <p className="text-xs text-content-muted">{t('dashboard.wholePeriodNote')}</p>
    </Card>
  );
}
