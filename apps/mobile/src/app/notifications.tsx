import {
  useCategories,
  useCurrentHousehold,
  useDisplayCurrency,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPreferences,
  useNotifications,
  useSetNotificationPreference,
} from '@expenzo/data';
import { SETTABLE_KINDS } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Card, formatApprox } from '@expenzo/ui';
import { ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../features/auth/use-session';
import { NotificationList } from '../features/notifications/notification-list';

/**
 * The in-app centre and its preferences, on one screen.
 *
 * One screen rather than two, because the phone has no persistent header to
 * hang a settings link on and the preference is a single switch. Draining the
 * queue is not done here — it happens on the dashboard, so a notification does
 * not require visiting the screen that lists notifications in order to exist.
 */
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  const display = useDisplayCurrency();

  const categories = useCategories(householdId);
  const inbox = useNotifications(householdId);
  const read = useMarkNotificationRead(householdId);
  const readAll = useMarkAllNotificationsRead(householdId);

  const preferences = useNotificationPreferences(userId);
  const setPreference = useSetNotificationPreference(userId);

  const categoryNames = Object.fromEntries(
    (categories.data ?? []).map((category) => [category.id, category.name]),
  );

  // While a change is in flight the switch shows the value being sent: a
  // control that waits for a round trip before moving reads as broken.
  const inFlight = setPreference.isPending ? setPreference.variables : undefined;

  // An absent row means everything is on, so nothing is created when somebody
  // joins and a kind added later needs no backfill.
  const enabled = (kind: string) => {
    if (inFlight?.kind === kind && inFlight.inApp !== undefined) return inFlight.inApp;

    return preferences.data?.find((row) => row.kind === kind)?.in_app_enabled ?? true;
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <ScrollView contentContainerClassName="gap-gutter p-gutter">
        <NotificationList
          items={inbox.data ?? []}
          categoryNames={categoryNames}
          format={(minor) =>
            formatApprox(display.convert(minor), display.currency, display.approximate)
          }
          onRead={(id) => read.mutate(id)}
          onReadAll={() => readAll.mutate()}
          loading={inbox.isPending}
        />

        <Card className="gap-gutter">
          <Text className="text-lg font-semibold text-content">
            {t('notifications.preferences.title')}
          </Text>
          <Text className="text-sm text-content-muted">
            {t('notifications.preferences.explainer')}
          </Text>

          {SETTABLE_KINDS.map((kind) => (
            <View key={kind} className="flex-row items-center justify-between gap-gutter">
              <Text className="flex-1 text-sm text-content">
                {t(`notifications.preferences.${kind}`)}
              </Text>
              <Switch
                testID={`preference-${kind}`}
                value={enabled(kind)}
                onValueChange={(next) => setPreference.mutate({ kind, inApp: next })}
              />
            </View>
          ))}

          <Text className="text-xs text-content-muted">
            {t('notifications.preferences.pushSoon')}
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
