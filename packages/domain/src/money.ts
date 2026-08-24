import { normalizeCurrency, type CurrencyCode } from './currency';

/**
 * An amount in integer minor units plus its currency.
 *
 * Never a float. Binary floating point cannot represent 0.1 exactly, and money
 * arithmetic that starts with a rounding error ends with a reconciliation
 * problem nobody can explain.
 */
export interface Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

export function money(amountMinor: number, currency: string): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`Money must be an integer number of minor units, received ${amountMinor}`);
  }
  return { amountMinor, currency: normalizeCurrency(currency) };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`currency mismatch: cannot combine ${a.currency} with ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

/**
 * Sums a list into the given currency.
 *
 * The currency is an explicit argument rather than inferred from the first
 * element so that an empty list still produces a well-formed zero.
 */
export function sumMoney(items: readonly Money[], currency: string): Money {
  const target = normalizeCurrency(currency);

  let total = 0;
  for (const item of items) {
    if (item.currency !== target) {
      throw new Error(`currency mismatch: cannot sum ${item.currency} into ${target}`);
    }
    total += item.amountMinor;
  }

  return { amountMinor: total, currency: target };
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amountMinor < b.amountMinor) return -1;
  if (a.amountMinor > b.amountMinor) return 1;
  return 0;
}

export function isZeroMoney(value: Money): boolean {
  return value.amountMinor === 0;
}

export function negateMoney(value: Money): Money {
  return { amountMinor: -value.amountMinor, currency: value.currency };
}
