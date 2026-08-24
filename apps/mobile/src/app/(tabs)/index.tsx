import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeScreen } from '../../features/home/home-screen';

export default function ExpensesTab() {
  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <HomeScreen />
    </SafeAreaView>
  );
}
