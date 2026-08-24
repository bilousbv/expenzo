import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@expenzo/supabase-types';

import { env } from '@/env';

/**
 * Request-scoped client for server components, route handlers and Server
 * Actions. Repositories take this directly, so those paths need no hooks and
 * ship nothing to the client bundle.
 *
 * `cookies()` is async in Next 16, so this function is too.
 */
export async function createClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env();
  const cookieStore = await cookies();

  return createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components cannot set cookies. Refreshing the session is
          // the middleware's job, so ignoring this is correct rather than
          // merely convenient.
        }
      },
    },
  });
}
