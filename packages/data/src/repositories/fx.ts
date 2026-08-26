import type { EcbDailyRates } from '@expenzo/domain';

import type { Db } from '../types';

export interface FxSyncResult {
  /** The date the feed published the rates for, not the date they were fetched. */
  readonly asOf: string;
  readonly quoted: number;
}

/**
 * Files a day of European Central Bank rates.
 *
 * An upsert rather than an insert: re-running the sync has to be free, or a
 * second run on the same day raises a primary key violation and a healthy job
 * looks broken. Only the service role can reach this — there is no write policy
 * on the table at all.
 */
export async function upsertEcbRates(db: Db, feed: EcbDailyRates): Promise<FxSyncResult> {
  const rows = Object.entries(feed.rates).map(([quote, rate]) => ({
    base: 'EUR',
    quote,
    as_of: feed.asOf,
    rate,
    source: 'ecb',
  }));

  const { error } = await db.from('fx_rates').upsert(rows, { onConflict: 'base,quote,as_of' });

  if (error) throw new Error(error.message);

  return { asOf: feed.asOf, quoted: rows.length };
}

/**
 * The currencies an expense can be entered in.
 *
 * Read from the feed rather than hard-coded, so the dropdown offers exactly
 * what the database can convert. Offering a currency with no rate produces an
 * expense that refuses to save at the moment of saving it.
 */
export async function listSupportedCurrencies(db: Db, baseCurrency: string): Promise<string[]> {
  const latest = await db
    .from('fx_rates')
    .select('as_of')
    .eq('base', 'EUR')
    .order('as_of', { ascending: false })
    .limit(1);

  if (latest.error) throw new Error(latest.error.message);

  const asOf = (latest.data ?? [])[0]?.as_of;

  // Before the first sync the table is empty. The household's own currency
  // needs no rate to convert, so it is always offerable.
  if (!asOf) return [baseCurrency];

  const quoted = await db.from('fx_rates').select('quote').eq('base', 'EUR').eq('as_of', asOf);

  if (quoted.error) throw new Error(quoted.error.message);

  const codes = new Set<string>([baseCurrency]);
  for (const row of quoted.data ?? []) codes.add(row.quote);

  return [...codes].sort();
}
