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
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

export function SubscriptionListView() {
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
        <ActivityIndicator />
      ) : rows.length === 0 ? (
        <Text testID="no-subscriptions" className="text-sm text-content-muted">
          {t('subscriptions.none')}
        </Text>
      ) : (
        rows.map((row) => {
          const category = row.category_id ? categoryById.get(row.category_id) : undefined;
          const cancelled = row.status === 'cancelled';

          return (
            <View
              key={row.id}
              testID="subscription-row"
              className="flex-row items-center justify-between border-b border-brand-100 pb-2"
            >
              <View className="flex-1">
                {/* Struck through rather than hidden: a household that stopped
                    paying for something still wants to see that it once did. */}
                <Text className={cancelled ? 'text-content-muted line-through' : 'text-content'}>
                  {row.name}
                </Text>
                <View className="flex-row items-center gap-2">
                  {category ? (
                    <View className={categoryDotClass()} style={categoryDotStyle(category.color)} />
                  ) : null}
                  <Text testID="subscription-next" className="text-xs text-content-muted">
                    {t(`cadence.${row.cadence}`)} ·{' '}
                    {cancelled
                      ? t('subscriptions.cancelled')
                      : t('subscriptions.nextCharge', { date: row.next_renewal_on })}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-3">
                <Text testID="subscription-amount" className="text-content">
                  {formatCurrency(row.amount_minor, row.currency)}
                </Text>

                <Pressable
                  testID="subscription-toggle"
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    cancelled ? 'subscriptions.reactivateLabel' : 'subscriptions.cancelLabel',
                    { name: row.name },
                  )}
                  disabled={cancel.isPending || reactivate.isPending}
                  onPress={() =>
                    cancelled
                      ? reactivate.mutate({ id: row.id, status: 'active' })
                      : cancel.mutate(row.id)
                  }
                >
                  <Text className="text-brand-600">{cancelled ? '↻' : '⏸'}</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('subscriptions.deleteLabel', { name: row.name })}
                  disabled={remove.isPending}
                  onPress={() => remove.mutate(row.id)}
                >
                  <Text className="text-content-muted">×</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </Card>
  );
}
