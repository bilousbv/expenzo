'use client';

import type { NotificationRow } from '@expenzo/data';
import { parseLimitBreach } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { buttonContainerClass, buttonLabelClass, Card } from '@expenzo/ui';

export interface NotificationListProps {
  items: NotificationRow[];
  /** Category id to display name, for the limits a notification names. */
  categoryNames: Record<string, string>;
  /** Minor units to a string in whatever currency this member reads in. */
  format: (minor: number) => string;
  onRead: (id: string) => void;
  onReadAll: () => void;
  loading?: boolean;
}

/**
 * The in-app notification centre.
 *
 * Presentational: the container fetches, this renders. Payloads are read with
 * `parseLimitBreach` rather than trusted — these rows are written by a database
 * trigger and read months later, so one written by an older version is skipped
 * rather than taking the whole inbox down with it.
 */
export function NotificationList({
  items,
  categoryNames,
  format,
  onRead,
  onReadAll,
  loading = false,
}: NotificationListProps) {
  const { t } = useTranslation();

  const readable = items.flatMap((item) => {
    const payload = parseLimitBreach(item.payload);

    return payload ? [{ item, payload }] : [];
  });

  const unread = readable.filter(({ item }) => item.readAt === null).length;

  return (
    <Card className="flex flex-col gap-gutter">
      <div className="flex flex-row items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold text-content">{t('notifications.title')}</h2>

        {unread > 0 ? (
          <span data-testid="notification-unread-count" className="text-xs text-content-muted">
            {t('notifications.unread', { count: unread })}
          </span>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-content-muted">{t('common.loading')}</p> : null}

      {!loading && readable.length === 0 ? (
        <p data-testid="notifications-empty" className="text-sm text-content-muted">
          {t('notifications.empty')}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {readable.map(({ item, payload }) => (
          <li key={item.id}>
            {/* The whole row is the control: opening a notification is what
                marks it read, which is what somebody means by looking at it. */}
            <button
              type="button"
              data-testid="notification-item"
              onClick={() => onRead(item.id)}
              className={`w-full rounded-card border p-gutter text-left ${
                item.readAt === null ? 'border-accent bg-surface' : 'border-surface-muted'
              }`}
            >
              <div className="flex flex-row items-baseline justify-between gap-4">
                <span className="text-sm font-semibold text-content">
                  {t('notifications.limitExceeded.title')}
                </span>
                {item.readAt === null ? (
                  <span className="text-xs text-accent">{t('notifications.unreadLabel')}</span>
                ) : null}
              </div>

              {payload.limits.map((limit) => (
                <p
                  key={limit.limit_id}
                  data-testid="notification-line"
                  className="pt-1 text-sm text-content-muted"
                >
                  {t('notifications.limitExceeded.line', {
                    name:
                      limit.category_id === null
                        ? t('notifications.limitExceeded.overall')
                        : (categoryNames[limit.category_id] ?? t('limits.fallbackCategory')),
                    spent: format(limit.spent_minor),
                    limit: format(limit.amount_minor),
                  })}
                </p>
              ))}
            </button>
          </li>
        ))}
      </ul>

      {/* Absent rather than disabled when there is nothing to mark: a control
          that cannot do anything is worse than no control. */}
      {unread > 0 ? (
        <button
          type="button"
          data-testid="notifications-read-all"
          onClick={onReadAll}
          className={buttonContainerClass('secondary', 'sm')}
        >
          <span className={buttonLabelClass('secondary', 'sm')}>
            {t('notifications.markAllRead')}
          </span>
        </button>
      ) : null}
    </Card>
  );
}
