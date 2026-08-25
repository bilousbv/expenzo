import { SupabaseProvider } from '@expenzo/data';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider, useSession } from '../features/auth/use-session';
import { supabase } from '../lib/supabase';

// NativeWind's stylesheet. Metro is configured with this same file as its
// input, so the import only has to happen once, at the root.
import '../../global.css';

function RootNavigator() {
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
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)/sign-in" />
        <Stack.Screen name="(auth)/register" />
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
  );
}
