'use client';

import {
  useCancelSubscription,
  useCategories,
  useCurrentHousehold,
  useDeleteSubscription,
  useSubscriptions,
  useUpdateSubscription,
} from '@expenzo/data';
import { useTranslation } from '@expenzo/i18n';
import { Card, categoryDotClass, categoryDotStyle, formatCurrency } from '@expenzo/ui';

export function SubscriptionList() {
  const { t } = useTranslation();

  const household = useCurrentHousehold();
  const householdId = household.data?.id;

  const categories = useCategories(householdId);
  const subscriptions = useSubscriptions(householdId);
  const cancel = useCancelSubscription(householdId);
  const reactivate = useUpdateSubscription(householdId);
  const remove = useDeleteSubscription(householdId);

  const categoryById = new Map((categories.data ?? []).map((category) => [category.id, category]));
  const rows = subscriptions.data ?? [];

  return (
    <Card className="gap-gutter">
      {subscriptions.isPending ? (
        <p className="text-sm text-content-muted">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p data-testid="no-subscriptions" className="text-sm text-content-muted">
          {t('subscriptions.none')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const category = row.category_id ? categoryById.get(row.category_id) : undefined;
            const cancelled = row.status === 'cancelled';

            return (
              <li
                key={row.id}
                data-testid="subscription-row"
                className="flex flex-row items-center justify-between border-b border-border pb-2"
              >
                <div className="flex flex-col">
                  {/* Struck through rather than hidden: it is history, and a
                      household that stopped paying for something still wants to
                      see that it once did. */}
                  <span className={cancelled ? 'text-content-muted line-through' : 'text-content'}>
                    {row.name}
                  </span>
                  <span className="flex flex-row items-center gap-2 text-xs text-content-muted">
                    {category ? (
                      <>
                        <span
                          aria-hidden
                          className={categoryDotClass()}
                          style={categoryDotStyle(category.color)}
                        />
                        {category.name}
                      </>
                    ) : (
                      t('common.uncategorised')
                    )}
                    <span>{t(`cadence.${row.cadence}`)}</span>
                    <span data-testid="subscription-next">
                      {cancelled
                        ? t('subscriptions.cancelled')
                        : /* While the trial runs the next charge *is* its end,
                             so the date is the same and only the wording
                             differs — it is the day cancelling stops being
                             free. */
                          t(
                            row.trial_ends_on === row.next_renewal_on
                              ? 'subscriptions.trialEnds'
                              : 'subscriptions.nextCharge',
                            { date: row.next_renewal_on },
                          )}
                    </span>
                  </span>
                </div>

                <div className="flex flex-row items-center gap-3">
                  <span data-testid="subscription-amount" className="text-content">
                    {formatCurrency(row.amount_minor, row.currency)}
                  </span>

                  <button
                    type="button"
                    data-testid="subscription-toggle"
                    aria-label={t(
                      cancelled ? 'subscriptions.reactivateLabel' : 'subscriptions.cancelLabel',
                      { name: row.name },
                    )}
                    disabled={cancel.isPending || reactivate.isPending}
                    onClick={() =>
                      cancelled
                        ? reactivate.mutate({ id: row.id, status: 'active' })
                        : cancel.mutate(row.id)
                    }
                    className="text-sm text-link"
                  >
                    {cancelled ? '↻' : '⏸'}
                  </button>

                  <button
                    type="button"
                    aria-label={t('subscriptions.deleteLabel', { name: row.name })}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(row.id)}
                    className="text-sm text-content-muted"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
