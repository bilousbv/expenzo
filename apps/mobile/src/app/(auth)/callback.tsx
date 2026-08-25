import { Card } from '@expenzo/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';

/**
 * Where the magic-link deep link lands.
 *
 * The mobile client is configured with detectSessionInUrl: false — there is no
 * URL bar for it to watch — so the code is exchanged explicitly here.
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function exchange() {
      if (params.error_description) {
        if (active) setError(params.error_description);
        return;
      }

      if (!params.code) {
        if (active) setError('That sign-in link is missing its code.');
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);

      if (!active) return;

      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }

      // The session listener in SessionProvider swaps the route group over;
      // replace rather than push so the callback cannot be navigated back to.
      router.replace('/');
    }

    void exchange();

    return () => {
      active = false;
    };
  }, [params.code, params.error_description]);

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <View className="flex-1 justify-center p-gutter">
        {error ? (
          <Card className="gap-gutter">
            <Text className="text-xl font-semibold text-content">That link did not work</Text>
            <Text testID="callback-error" className="text-sm text-red-600">
              {error}
            </Text>
            <Text className="text-sm text-content-muted">
              Sign-in links work once and expire. Ask for a new one.
            </Text>
          </Card>
        ) : (
          <View className="items-center gap-4">
            <ActivityIndicator />
            <Text className="text-sm text-content-muted">Signing you in…</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
