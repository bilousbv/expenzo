import { useTranslation } from '@expenzo/i18n';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t('expenses.title') }} />
      <Tabs.Screen name="subscriptions" options={{ title: t('nav.subscriptions') }} />
      <Tabs.Screen name="settings" options={{ title: t('nav.settings') }} />
    </Tabs>
  );
}
