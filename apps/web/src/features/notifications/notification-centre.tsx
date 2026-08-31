'use client';

import {
  useCategories,
  useCurrentHousehold,
  useDisplayCurrency,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@expenzo/data';
import { formatApprox } from '@expenzo/ui';

import { NotificationList } from './notification-list';

/**
 * The in-app centre, wired up.
 *
 * The list itself is presentational; this is where the household, the category
 * names and the member's own display currency come from. Draining the queue is
 * deliberately not here — it belongs in the header, which is on every screen,
 * so a notification does not require visiting this page to exist.
 */
export function NotificationCentre() {
  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  const display = useDisplayCurrency();

  const categories = useCategories(householdId);
  const inbox = useNotifications(householdId);
  const read = useMarkNotificationRead(householdId);
  const readAll = useMarkAllNotificationsRead(householdId);

  const categoryNames = Object.fromEntries(
    (categories.data ?? []).map((category) => [category.id, category.name]),
  );

  return (
    <NotificationList
      items={inbox.data ?? []}
      categoryNames={categoryNames}
      // Figures were frozen in the household's currency at write time and are
      // converted on the way to the screen, so a converted one is marked.
      format={(minor) =>
        formatApprox(display.convert(minor), display.currency, display.approximate)
      }
      onRead={(id) => read.mutate(id)}
      onReadAll={() => readAll.mutate()}
      loading={inbox.isPending}
    />
  );
}
