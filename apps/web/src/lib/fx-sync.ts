import { timingSafeEqual } from 'node:crypto';

import { upsertEcbRates, type Db, type FxSyncResult } from '@expenzo/data';
import { parseEcbDailyXml } from '@expenzo/domain';

/**
 * The European Central Bank's daily reference rates: free, no key, no rate
 * limit, published once each working day at around 16:00 CET.
 */
export const ECB_DAILY_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

/**
 * Fetches a day of rates and files them.
 *
 * `fetchImpl` is injectable so the parsing and the storing can be tested
 * without a network, which is the part that actually breaks.
 */
export async function syncFxRates(db: Db, fetchImpl: typeof fetch = fetch): Promise<FxSyncResult> {
  const response = await fetchImpl(ECB_DAILY_URL, {
    headers: { accept: 'application/xml' },
    // The feed changes once a day; a cached copy from an hour ago is fine, a
    // cached copy from last week is not.
    cache: 'no-store',
  });

  // Parsing an error page produces "no publication date", which sends whoever
  // reads the log looking at the parser instead of at the status code.
  if (!response.ok) {
    throw new Error(`The rate feed responded ${response.status}`);
  }

  return upsertEcbRates(db, parseEcbDailyXml(await response.text()));
}

/**
 * Whether a request may run the sync.
 *
 * Compared in constant time. The comparison leaks the length of the configured
 * secret and nothing else, which is why the length check comes first rather
 * than being an accident of the algorithm.
 */
export function isAuthorizedSync(header: string | null, secret: string): boolean {
  // An unset secret must never mean "no check": a route that syncs for anyone
  // who asks is a route anyone can use to fill the rate table.
  if (!secret) return false;

  const prefix = 'Bearer ';
  if (!header?.startsWith(prefix)) return false;

  const provided = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(secret);

  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}
