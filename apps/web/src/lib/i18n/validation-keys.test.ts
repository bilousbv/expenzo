import {
  createCategoryInput,
  createExpenseInput,
  createLimitInput,
  credentialsSchema,
  expenseFilter,
  registrationSchema,
  VALIDATION_PARAMS,
} from '@expenzo/domain';
import { createI18n, locales } from '@expenzo/i18n';
import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';

/**
 * The schemas in packages/domain return translation keys instead of prose, so
 * that the package stays free of locale. Nothing else checks that the keys they
 * return actually exist: a typo produces no error anywhere, it just renders
 * `validation.amount.positiv` to the user where the message should be.
 *
 * This is the seam between two packages that cannot import each other's tests,
 * and it lives here because this app depends on both.
 */
function issueKeys(schema: ZodType, value: unknown): string[] {
  const parsed = schema.safeParse(value);

  // A case that parses cleanly proves nothing and is almost certainly a
  // mistake in the table below rather than a schema that cannot fail.
  expect(parsed.success, `expected ${JSON.stringify(value)} to be rejected`).toBe(false);

  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
}

const REJECTED: [string, ZodType, unknown][] = [
  ['credentials, empty', credentialsSchema, { email: '', password: '' }],
  ['credentials, not an address', credentialsSchema, { email: 'nope', password: 'x' }],
  [
    'credentials, password over 72 bytes',
    credentialsSchema,
    { email: 'a@b.co', password: 'ї'.repeat(40) },
  ],
  [
    'registration, mismatched confirmation',
    registrationSchema,
    { email: 'a@b.co', password: 'correct-horse', confirmPassword: 'something-else' },
  ],
  [
    'expense, everything wrong at once',
    createExpenseInput,
    { amountMinor: -1.5, currency: 'usd', occurredOn: '2026-02-31', categoryId: 'nope' },
  ],
  [
    'expense, date that is not a date',
    createExpenseInput,
    { amountMinor: 100, currency: 'USD', occurredOn: 'yesterday' },
  ],
  ['category, blank name', createCategoryInput, { name: '', color: '#337dff' }],
  ['category, punctuation only', createCategoryInput, { name: '---', color: '#337dff' }],
  ['category, bad colour', createCategoryInput, { name: 'Coffee', color: 'blue' }],
  ['limit, zero', createLimitInput, { amountMinor: 0, period: 'monthly' }],
  ['filter, reversed range', expenseFilter, { from: '2026-08-31', to: '2026-08-01' }],
];

describe('every validation key a schema emits', () => {
  const catalogues = locales.map((locale) => [locale, createI18n(locale)] as const);

  it.each(REJECTED)('%s', (_name, schema, value) => {
    const keys = issueKeys(schema, value);

    expect(keys.length).toBeGreaterThan(0);

    for (const key of keys) {
      // A key shaped like one but absent from the catalogue comes back as
      // itself, which is exactly what the user would see on screen.
      for (const [locale, i18n] of catalogues) {
        expect(i18n.t(key, VALIDATION_PARAMS), `${key} is missing from ${locale}`).not.toBe(key);
      }
    }
  });

  // Interpolation is the other half: a key that resolves but still shows
  // {{min}} is no better than a missing one.
  it('leaves no placeholder unfilled', () => {
    for (const [, i18n] of catalogues) {
      for (const [, schema, value] of REJECTED) {
        for (const key of issueKeys(schema, value)) {
          expect(i18n.t(key, VALIDATION_PARAMS)).not.toContain('{{');
        }
      }
    }
  });
});
