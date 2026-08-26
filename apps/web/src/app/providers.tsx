'use client';

import { SupabaseProvider } from '@expenzo/data';
import type { Locale } from '@expenzo/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { I18nProvider } from '@/lib/i18n/provider';
import { createClient } from '@/lib/supabase/browser';

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  // Created once per mount rather than at module scope, so a server render
  // never shares a cache between two users' requests.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [supabase] = useState(createClient);

  return (
    <I18nProvider locale={locale}>
      <QueryClientProvider client={queryClient}>
        <SupabaseProvider client={supabase}>{children}</SupabaseProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
