import type { NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

/**
 * Next 16 renamed the `middleware` file convention to `proxy`; the old name
 * still works but warns on every dev boot and is on its way out.
 *
 * Refreshing the Supabase session here is mandatory, not an optimisation:
 * server components cannot set cookies, so without this the access token
 * expires and server rendering starts returning 401 mid-session.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Running a session
     * refresh on those would add a round trip to every icon request.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
};
