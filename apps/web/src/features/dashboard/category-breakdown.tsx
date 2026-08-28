'use client';

import { limitProgress } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import type { DisplayCurrency } from '@expenzo/data';
import { Card, categoryDotClass, categoryDotStyle, formatApprox } from '@expenzo/ui';

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
  loading?: boolean;
}

export function CategoryBreakdown({ rows, display, loading = false }: CategoryBreakdownProps) {
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
                <div className="flex flex-row items-center justify-between">
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
                    className={progress.exceeded ? 'text-red-600' : 'text-content'}
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
                </div>

                {/* Only categories with a limit get a bar. A bar with no limit
                    behind it would be measuring against nothing. */}
                {progress.ratio !== null ? (
                  <div
                    role="progressbar"
                    aria-label={row.name}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress.ratio * 100)}
                    className="mt-1 h-2 w-full overflow-hidden rounded-full bg-brand-100"
                  >
                    <div
                      // Capped at 100% so an overspend does not paint outside
                      // the track; the figures above already say by how much.
                      style={{ width: `${Math.min(progress.ratio, 1) * 100}%` }}
                      className={`h-full ${progress.exceeded ? 'bg-red-600' : 'bg-brand-600'}`}
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
