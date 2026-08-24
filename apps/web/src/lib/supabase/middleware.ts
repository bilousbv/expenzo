import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@expenzo/supabase-types';

import { env } from '@/env';

/**
 * Refreshes the session on every request and writes the rotated cookies back.
 *
 * This is mandatory, not an optimisation: server components cannot set cookies,
 * so without it the access token expires and server rendering starts returning
 * 401 part-way through a session.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env();

  const supabase = createServerClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser, not getSession: it revalidates the token with the auth server
  // rather than trusting whatever the cookie claims.
  await supabase.auth.getUser();

  return response;
}
