import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button, Card, formatCurrency } from '@expenzo/ui';

import './global.css';

export default function App() {
  const [totalCents, setTotalCents] = useState(0);

  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-surface-muted">
        <View className="flex-1 justify-center gap-gutter p-gutter">
          <Text className="text-3xl font-bold text-content">Expenzo</Text>

          <Card className="gap-gutter">
            <Text className="text-sm text-content-muted">Total spent</Text>
            <Text className="text-4xl font-semibold text-content">
              {formatCurrency(totalCents)}
            </Text>
          </Card>

          <View className="flex-row gap-3">
            <Button onPress={() => setTotalCents((cents) => cents + 1250)}>Add $12.50</Button>
            <Button variant="secondary" onPress={() => setTotalCents(0)}>
              Reset
            </Button>
          </View>
        </View>
        <StatusBar style="auto" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
