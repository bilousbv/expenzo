// Must be first: Supabase's fetch relies on a complete URL implementation,
// which Hermes does not provide.
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from '@expenzo/supabase-types';

import { env } from '../env';

const { EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY } = env();

export const supabase = createClient<Database>(
  EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // There is no URL bar to read a session out of; deep links are handled
      // explicitly by the auth callback route instead.
      detectSessionInUrl: false,
    },
  },
);

/**
 * Refresh only while the app is in the foreground.
 *
 * Left running in the background, the timer fires against a suspended network
 * stack and burns retries; stopping it means the first foreground refresh is
 * the one that counts.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
