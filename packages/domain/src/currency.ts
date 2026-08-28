/**
 * ISO 4217 currency handling.
 *
 * Amounts are stored as integer minor units, so every conversion to and from a
 * displayable value needs the currency's exponent. Assuming 2 — dividing by 100
 * — is wrong for a meaningful share of the world's currencies.
 */

export type CurrencyCode = string;

const CODE_PATTERN = /^[A-Za-z]{3}$/;

/** Currencies with no minor unit at all: ¥1000 is 1000, not 10.00. */
const ZERO_DECIMAL = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'ISK',
  'JPY',
  'KMF',
  'KRW',
  'PYG',
  'RWF',
  'UGX',
  'UYI',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

/** Currencies with a single decimal place. */
const ONE_DECIMAL = new Set(['MGA', 'MRU']);

/** Currencies with three decimal places, mostly Gulf states. */
const THREE_DECIMAL = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

export function isCurrencyCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

/** Upper-cases a code so equality comparisons are never case-dependent. */
export function normalizeCurrency(value: string): CurrencyCode {
  if (!isCurrencyCode(value)) {
    throw new Error(`Not a currency code: ${JSON.stringify(value)}`);
  }
  return value.toUpperCase();
}

/** Number of decimal places the currency subdivides into. */
export function minorUnitsFor(code: string): number {
  const normalized = normalizeCurrency(code);

  if (ZERO_DECIMAL.has(normalized)) return 0;
  if (ONE_DECIMAL.has(normalized)) return 1;
  if (THREE_DECIMAL.has(normalized)) return 3;

  return 2;
}

/**
 * The currencies offered on the registration form.
 *
 * A fixed shortlist rather than the rate table, because the table is readable
 * only once signed in and there is no session yet. Every code here is quoted by
 * one of the two feeds, so a household opened in any of them can convert from
 * the first expense onwards.
 *
 * The hryvnia leads it: this app's default language is Ukrainian.
 */
export const SIGNUP_CURRENCIES = [
  'UAH',
  'EUR',
  'USD',
  'GBP',
  'PLN',
  'CZK',
  'CHF',
  'CAD',
  'AUD',
  'JPY',
] as const;
