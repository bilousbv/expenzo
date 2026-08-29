import { Card } from '@expenzo/ui';
import { useTranslation } from '@expenzo/i18n';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import { MagicLinkPanel } from '../../features/auth/magic-link-panel';
import { FormScreen } from '../../features/layout/form-screen';

export default function MagicLinkScreen() {
  const { t } = useTranslation();

  return (
    <FormScreen>
      <Card className="gap-gutter">
        <Text className="text-2xl font-bold text-content">{t('auth.magicLinkTitle')}</Text>

        <MagicLinkPanel />

        <View className="flex-row justify-center">
          <Link href="/sign-in" testID="back-to-sign-in" className="text-sm text-link">
            {t('auth.backToSignIn')}
          </Link>
        </View>
      </Card>
    </FormScreen>
  );
}
