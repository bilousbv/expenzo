import { NextResponse, type NextRequest } from 'next/server';

import { isAuthorizedSync, syncFxRates } from '@/lib/fx-sync';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Fetches the day's exchange rates and files them.
 *
 * Called by a scheduler rather than by a person — a Vercel cron entry, a
 * GitHub Actions schedule, or `curl` — which is why it is a POST behind a
 * shared secret rather than a page. Re-running it is free: the write is an
 * upsert keyed on (base, quote, as_of).
 *
 * Rates are not household data, so this is the one place a service-role client
 * is justified: there is no user whose policies could scope the write.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedSync(request.headers.get('authorization'), process.env.FX_SYNC_SECRET ?? '')) {
    // Deliberately says nothing about whether the secret is unset or merely
    // wrong.
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  try {
    const result = await syncFxRates(createServiceClient());

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Rate sync failed';

    // 502: the failure is almost always the upstream feed, and a 500 would send
    // whoever is on call looking at this application first.
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
