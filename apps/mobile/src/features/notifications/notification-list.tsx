import type { NotificationRow } from '@expenzo/data';
import { parseLimitBreach } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Button, Card } from '@expenzo/ui';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

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
 * The in-app notification centre, on the phone.
 *
 * The native half of the web component of the same name, and it must keep
 * saying the same things: same test ids, same copy, same decision about what an
 * unreadable payload does. Payloads are parsed rather than trusted, so one
 * written by an older version is skipped instead of taking the inbox down.
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
    <Card className="gap-gutter">
      <View className="flex-row items-baseline justify-between gap-4">
        <Text className="text-lg font-semibold text-content">{t('notifications.title')}</Text>

        {unread > 0 ? (
          <Text testID="notification-unread-count" className="text-xs text-content-muted">
            {t('notifications.unread', { count: unread })}
          </Text>
        ) : null}
      </View>

      {loading ? <ActivityIndicator /> : null}

      {!loading && readable.length === 0 ? (
        <Text testID="notifications-empty" className="text-sm text-content-muted">
          {t('notifications.empty')}
        </Text>
      ) : null}

      {readable.map(({ item, payload }) => (
        // The whole row is the control: opening a notification is what marks it
        // read, which is what somebody means by having looked at it.
        <Pressable
          key={item.id}
          testID="notification-item"
          onPress={() => onRead(item.id)}
          className={`rounded-card border p-gutter ${
            item.readAt === null ? 'border-accent' : 'border-surface-muted'
          }`}
        >
          <View className="flex-row items-baseline justify-between gap-4">
            <Text className="text-sm font-semibold text-content">
              {t('notifications.limitExceeded.title')}
            </Text>
            {item.readAt === null ? (
              <Text className="text-xs text-accent">{t('notifications.unreadLabel')}</Text>
            ) : null}
          </View>

          {payload.limits.map((limit) => (
            <Text
              key={limit.limit_id}
              testID="notification-line"
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
            </Text>
          ))}
        </Pressable>
      ))}

      {/* Absent rather than disabled when there is nothing to mark: a control
          that cannot do anything is worse than no control. */}
      {unread > 0 ? (
        <Button testID="notifications-read-all" variant="secondary" onPress={onReadAll}>
          {t('notifications.markAllRead')}
        </Button>
      ) : null}
    </Card>
  );
}
