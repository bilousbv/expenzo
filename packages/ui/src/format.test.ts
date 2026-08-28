import { describe, expect, it } from 'vitest';

import { formatApprox, formatCurrency } from './format';

describe('formatCurrency', () => {
  it('renders cents as dollars', () => {
    expect(formatCurrency(1250)).toBe('$12.50');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('rounds to two decimal places', () => {
    expect(formatCurrency(1)).toBe('$0.01');
  });

  // Locale output embeds a non-breaking space before the symbol, so assert on
  // the numeric part rather than the whole string.
  it('honours currency and locale', () => {
    expect(formatCurrency(1250, 'EUR', 'de-DE')).toContain('12,50');
  });

  // Dividing by 100 unconditionally is wrong for a meaningful share of the
  // world's currencies: ¥1000 is a thousand yen, not ten. Reading the exponent
  // from the currency is the only way this is right anywhere but the dollar.
  it('uses the currency exponent rather than assuming two decimals', () => {
    expect(formatCurrency(1000, 'JPY', 'en-US')).toContain('1,000');
    expect(formatCurrency(1000, 'JPY', 'en-US')).not.toContain('10.00');
  });

  it('renders a three-decimal currency correctly', () => {
    expect(formatCurrency(1234, 'KWD', 'en-US')).toContain('1.234');
  });

  it('renders a one-decimal currency correctly', () => {
    expect(formatCurrency(15, 'MGA', 'en-US')).toContain('1.5');
  });
});

describe('formatApprox', () => {
  it('formats an exact figure with nothing added', () => {
    expect(formatApprox(1250, 'USD', false)).toContain('12.50');
    expect(formatApprox(1250, 'USD', false)).not.toContain('≈');
  });

  /*
   * A figure a member reads in their own currency is today's rate applied to
   * amounts frozen at the rates of the days they happened. It will differ
   * slightly from the same total read tomorrow, and a number that moves on its
   * own has to say that it is an approximation.
   */
  it('marks a converted figure as approximate', () => {
    const marked = formatApprox(62_500, 'UAH', true);

    expect(marked.startsWith('≈')).toBe(true);
    expect(marked).toContain('625');
  });
});
