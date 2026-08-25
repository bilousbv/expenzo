import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Dashboard } from '../../features/dashboard/dashboard';

export default function DashboardTab() {
  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <ScrollView contentContainerClassName="gap-gutter p-gutter">
        <View>
          <Text className="text-3xl font-bold text-content">Expenzo</Text>
        </View>

        <Dashboard />
      </ScrollView>
    </SafeAreaView>
  );
}
