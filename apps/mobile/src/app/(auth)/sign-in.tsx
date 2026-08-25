import { Card } from '@expenzo/ui';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInForm } from '../../features/auth/sign-in-form';
import { supabase } from '../../lib/supabase';

// Closes any lingering auth browser session left over from a previous attempt.
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  async function sendMagicLink(email: string) {
    // Resolves to expenzo://auth/callback, which app.json's scheme registers
    // and supabase/config.toml allows as a redirect target.
    const redirectTo = Linking.createURL('/auth/callback');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) throw new Error(error.message);
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <View className="flex-1 justify-center p-gutter">
        <Card className="gap-gutter">
          <Text className="text-2xl font-bold text-content">Sign in to Expenzo</Text>
          <Text className="text-sm text-content-muted">
            We will email you a link. No password to remember.
          </Text>

          <SignInForm onSubmit={sendMagicLink} />
        </Card>
      </View>
    </SafeAreaView>
  );
}
