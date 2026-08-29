import { useTranslation } from '@expenzo/i18n';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dashboard } from '../../features/dashboard/dashboard';

export default function DashboardTab() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    /**
     * `edges` deliberately omits the top: the balance panel is full-bleed and
     * has to run under the status bar, so the inset is applied as padding
     * inside the gradient instead. A SafeAreaView that handled it here would
     * leave a grey stripe above the panel.
     */
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-surface-muted">
      <ScrollView>
        <View style={{ paddingTop: insets.top }} className="bg-brand">
          <Text className="px-gutter pt-2 text-2xl font-bold text-content-inverse">
            {t('common.appName')}
          </Text>
        </View>

        <Dashboard />
      </ScrollView>
    </SafeAreaView>
  );
}
