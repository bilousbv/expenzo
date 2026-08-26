import { Card } from '@expenzo/ui';
import { Link } from 'expo-router';
import { useTranslation } from '@expenzo/i18n';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthPanel } from '../../features/auth/auth-panel';

export default function RegisterScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <ScrollView contentContainerClassName="flex-grow justify-center p-gutter">
        <Card className="gap-gutter">
          <Text className="text-2xl font-bold text-content">Create your account</Text>
          <Text className="text-sm text-content-muted">{t('auth.createAccountExplainer')}</Text>

          <AuthPanel mode="signUp" />

          <View className="flex-row justify-center gap-1">
            <Text className="text-sm text-content-muted">Already have an account?</Text>
            <Link href="/sign-in" testID="go-to-sign-in" className="text-sm text-brand-600">
              Sign in
            </Link>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
