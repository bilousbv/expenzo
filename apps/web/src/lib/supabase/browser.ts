import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@expenzo/supabase-types';

import { env } from '@/env';

/**
 * Client component client. Cookie-backed, so the session it reads is the same
 * one the server rendered with.
 */
export function createClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env();

  return createBrowserClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
