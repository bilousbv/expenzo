'use client';

import { limitProgress } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import type { DisplayCurrency } from '@expenzo/data';
import { Card, categoryDotClass, categoryDotStyle, formatApprox } from '@expenzo/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

export interface CategoryBreakdownRow {
  categoryId: string | null;
  name: string;
  color: string | null;
  spentMinor: number;
  limitMinor: number | null;
}

export interface CategoryBreakdownProps {
  rows: CategoryBreakdownRow[];
  display: DisplayCurrency;
  /**
   * Where a row leads. Absent means the rows are not links: the household-wide
   * limit is rendered through this component too, and it is not a category with
   * expenses behind it.
   */
  hrefFor?: (categoryId: string | null) => string;
  loading?: boolean;
}

const ROW_LAYOUT = 'flex flex-row items-center justify-between';

/** One row's contents, as a link when it has somewhere to go. */
function Row({ href, children }: { href?: string; children: ReactNode }) {
  return href ? (
    <Link href={href} className={`${ROW_LAYOUT} rounded-tile hover:bg-surface-muted`}>
      {children}
    </Link>
  ) : (
    <div className={ROW_LAYOUT}>{children}</div>
  );
}

export function CategoryBreakdown({
  rows,
  display,
  hrefFor,
  loading = false,
}: CategoryBreakdownProps) {
  const { t } = useTranslation();

  return (
    <Card className="gap-gutter">
      <h2 className="text-lg font-semibold text-content">{t('dashboard.byCategory')}</h2>

      {loading ? (
        <p className="text-sm text-content-muted">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p data-testid="no-category-spend" className="text-sm text-content-muted">
          {t('dashboard.nothingSpent')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const progress = limitProgress(row.spentMinor, row.limitMinor);

            return (
              <li key={row.categoryId ?? 'uncategorised'} data-testid="category-row">
                {/* The whole row is the target, not just the name: it is the
                    only way into a category's expenses now that the dashboard
                    does not list them. Rendered plain when there is nowhere to
                    go — the household-wide limit comes through here too, and it
                    is not a category. */}
                <Row href={hrefFor?.(row.categoryId)}>
                  <span className="flex flex-row items-center gap-2 text-content">
                    <span
                      aria-hidden
                      className={categoryDotClass()}
                      style={categoryDotStyle(row.color)}
                    />
                    {row.name}
                  </span>

                  <span
                    data-testid="category-amount"
                    className={progress.exceeded ? 'text-negative' : 'text-content'}
                  >
                    {formatApprox(
                      display.convert(row.spentMinor),
                      display.currency,
                      display.approximate,
                    )}
                    {progress.limitMinor !== null
                      ? ` / ${formatApprox(display.convert(progress.limitMinor), display.currency, display.approximate)}`
                      : ''}
                  </span>
                </Row>

                {/* Only categories with a limit get a bar. A bar with no limit
                    behind it would be measuring against nothing. */}
                {progress.ratio !== null ? (
                  <div
                    role="progressbar"
                    aria-label={row.name}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress.ratio * 100)}
                    className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
                  >
                    <div
                      // Capped at 100% so an overspend does not paint outside
                      // the track; the figures above already say by how much.
                      style={{ width: `${Math.min(progress.ratio, 1) * 100}%` }}
                      className={`h-full ${progress.exceeded ? 'bg-negative' : 'bg-brand'}`}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
