/**
 * Foreign exchange.
 *
 * Rates come from the European Central Bank's daily reference feed, which is
 * free, needs no key and is EUR-based. Every pair that is not a euro pair is
 * therefore triangulated through EUR — exact enough for expense tracking,
 * where the alternative is a commercial provider and an API key.
 *
 * Conversion happens once, at write time, against the household's base
 * currency, and is then frozen on the row. Converting at read time would make
 * last month's total drift every day.
 *
 * The arithmetic here is mirrored by `app.convert_minor` in SQL, because the
 * database is what actually writes `expenses.base_amount_minor` — a client
 * cannot be trusted with a figure every household total depends on. The two
 * must agree; `supabase/tests/fx.test.sql` asserts the same cases this file
 * does.
 */

import { minorUnitsFor, normalizeCurrency } from './currency';
import type { IsoDate } from './period';

export interface EcbDailyRates {
  /** The date the ECB published these rates for. */
  readonly asOf: IsoDate;
  /** Units of each currency per one euro, including EUR itself at 1. */
  readonly rates: Readonly<Record<string, number>>;
}

/** `<Cube time='2026-08-25'>` — single-quoted in the real feed. */
const TIME_PATTERN = /<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/;

/** `<Cube currency='USD' rate='1.1642'/>` */
const RATE_PATTERN = /<Cube\s+currency=['"]([A-Za-z]{3})['"]\s+rate=['"]([^'"]*)['"]/g;

/**
 * Reads the ECB daily reference feed.
 *
 * Deliberately a regular expression rather than an XML parser: this is one
 * machine-generated document with a fixed shape, and a parser dependency would
 * have to be carried by every consumer of this package for it.
 */
export function parseEcbDailyXml(xml: string): EcbDailyRates {
  const time = TIME_PATTERN.exec(xml);

  if (!time?.[1]) {
    throw new Error('The rate feed carries no publication date');
  }

  // EUR is the base and is never listed. Without it here, every conversion
  // into or out of euros would be a lookup miss.
  const rates: Record<string, number> = { EUR: 1 };

  for (const match of xml.matchAll(RATE_PATTERN)) {
    const code = normalizeCurrency(match[1] as string);
    const rate = Number(match[2]);

    // Skipping silently would drop a currency from the table, and the first
    // anyone would hear of it is an expense that refuses to save.
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`The rate feed quotes ${code} as ${JSON.stringify(match[2])}`);
    }

    rates[code] = rate;
  }

  if (Object.keys(rates).length === 1) {
    throw new Error('The rate feed quotes no rates at all');
  }

  return { asOf: time[1] as IsoDate, rates };
}

/**
 * Units of `to` per one unit of `from`, triangulated through the euro.
 *
 * Null when the feed does not carry one of the two currencies, which is a real
 * outcome: the ECB quotes about thirty.
 */
export function deriveRate(
  from: string,
  to: string,
  eurRates: Readonly<Record<string, number>>,
): number | null {
  const source = normalizeCurrency(from);
  const target = normalizeCurrency(to);

  // Answerable without the feed, and the answer is the same whether or not the
  // currency is quoted at all.
  if (source === target) return 1;

  const perEurSource = eurRates[source];
  const perEurTarget = eurRates[target];

  if (!perEurSource || !perEurTarget) return null;

  return perEurTarget / perEurSource;
}

/**
 * Converts an amount in minor units into another currency's minor units.
 *
 * The exponents are the point. Minor units are not a fixed hundredth: 1000 JPY
 * is a thousand yen and 1000 KWD is one dinar, so a conversion that divides by
 * 100 at both ends is wrong at one end or both.
 *
 * Rounds to the nearest minor unit, but never below one: converting a small
 * amount from a weak currency into a strong one can round to nothing, and an
 * expense that happened must not become an expense of zero.
 *
 * Amounts are constrained positive, so `Math.round` and SQL's `round`, which
 * differ on negative halves, cannot disagree here.
 */
export function convertMinor(amountMinor: number, from: string, to: string, rate: number): number {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`Amount must be a whole number of minor units, received ${amountMinor}`);
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Exchange rate must be positive, received ${rate}`);
  }

  const sourceExponent = minorUnitsFor(from);
  const targetExponent = minorUnitsFor(to);

  // Zero is not a small amount, it is nothing, and the floor below exists to
  // stop something becoming nothing rather than to turn nothing into something.
  // A household that spent nothing must not be shown a penny.
  if (amountMinor === 0) return 0;

  const major = amountMinor / 10 ** sourceExponent;

  return Math.max(Math.round(major * rate * 10 ** targetExponent), 1);
}
