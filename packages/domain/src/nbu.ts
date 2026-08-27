import { normalizeCurrency } from './currency';
import type { IsoDate } from './period';

export interface NbuDailyRates {
  readonly asOf: IsoDate;
  /** Hryvnia per one unit of each currency, including UAH itself at one. */
  readonly uahPer: Record<string, number>;
}

interface NbuRow {
  cc?: unknown;
  rate?: unknown;
  exchangedate?: unknown;
}

/** dd.mm.yyyy, which is what bank.gov.ua publishes. */
const NBU_DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

/**
 * Quoted by the National Bank but not money.
 *
 * Gold, silver, palladium and platinum have ISO 4217 codes and a daily rate,
 * and so do the IMF's drawing rights — none of them is something a household
 * buys lunch in. Left in, they would sit in the currency picker between lira
 * and dollars, and minorUnitsFor would quietly treat an ounce of gold as
 * having two decimal places.
 *
 * A list rather than a rule about the X prefix: XAF, XOF and XPF are the CFA
 * and CFP francs, which people are genuinely paid in.
 */
const NOT_MONEY = new Set(['XAU', 'XAG', 'XPD', 'XPT', 'XDR']);

/**
 * The National Bank of Ukraine's daily rates.
 *
 * Added alongside the ECB because the ECB does not quote the hryvnia at all —
 * it publishes 29 currencies and UAH is not among them, which for an app whose
 * default language is Ukrainian is not a gap we can leave. This feed quotes
 * around 45 currencies against the hryvnia, needs no key, and is published by
 * the central bank rather than resold.
 */
export function parseNbuJson(body: string): NbuDailyRates {
  let rows: unknown;

  try {
    rows = JSON.parse(body);
  } catch {
    throw new Error('The hryvnia rate feed did not return JSON');
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('The hryvnia rate feed carried no rates');
  }

  const first = rows[0] as NbuRow;
  const stamped = typeof first.exchangedate === 'string' ? NBU_DATE.exec(first.exchangedate) : null;

  if (!stamped) {
    throw new Error(
      `The hryvnia rate feed carries no readable date: ${String(first.exchangedate)}`,
    );
  }

  // The hryvnia is this feed's base and is never listed in it, exactly as the
  // euro is absent from the ECB file.
  const uahPer: Record<string, number> = { UAH: 1 };

  for (const row of rows as NbuRow[]) {
    if (typeof row.cc !== 'string' || !/^[A-Za-z]{3}$/.test(row.cc)) continue;

    const code = normalizeCurrency(row.cc);

    if (NOT_MONEY.has(code)) continue;
    const rate = Number(row.rate);

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`The hryvnia rate feed quotes ${code} as ${JSON.stringify(row.rate)}`);
    }

    uahPer[code] = rate;
  }

  return {
    asOf: `${stamped[3]}-${stamped[2]}-${stamped[1]}` as IsoDate,
    uahPer,
  };
}

/**
 * Restates the feed in the euro terms the rate table stores.
 *
 * The table is EUR-based and every conversion triangulates through it. Giving
 * this feed a base of its own would mean two lookup paths through
 * `app.fx_rate_on`, and two paths are two chances to disagree about what a
 * hryvnia is worth.
 *
 * Units per euro, so `rates.USD` is dollars per euro — the same quantity the
 * ECB file states directly.
 */
export function nbuToEurRates(feed: NbuDailyRates): Record<string, number> {
  const uahPerEur = feed.uahPer.EUR;

  if (!uahPerEur) {
    throw new Error('The hryvnia rate feed does not quote the euro, so it cannot be rebased');
  }

  const rates: Record<string, number> = {};

  for (const [code, uahPerUnit] of Object.entries(feed.uahPer)) {
    rates[code] = uahPerEur / uahPerUnit;
  }

  // Exactly one rather than the result of dividing a number by itself, which
  // can land a bit-width away from 1 and make a euro expense convert to
  // something that is not quite its own amount.
  rates.EUR = 1;

  return rates;
}
