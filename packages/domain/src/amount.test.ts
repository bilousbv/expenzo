import { describe, expect, it } from 'vitest';

import { formatMinorUnits, parseAmountInput } from './amount';

describe('parseAmountInput', () => {
  it('reads a plain whole number', () => {
    expect(parseAmountInput('12', 'USD')).toBe(1200);
  });

  it('reads a decimal point', () => {
    expect(parseAmountInput('12.50', 'USD')).toBe(1250);
  });

  // Most of Europe types the decimal separator as a comma, and a field that
  // silently reads 12,50 as 1250 euros is worse than one that refuses it.
  it('reads a decimal comma the same way', () => {
    expect(parseAmountInput('12,50', 'USD')).toBe(1250);
  });

  it('pads a single decimal digit', () => {
    expect(parseAmountInput('12.5', 'USD')).toBe(1250);
  });

  it('accepts a leading separator', () => {
    expect(parseAmountInput('.5', 'USD')).toBe(50);
    expect(parseAmountInput(',5', 'USD')).toBe(50);
  });

  it('ignores surrounding whitespace', () => {
    expect(parseAmountInput('  12.50  ', 'USD')).toBe(1250);
  });

  it('ignores spaces used as thousands separators', () => {
    expect(parseAmountInput('1 234,56', 'USD')).toBe(123456);
  });

  // When both separators appear, the rightmost is the decimal one. That covers
  // 1,234.56 and 1.234,56 without having to know the user's locale.
  it('takes the rightmost separator as the decimal one', () => {
    expect(parseAmountInput('1,234.56', 'USD')).toBe(123456);
    expect(parseAmountInput('1.234,56', 'USD')).toBe(123456);
  });

  // A lone separator followed by exactly three digits is ambiguous: 1,234 is a
  // thousands group in most of the world and 1.234 in the rest. Grouping wins,
  // because reading it as a decimal would silently divide the amount by a
  // thousand.
  it('treats a lone separator before exactly three digits as grouping', () => {
    expect(parseAmountInput('1,234', 'USD')).toBe(123400);
    expect(parseAmountInput('1.234', 'USD')).toBe(123400);
  });

  it('treats a repeated separator as grouping', () => {
    expect(parseAmountInput('1,234,567', 'USD')).toBe(123456700);
  });

  // Except where the currency actually has three decimals — then 1.234 is a
  // perfectly ordinary amount and grouping would be the wrong reading.
  it('reads three digits as decimals for a three-decimal currency', () => {
    expect(parseAmountInput('1.234', 'KWD')).toBe(1234);
  });

  it('uses the currency exponent rather than assuming two', () => {
    expect(parseAmountInput('1000', 'JPY')).toBe(1000);
    expect(parseAmountInput('1.5', 'KWD')).toBe(1500);
    expect(parseAmountInput('1.5', 'MGA')).toBe(15);
  });

  // The grouping rule applies uniformly, so this is twelve thousand and not a
  // rejected three-decimal amount. The field shows what it read back to the
  // user, which is what makes the convention safe to rely on.
  it('applies the grouping rule consistently', () => {
    expect(parseAmountInput('12.567', 'USD')).toBe(1256700);
  });

  // Rounding here would change the number the user typed without telling them.
  it('refuses more decimals than the currency has', () => {
    expect(parseAmountInput('12.5678', 'USD')).toBeNull();
    expect(parseAmountInput('10.5', 'JPY')).toBeNull();
  });

  it('refuses anything that is not a number', () => {
    expect(parseAmountInput('', 'USD')).toBeNull();
    expect(parseAmountInput('abc', 'USD')).toBeNull();
    expect(parseAmountInput('12.50.30', 'USD')).toBeNull();
    expect(parseAmountInput('1,2,3.45', 'USD')).toBeNull();
    expect(parseAmountInput('-', 'USD')).toBeNull();
  });

  // An expense is a positive amount; a refund is its own concept, not a
  // negative expense. The check constraint on the column agrees.
  it('refuses a negative amount', () => {
    expect(parseAmountInput('-12.50', 'USD')).toBeNull();
  });

  it('reads zero, leaving the schema to reject it', () => {
    expect(parseAmountInput('0', 'USD')).toBe(0);
  });

  // Floating point cannot represent 19.99, and 19.99 * 100 is 1998.9999...
  // Truncating that gives 1998 — a cent short, on an amount a person typed.
  it('does not lose a cent to floating point', () => {
    expect(parseAmountInput('19.99', 'USD')).toBe(1999);
    expect(parseAmountInput('1.10', 'USD')).toBe(110);
    expect(parseAmountInput('0.29', 'USD')).toBe(29);
    expect(parseAmountInput('8.11', 'USD')).toBe(811);
  });

  it('handles an amount larger than a float could hold exactly', () => {
    expect(parseAmountInput('99999999.99', 'USD')).toBe(9999999999);
  });
});

describe('formatMinorUnits', () => {
  it('renders with the currency exponent', () => {
    expect(formatMinorUnits(1250, 'USD')).toBe('12.50');
    expect(formatMinorUnits(1000, 'JPY')).toBe('1000');
    expect(formatMinorUnits(1234, 'KWD')).toBe('1.234');
  });

  it('pads the fraction', () => {
    expect(formatMinorUnits(5, 'USD')).toBe('0.05');
    expect(formatMinorUnits(50, 'USD')).toBe('0.50');
  });

  it('round-trips through parseAmountInput', () => {
    for (const [minor, currency] of [
      [1250, 'USD'],
      [1000, 'JPY'],
      [1234, 'KWD'],
      [5, 'USD'],
    ] as const) {
      expect(parseAmountInput(formatMinorUnits(minor, currency), currency)).toBe(minor);
    }
  });
});
