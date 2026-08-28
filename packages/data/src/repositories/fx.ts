import { deriveRate, type EcbDailyRates } from '@expenzo/domain';

import type { Db } from '../types';

export interface FxSyncResult {
  /** The date the feed published the rates for, not the date they were fetched. */
  readonly asOf: string;
  readonly quoted: number;
  /** Sources that did not answer. Empty on a clean run. */
  readonly failed?: string[];
}

/**
 * Files a day of rates, whoever published them.
 *
 * Everything is stored EUR-based whatever the source quoted against, so the
 * lookup in `app.fx_rate_on` has one path through the table rather than one
 * per publisher — two paths would be two chances to disagree about what a
 * currency is worth.
 *
 * An upsert rather than an insert: re-running the sync has to be free, or a
 * second run on the same day raises a primary key violation and a healthy job
 * looks broken. Only the service role can reach this — there is no write policy
 * on the table at all.
 */
export async function upsertEurRates(
  db: Db,
  asOf: string,
  rates: Record<string, number>,
  source: string,
): Promise<FxSyncResult> {
  const rows = Object.entries(rates).map(([quote, rate]) => ({
    base: 'EUR',
    quote,
    as_of: asOf,
    rate,
    source,
  }));

  const { error } = await db.from('fx_rates').upsert(rows, { onConflict: 'base,quote,as_of' });

  if (error) throw new Error(error.message);

  return { asOf, quoted: rows.length };
}

export async function upsertEcbRates(db: Db, feed: EcbDailyRates): Promise<FxSyncResult> {
  return upsertEurRates(db, feed.asOf, feed.rates, 'ecb');
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

/**
 * Today's rate between two currencies, for showing stored figures in a
 * member's own money.
 *
 * Deliberately one number rather than a re-query: household totals are already
 * summed in the base currency, so presenting them elsewhere is a single
 * multiplication. Nothing stored moves — the amounts stay frozen at the rates
 * of the days they happened, and only the presentation is converted, which is
 * why every figure it produces is marked approximate.
 *
 * Null rather than 1 when a rate is missing. A missing rate is not a rate of
 * one, and pretending otherwise prints a hryvnia total under a dollar sign.
 */
export async function getDisplayRate(db: Db, from: string, to: string): Promise<number | null> {
  // Answerable without the table, and most members read in the household's own
  // currency — a round trip on every screen to learn that would be waste.
  if (from === to) return 1;

  const latest = await db
    .from('fx_rates')
    .select('as_of')
    .eq('base', 'EUR')
    .order('as_of', { ascending: false })
    .limit(1);

  if (latest.error) throw new Error(latest.error.message);

  const asOf = (latest.data ?? [])[0]?.as_of;

  if (!asOf) return null;

  const quoted = await db
    .from('fx_rates')
    .select('quote, rate')
    .eq('base', 'EUR')
    .eq('as_of', asOf);

  if (quoted.error) throw new Error(quoted.error.message);

  const eurRates: Record<string, number> = {};
  for (const row of quoted.data ?? []) eurRates[row.quote] = Number(row.rate);

  return deriveRate(from, to, eurRates);
}
