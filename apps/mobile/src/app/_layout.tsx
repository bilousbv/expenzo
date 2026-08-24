import { SupabaseProvider } from '@expenzo/data';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';

// NativeWind's stylesheet. Metro is configured with this same file as its
// input, so the import only has to happen once, at the root.
import '../../global.css';

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
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}
