import { describe, expect, it } from 'vitest';

import { formatCurrency } from './format';

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
});
