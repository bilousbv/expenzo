'use client';

import { daysUntil, type IsoDate } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Card, formatCurrency } from '@expenzo/ui';
import Link from 'next/link';

export interface RenewalRow {
  id: string;
  name: string;
  amountMinor: number;
  currency: string;
  renewalOn: IsoDate;
  /*
   * Whether this date is the end of a free trial. The trial end and the first
   * charge are the same day by design, so this is one row rather than two —
   * what changes is what it is called, and "trial ends" is the day cancelling
   * is still free.
   */
  trial?: boolean;
}

export interface UpcomingRenewalsProps {
  rows: RenewalRow[];
  /** The household's own today, so "Today" means today where the household is. */
  today: IsoDate;
  loading?: boolean;
}

/**
 * What the household is about to be charged.
 *
 * The only place in the app that shows a charge before it is taken, which is
 * what makes it worth space above the fold: everything else in the ledger is
 * already spent.
 */
export function UpcomingRenewals({ rows, today, loading = false }: UpcomingRenewalsProps) {
  const { t } = useTranslation();

  /*
   * How far off, not just the date: a date on its own makes the reader do the
   * arithmetic, and "Today" is the case the card exists for — the charge there
   * is still time to stop.
   */
  function when(renewalOn: IsoDate, trial = false): string {
    const days = daysUntil(today, renewalOn);

    const howFar =
      days <= 0
        ? t('common.today')
        : days === 1
          ? t('renewals.tomorrow')
          : t('renewals.inDays', { count: days });

    return trial ? t('renewals.trialEnds', { when: howFar.toLowerCase() }) : howFar;
  }

  return (
    <Card className="gap-gutter" testID="renewals-card">
      <div className="flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold text-content">{t('renewals.title')}</h2>
          <p className="text-xs text-content-muted">{t('renewals.explainer')}</p>
        </div>

        <Link href="/subscriptions" data-testid="renewals-all" className="text-sm text-link">
          {t('renewals.all')}
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-content-muted">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p data-testid="no-renewals" className="text-sm text-content-muted">
          {t('renewals.none')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              data-testid="renewal-row"
              className="flex flex-row items-center justify-between gap-2"
            >
              <div className="flex flex-col">
                <span data-testid="renewal-name" className="text-content">
                  {row.name}
                </span>
                <span data-testid="renewal-when" className="text-xs text-content-muted">
                  {when(row.renewalOn, row.trial)}
                </span>
              </div>

              {/* In the currency it bills in, never the reader's: a
                  subscription is a fixed charge from a merchant, and a
                  converted figure moves day to day and never matches the
                  bank statement. */}
              <span data-testid="renewal-amount" className="text-content">
                {formatCurrency(row.amountMinor, row.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
