import { SupabaseProvider } from '@expenzo/data';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useTranslation } from '@expenzo/i18n';

import { SessionProvider, useSession } from '../features/auth/use-session';
import { LocaleProvider } from '../lib/i18n';
import { ThemeProvider } from '../lib/theme';
import { supabase } from '../lib/supabase';

// NativeWind's stylesheet. Metro is configured with this same file as its
// input, so the import only has to happen once, at the root.
import '../../global.css';

function RootNavigator() {
  const { t } = useTranslation();
  const { session, loading } = useSession();

  // Reading the stored session is asynchronous. Rendering the navigator before
  // it resolves would flash the sign-in screen at an already-signed-in user.
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-muted">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        {/* Pushed from Settings rather than given a tab: it is configuration,
            not somewhere anybody navigates to daily. */}
        <Stack.Screen
          name="categories"
          options={{ headerShown: true, title: t('categories.title'), presentation: 'modal' }}
        />
        {/* One category's expenses, reached from the dashboard rollup. */}
        <Stack.Screen name="category/[categoryId]" options={{ headerShown: true, title: '' }} />
        {/* Pushed from Settings, like the categories screen. */}
        <Stack.Screen
          name="profile"
          options={{ headerShown: true, title: t('profile.title'), presentation: 'modal' }}
        />
        {/* Its own route because M6 deep-links straight here from a wallet
            payment: expenzo://expense/new. */}
        <Stack.Screen
          name="expense/new"
          options={{ headerShown: true, title: t('nav.newExpense'), presentation: 'modal' }}
        />
        {/* Presented the same way, for the same reason: the list is what the
            subscriptions tab is for, and adding one is an occasional errand. */}
        <Stack.Screen
          name="subscription/new"
          options={{
            headerShown: true,
            title: t('subscriptions.addDialogTitle'),
            presentation: 'modal',
          }}
        />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)/sign-in" />
        <Stack.Screen name="(auth)/register" />
        {/* Its own screen rather than a section of the sign-in card: two email
            fields in one form were ambiguous to fill. */}
        <Stack.Screen name="(auth)/magic-link" />
      </Stack.Protected>

      {/* Reachable either way: it is what completes the sign-in. */}
      <Stack.Screen name="(auth)/callback" />
    </Stack>
  );
}

export default function RootLayout() {
  // Created once per mount rather than at module scope, so a fast refresh does
  // not leave two caches alive.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <LocaleProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <SupabaseProvider client={supabase}>
            <SessionProvider>
              <SafeAreaProvider>
                <RootNavigator />
                <StatusBar style="auto" />
              </SafeAreaProvider>
            </SessionProvider>
          </SupabaseProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}
