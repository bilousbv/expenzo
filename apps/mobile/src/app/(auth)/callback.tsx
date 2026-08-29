import { Card } from '@expenzo/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from '@expenzo/i18n';
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
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  // The key rather than the finished sentence: translating inside the effect
  // would make it depend on , and a new  arrives whenever the language
  // changes — which would re-run the exchange with a code already spent.
  //  is false for messages from the auth server, which arrive as
  // prose and are not ours to look up.
  // The key rather than the finished sentence: translating inside the effect
  // would make it depend on `t`, and a new `t` arrives whenever the language
  // changes — which would re-run the exchange with a code already spent.
  // `translate` is false for messages from the auth server, which arrive as
  // prose and are not ours to look up.
  const [error, setError] = useState<{ translate: boolean; value: string } | null>(null);

  useEffect(() => {
    let active = true;

    async function exchange() {
      if (params.error_description) {
        if (active) setError({ translate: false, value: params.error_description });
        return;
      }

      if (!params.code) {
        if (active) setError({ translate: true, value: 'auth.errors.missingCode' });
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);

      if (!active) return;

      if (exchangeError) {
        setError({ translate: false, value: exchangeError.message });
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
            <Text className="text-xl font-semibold text-content">
              {t('auth.errors.linkFailed')}
            </Text>
            <Text testID="callback-error" className="text-sm text-negative">
              {error.translate ? t(error.value) : error.value}
            </Text>
            <Text className="text-sm text-content-muted">
              {t('auth.errors.linkFailedExplainer')}
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
