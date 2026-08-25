import { createClient } from '@supabase/supabase-js';

import type { Database } from '@expenzo/supabase-types';

/**
 * The service-role client. Bypasses row-level security entirely.
 *
 * Only ever constructed inside a route handler, never in a component, and only
 * where the work genuinely belongs to no user — currently the exchange-rate
 * sync, which writes reference data no household owns.
 *
 * Every caller has to re-check ownership in code, because the database is no
 * longer doing it for them.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy apps/web/.env.example to .env.local and fill it from `pnpm db:status`.',
    );
  }

  return createClient<Database>(url, key, {
    // There is no user here and nothing to refresh. Persisting would write a
    // service-role session into whatever storage the runtime offers.
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
