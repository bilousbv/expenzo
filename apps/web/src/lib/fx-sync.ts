import { timingSafeEqual } from 'node:crypto';

import { upsertEurRates, type Db, type FxSyncResult } from '@expenzo/data';
import { nbuToEurRates, parseEcbDailyXml, parseNbuJson } from '@expenzo/domain';

/**
 * The European Central Bank's daily reference rates: free, no key, no rate
 * limit, published once each working day at around 16:00 CET.
 */
export const ECB_DAILY_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

/**
 * The National Bank of Ukraine's daily rates.
 *
 * Read as well as the ECB's, not instead of it. The ECB publishes 29
 * currencies and the hryvnia is not one of them — for an app whose default
 * language is Ukrainian, that is the gap this source exists to close. It also
 * roughly doubles what can be entered, to about fifty currencies.
 */
export const NBU_DAILY_URL = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json';

async function readFeed(fetchImpl: typeof fetch, url: string, accept: string): Promise<string> {
  const response = await fetchImpl(url, {
    headers: { accept },
    // The feeds change once a day; a cached copy from an hour ago is fine, a
    // cached copy from last week is not.
    cache: 'no-store',
  });

  // Parsing an error page produces "no publication date", which sends whoever
  // reads the log looking at the parser instead of at the status code.
  if (!response.ok) {
    throw new Error(`responded ${response.status}`);
  }

  return response.text();
}

/**
 * Fetches a day of rates from both publishers and files them.
 *
 * Each source is stored as its own batch, the ECB last, so that where the two
 * overlap the ECB's figure is the one left in the table. It is the reference
 * for euro pairs and is where every other euro rate already came from;
 * "whichever was written second" is not a rule anyone could reason about.
 *
 * One source failing is survivable and deliberately not fatal. Rates persist
 * and `app.fx_rate_on` already reaches back a week, so a day-old hryvnia rate
 * is far better than discarding the feed that did answer. Both failing is
 * reported, because then there is nothing new at all.
 *
 * `fetchImpl` is injectable so the parsing and the storing can be tested
 * without a network, which is the part that actually breaks.
 */
export async function syncFxRates(db: Db, fetchImpl: typeof fetch = fetch): Promise<FxSyncResult> {
  const failed: string[] = [];
  let result: FxSyncResult | null = null;

  // Written first so the ECB can overwrite the pairs both of them quote.
  try {
    const feed = parseNbuJson(await readFeed(fetchImpl, NBU_DAILY_URL, 'application/json'));

    result = await upsertEurRates(db, feed.asOf, nbuToEurRates(feed), 'nbu');
  } catch {
    failed.push('nbu');
  }

  try {
    const feed = parseEcbDailyXml(await readFeed(fetchImpl, ECB_DAILY_URL, 'application/xml'));

    result = await upsertEurRates(db, feed.asOf, feed.rates, 'ecb');
  } catch {
    failed.push('ecb');
  }

  if (!result) {
    throw new Error('Both rate feeds failed, so no rates were filed');
  }

  return { ...result, failed };
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
