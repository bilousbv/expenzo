import { useCurrentHousehold } from '@expenzo/data';
import { useTranslation } from '@expenzo/i18n';
import { Button } from '@expenzo/ui';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SubscriptionListView } from '../../features/subscriptions/subscription-list';

export default function SubscriptionsTab() {
  const { t } = useTranslation();
  const household = useCurrentHousehold();

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <ScrollView contentContainerClassName="gap-gutter p-gutter">
        {/* The form used to sit above the list on this screen. Adding a
            subscription happens a handful of times a year; reading what the
            household already pays for is what the tab is for the rest of the
            time, so the form moved onto a modal route of its own. */}
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-content">{t('subscriptions.title')}</Text>
          <Button
            testID="new-subscription"
            size="sm"
            disabled={!household.data?.id}
            onPress={() => router.push('/subscription/new')}
          >
            {t('subscriptions.add')}
          </Button>
        </View>

        <View>
          <SubscriptionListView />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
