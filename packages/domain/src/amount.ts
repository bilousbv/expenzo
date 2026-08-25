import { minorUnitsFor } from './currency';

/**
 * Reading and writing money as text.
 *
 * Everything here works on digit strings rather than numbers. `19.99 * 100` is
 * 1998.9999999999998, and truncating that leaves an expense a cent short of
 * what the person typed — the kind of error nobody reports because they assume
 * they mistyped.
 */

/**
 * Separators people group thousands with.
 *
 * `\s` already covers every space that matters here — ECMAScript defines it to
 * include the non-breaking space many locales format with, the narrow one
 * French uses, and the thin space. Only the apostrophe Swiss German groups with
 * has to be named. Spelling those characters out as literals would be both
 * redundant and invisible in a diff, and eslint rejects them outright.
 */
const GROUPING_WHITESPACE = /[\s']/g;

const DIGITS_ONLY = /^\d*$/;

function groupingIsWellFormed(value: string, separator: string): boolean {
  // First group is one to three digits, every later group exactly three.
  const escaped = separator === '.' ? '\\.' : separator;
  return new RegExp(`^\\d{1,3}(${escaped}\\d{3})+$`).test(value);
}

/**
 * Parses what a person typed into integer minor units, or null if it is not a
 * number this currency can hold.
 *
 * Returns zero for "0" rather than rejecting it: whether zero is allowed is the
 * schema's decision, not this function's.
 */
export function parseAmountInput(raw: string, currency: string): number | null {
  const exponent = minorUnitsFor(currency);

  const value = raw.trim().replace(GROUPING_WHITESPACE, '');

  if (!value) return null;
  // Anything but digits and separators is out, which also rules out a leading
  // minus: a negative expense is not a thing — a refund is its own concept, and
  // the column's check constraint agrees.
  if (!/^[\d.,]+$/.test(value)) return null;

  const lastDot = value.lastIndexOf('.');
  const lastComma = value.lastIndexOf(',');
  const dots = value.split('.').length - 1;
  const commas = value.split(',').length - 1;

  let decimalSeparator: string | null = null;

  if (dots > 0 && commas > 0) {
    // Both present: the rightmost is the decimal one. That reads 1,234.56 and
    // 1.234,56 correctly without knowing the user's locale.
    decimalSeparator = lastDot > lastComma ? '.' : ',';
  } else if (dots + commas === 1) {
    const separator = dots === 1 ? '.' : ',';
    const fraction = value.slice(value.lastIndexOf(separator) + 1);

    // A lone separator before exactly three digits is ambiguous: 1,234 is a
    // thousands group in most of the world and 1.234 in the rest. Grouping
    // wins, because the alternative silently divides the amount by a thousand.
    // Unless the currency really has three decimals, where 1.234 is ordinary.
    decimalSeparator = fraction.length === 3 && exponent !== 3 ? null : separator;
  } else if (dots + commas > 1) {
    // Repeated separators can only be grouping.
    decimalSeparator = null;
  }

  let integerPart: string;
  let fractionPart: string;

  if (decimalSeparator) {
    const at = value.lastIndexOf(decimalSeparator);
    integerPart = value.slice(0, at);
    fractionPart = value.slice(at + 1);
  } else {
    integerPart = value;
    fractionPart = '';
  }

  // Whichever separator is not the decimal one. With no decimal separator at
  // all it is simply whichever appears — getting this wrong made "1,234" fail
  // the digits-only check further down rather than parse as a grouped number.
  const groupingSeparator =
    decimalSeparator === '.' ? ',' : decimalSeparator === ',' ? '.' : commas > 0 ? ',' : '.';

  if (integerPart.includes(groupingSeparator)) {
    if (!groupingIsWellFormed(integerPart, groupingSeparator)) return null;
    integerPart = integerPart.split(groupingSeparator).join('');
  }

  // Any separator still standing is one that could not be accounted for.
  if (!DIGITS_ONLY.test(integerPart) || !DIGITS_ONLY.test(fractionPart)) return null;
  if (!integerPart && !fractionPart) return null;

  // Rounding would change the number without saying so.
  if (fractionPart.length > exponent) return null;

  const minor = `${integerPart || '0'}${fractionPart.padEnd(exponent, '0')}`;
  const parsed = Number(minor);

  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Renders minor units as a plain decimal string — no symbol, no grouping.
 *
 * This is the inverse of parseAmountInput, for putting a stored amount back
 * into an editable field. Use formatCurrency for anything a user only reads.
 */
export function formatMinorUnits(amountMinor: number, currency: string): string {
  const exponent = minorUnitsFor(currency);
  const negative = amountMinor < 0;
  const digits = Math.abs(amountMinor)
    .toString()
    .padStart(exponent + 1, '0');

  const sign = negative ? '-' : '';

  if (exponent === 0) return `${sign}${digits}`;

  const cut = digits.length - exponent;
  return `${sign}${digits.slice(0, cut)}.${digits.slice(cut)}`;
}
