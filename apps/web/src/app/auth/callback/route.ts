import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@expenzo/supabase-types';

import { env } from '@/env';

/**
 * Where the magic link and every OAuth provider land.
 *
 * Exchanges the one-time code for a session, then sends the user on to
 * wherever they were originally heading.
 *
 * The cookies are written onto the redirect response directly rather than
 * through `cookies()` from next/headers. `NextResponse.redirect()` builds a
 * fresh response, and cookies set through the request-scoped store do not make
 * it onto one — the exchange then succeeds while the browser receives no
 * session, and the user silently bounces back to the login page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Redirect back to the exact host the browser used, taken from the Host
  // header rather than from request.url. Next normalises request.url to
  // localhost, and 127.0.0.1 and localhost are different hosts as far as
  // cookies are concerned — bouncing between them silently drops the session
  // that was just created.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost ?? request.headers.get('host');
  const proto =
    request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '');
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;

  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  // Relative paths only, or this is an open redirect: `next` arrives from a URL
  // anyone can craft and put in front of a user.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (!code) {
    const reason = searchParams.get('error_description') ?? 'missing_code';
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
  }

  const response = NextResponse.redirect(`${origin}${safeNext}`);
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
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return response;
}
