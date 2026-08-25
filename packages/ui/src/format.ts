import { minorUnitsFor } from '@expenzo/domain';

/**
 * Renders an amount held in integer minor units.
 *
 * The exponent comes from the currency rather than being assumed to be two:
 * ¥1000 is a thousand yen and 1.234 KWD is one dinar, so dividing everything by
 * 100 is wrong outside the currencies that happen to have two decimals.
 */
export function formatCurrency(amountMinor: number, currency = 'USD', locale = 'en-US'): string {
  const exponent = minorUnitsFor(currency);

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(amountMinor / 10 ** exponent);
}
