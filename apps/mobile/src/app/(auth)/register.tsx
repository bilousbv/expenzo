import { Card } from '@expenzo/ui';
import { Link } from 'expo-router';

import { FormScreen } from '../../features/layout/form-screen';
import { useTranslation } from '@expenzo/i18n';
import { Text, View } from 'react-native';

import { AuthPanel } from '../../features/auth/auth-panel';

export default function RegisterScreen() {
  const { t } = useTranslation();
  return (
    <FormScreen>
      <Card className="gap-gutter">
        <Text className="text-2xl font-bold text-content">Create your account</Text>
        <Text className="text-sm text-content-muted">{t('auth.createAccountExplainer')}</Text>

        <AuthPanel mode="signUp" />

        <View className="flex-row justify-center gap-1">
          <Text className="text-sm text-content-muted">Already have an account?</Text>
          <Link href="/sign-in" testID="go-to-sign-in" className="text-sm text-link">
            Sign in
          </Link>
        </View>
      </Card>
    </FormScreen>
  );
}
