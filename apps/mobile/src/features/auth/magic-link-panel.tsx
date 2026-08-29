import { useTranslation } from '@expenzo/i18n';
import * as Linking from 'expo-linking';
import { Text, View } from 'react-native';

import { supabase } from '../../lib/supabase';

import { SignInForm } from './sign-in-form';

/**
 * The magic link on a screen of its own.
 *
 * It used to unfold inside the sign-in card, which put two email fields in one
 * form. Asking for a link is a different way in rather than a variation on
 * typing a password, so it gets its own route.
 */
export function MagicLinkPanel() {
  const { t } = useTranslation();

  // Resolves to expenzo://auth/callback, which app.json's scheme registers and
  // supabase/config.toml allows as a redirect target.
  const redirectTo = Linking.createURL('/auth/callback');

  async function sendMagicLink(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) throw new Error(error.message);
  }

  return (
    <View className="gap-gutter">
      <Text className="text-sm text-content-muted">{t('auth.magicLinkExplainer')}</Text>

      <SignInForm onSubmit={sendMagicLink} />
    </View>
  );
}
