import {
  useCategories,
  useCreateSubscription,
  useCurrentHousehold,
  useServices,
  useSupportedCurrencies,
} from '@expenzo/data';
import { localDateIn, type CreateSubscriptionInput } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Card, type CategoryOption } from '@expenzo/ui';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../../features/auth/use-session';
import { SubscriptionForm } from '../../features/subscriptions/subscription-form';
import { SubscriptionListView } from '../../features/subscriptions/subscription-list';

export default function SubscriptionsTab() {
  const { t } = useTranslation();
  const { session } = useSession();

  const household = useCurrentHousehold();
  const householdId = household.data?.id;
  const currency = household.data?.base_currency ?? 'USD';
  const timeZone = household.data?.timezone ?? 'UTC';

  const categories = useCategories(householdId);
  const services = useServices();
  const currencies = useSupportedCurrencies(household.data?.base_currency);
  const create = useCreateSubscription(householdId, session?.user.id);

  const options: CategoryOption[] = (categories.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
  }));

  async function handleCreate(input: CreateSubscriptionInput) {
    await create.mutateAsync(input);
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <ScrollView contentContainerClassName="gap-gutter p-gutter">
        <Text className="text-2xl font-bold text-content">{t('subscriptions.title')}</Text>

        <Card className="gap-gutter">
          <Text className="text-lg font-semibold text-content">{t('subscriptions.heading')}</Text>

          <SubscriptionForm
            currency={currency}
            currencies={currencies.data}
            services={services.data ?? []}
            categories={options}
            // Resolved in the household's timezone, like an expense date.
            today={localDateIn(new Date(), timeZone)}
            onCreate={handleCreate}
            disabled={!householdId}
          />
        </Card>

        <View>
          <SubscriptionListView />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
