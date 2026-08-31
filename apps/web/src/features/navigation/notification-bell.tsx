'use client';

import { useCurrentHousehold, useDeliverNotifications, useNotifications } from '@expenzo/data';
import { useTranslation } from '@expenzo/i18n';
import Link from 'next/link';

/**
 * The alerts link, with what is waiting on it.
 *
 * Draining the queue happens here rather than on the notifications page,
 * because the header is on every signed-in screen: a notification that only
 * came into existence once you visited the page that lists notifications would
 * be no use at all.
 */
export function NotificationBell() {
  const { t } = useTranslation();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;

  useDeliverNotifications(householdId);
  const inbox = useNotifications(householdId);

  const unread = (inbox.data ?? []).filter((item) => item.readAt === null).length;

  return (
    <Link
      href="/notifications"
      data-testid="go-to-notifications"
      className="flex flex-row items-baseline gap-1 text-sm text-content-muted"
    >
      {t('nav.notifications')}
      {unread > 0 ? (
        <span
          data-testid="notification-badge"
          // The count itself rather than a dot: "3" answers the question a dot
          // only raises, and it costs the same space.
          className="rounded-pill bg-accent px-2 text-xs font-semibold text-content"
        >
          {unread}
        </span>
      ) : null}
    </Link>
  );
}
