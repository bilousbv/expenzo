import { useTranslation } from '@expenzo/i18n';
import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('nav.notFound') }} />
      <View className="flex-1 items-center justify-center p-gutter">
        <Text className="text-xl font-semibold text-content">This screen does not exist.</Text>
        <Link href="/" className="mt-4 text-link">
          {t('nav.goToExpenseList')}
        </Link>
      </View>
    </>
  );
}
