import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Filled in by M1.12. */
export default function SubscriptionsTab() {
  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <View className="flex-1 justify-center p-gutter">
        <Text className="text-2xl font-bold text-content">Subscriptions</Text>
        <Text className="mt-2 text-content-muted">Nothing here yet.</Text>
      </View>
    </SafeAreaView>
  );
}
