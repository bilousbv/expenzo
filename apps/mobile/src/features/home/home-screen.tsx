import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, formatCurrency } from '@expenzo/ui';

/**
 * Placeholder home screen, carried over from the pre-router entry point.
 * Replaced by the real expense list in M1.10.
 */
export function HomeScreen() {
  const [totalCents, setTotalCents] = useState(0);

  return (
    <View className="flex-1 justify-center gap-gutter p-gutter">
      <Text className="text-3xl font-bold text-content">Expenzo</Text>

      <Card className="gap-gutter">
        <Text className="text-sm text-content-muted">Total spent</Text>
        <Text testID="total-spent" className="text-4xl font-semibold text-content">
          {formatCurrency(totalCents)}
        </Text>
      </Card>

      <View className="flex-row gap-3">
        <Button testID="add-expense" onPress={() => setTotalCents((cents) => cents + 1250)}>
          Add $12.50
        </Button>
        <Button testID="reset-total" variant="secondary" onPress={() => setTotalCents(0)}>
          Reset
        </Button>
      </View>
    </View>
  );
}
