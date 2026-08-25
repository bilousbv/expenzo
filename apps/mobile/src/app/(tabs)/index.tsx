import { Button } from '@expenzo/ui';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseListView } from '../../features/expenses/expense-list';

export default function ExpensesTab() {
  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <ScrollView contentContainerClassName="gap-gutter p-gutter">
        <View className="flex-row items-center justify-between">
          <Text className="text-3xl font-bold text-content">Expenzo</Text>
          {/* A separate screen rather than a form on this one: M6 deep-links
              straight to it from a wallet payment, so it has to stand alone. */}
          <Button testID="new-expense" size="sm" onPress={() => router.push('/expense/new')}>
            Add
          </Button>
        </View>

        <ExpenseListView />
      </ScrollView>
    </SafeAreaView>
  );
}
