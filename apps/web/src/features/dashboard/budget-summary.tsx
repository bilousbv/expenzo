'use client';

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
  return (
    <Card className="gap-gutter">
      <div className="flex flex-row items-baseline justify-between">
        <span className="text-sm text-content-muted">Left this period</span>
        {loading ? <span className="text-sm text-content-muted">Loading…</span> : null}
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
          <span className="text-xs text-content-muted">Income</span>
          <span data-testid="budget-income" className="text-lg text-content">
            {formatCurrency(incomeMinor, currency)}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-content-muted">Spent</span>
          <span data-testid="budget-spent" className="text-lg text-content">
            {formatCurrency(spentMinor, currency)}
          </span>
        </div>
      </div>

      {/* These come from an aggregate query rather than the loaded page, which
          is what lets them be called the period's figures at all. */}
      <p className="text-xs text-content-muted">
        Everything in the period, not just what is listed
      </p>
    </Card>
  );
}
