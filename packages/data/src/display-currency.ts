import { convertMinor } from '@expenzo/domain';

/**
 * What one member sees household figures in.
 *
 * The household has a single base currency: every expense is converted into it
 * once, at write time, at the rate of the day it happened, and frozen there.
 * That is what totals are summed from and it never moves.
 *
 * This is the other half — presentation. A member who reads in a different
 * currency has those totals multiplied by today's rate on the way to the
 * screen. Nothing is stored and nothing is recomputed; two people can read one
 * ledger in two currencies, and neither of them changes it.
 */
export interface DisplayCurrency {
  /** The currency figures should be formatted in. */
  readonly currency: string;
  /** What the figures are actually stored and summed in. */
  readonly baseCurrency: string;
  /**
   * True when the figures went through a conversion, and so are today's answer
   * rather than the frozen one. Screens mark these.
   */
  readonly approximate: boolean;
  /** Converts an amount in base-currency minor units into `currency`. */
  convert: (baseMinor: number) => number;
}

const identity = (baseMinor: number) => baseMinor;

export function displayCurrencyFrom(
  baseCurrency: string,
  preferred: string | null | undefined,
  rate: number | null | undefined,
): DisplayCurrency {
  const exact: DisplayCurrency = {
    currency: baseCurrency,
    baseCurrency,
    approximate: false,
    convert: identity,
  };

  // Choosing the household's own currency is the same as choosing nothing, and
  // must not be dressed up as a conversion.
  if (!preferred || preferred === baseCurrency) return exact;

  // A missing rate is not a rate of one. Showing the base figure under the base
  // currency is at least true; relabelling it would not be.
  if (!rate) return exact;

  return {
    currency: preferred,
    baseCurrency,
    approximate: true,
    convert: (baseMinor) => convertMinor(baseMinor, baseCurrency, preferred, rate),
  };
}
