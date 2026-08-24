'use client';

import { SupabaseProvider } from '@expenzo/data';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { createClient } from '@/lib/supabase/browser';

export function Providers({ children }: { children: ReactNode }) {
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
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider client={supabase}>{children}</SupabaseProvider>
    </QueryClientProvider>
  );
}
