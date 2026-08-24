import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Household management arrives in M1.6, notification preferences in M1.14. */
export default function SettingsTab() {
  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <View className="flex-1 justify-center p-gutter">
        <Text className="text-2xl font-bold text-content">Settings</Text>
        <Text className="mt-2 text-content-muted">Nothing here yet.</Text>
      </View>
    </SafeAreaView>
  );
}
