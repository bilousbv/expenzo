import { describe, expect, it } from 'vitest';

import { displayCurrencyFrom } from './display-currency';

describe('displayCurrencyFrom', () => {
  /*
   * Most members read in the household's own currency, and those figures are
   * exact: they are what was summed, not what was converted.
   */
  it('leaves the household currency alone', () => {
    const display = displayCurrencyFrom('USD', null, null);

    expect(display).toMatchObject({ currency: 'USD', approximate: false });
    expect(display.convert(1250)).toBe(1250);
  });

  it('converts into a member’s own currency at the rate it was given', () => {
    const display = displayCurrencyFrom('USD', 'UAH', 50);

    expect(display).toMatchObject({ currency: 'UAH', approximate: true });
    // 12.50 USD at 50 hryvnia to the dollar is 625.00 UAH.
    expect(display.convert(1250)).toBe(62_500);
  });

  /*
   * Marked approximate because it is today's rate applied to figures frozen at
   * the rates of the days they happened. The two do not agree, and a total
   * that quietly changes between Tuesday and Wednesday needs to say so.
   */
  it('marks a converted figure approximate even at a rate of one', () => {
    const display = displayCurrencyFrom('USD', 'EUR', 1);

    expect(display.approximate).toBe(true);
  });

  /*
   * Choosing the household's own currency explicitly is the same as choosing
   * nothing, and must not be dressed up as a conversion.
   */
  it('is not a conversion when the choice matches the household', () => {
    const display = displayCurrencyFrom('USD', 'USD', 1);

    expect(display).toMatchObject({ currency: 'USD', approximate: false });
  });

  /*
   * A missing rate is not a rate of one. Showing the base figure under the
   * base currency is at least true; relabelling it would not be.
   */
  it('falls back to the household currency when no rate is available', () => {
    const display = displayCurrencyFrom('USD', 'UAH', null);

    expect(display).toMatchObject({ currency: 'USD', approximate: false });
    expect(display.convert(1250)).toBe(1250);
  });

  // The exponents differ, and a conversion that divides by a hundred at both
  // ends is wrong at one end or both: 1000 JPY is a thousand yen.
  it('crosses currencies with different minor units', () => {
    const display = displayCurrencyFrom('USD', 'JPY', 147);

    expect(display.convert(2000)).toBe(2940);
  });

  // A real expense must not become an expense of nothing.
  it('never rounds a real amount away to zero', () => {
    const display = displayCurrencyFrom('CLP', 'USD', 0.001);

    expect(display.convert(1)).toBe(1);
  });
});
