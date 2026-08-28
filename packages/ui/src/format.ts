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

/**
 * Renders a figure that may have been converted for display.
 *
 * The marker is not decoration. Household totals are summed in the currency
 * every expense was frozen into; showing them in a member's own currency
 * multiplies them by today's rate, so the same total read tomorrow will differ
 * slightly. A number that moves on its own has to say so.
 */
export function formatApprox(
  amountMinor: number,
  currency: string,
  approximate: boolean,
  locale = 'en-US',
): string {
  const formatted = formatCurrency(amountMinor, currency, locale);

  return approximate ? `≈ ${formatted}` : formatted;
}
