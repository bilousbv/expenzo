import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_KINDS,
  SETTABLE_KINDS,
  notificationKindSchema,
  parseLimitBreach,
} from './notification';

const LIMIT = '11111111-1111-4111-8111-111111111111';
const CATEGORY = '22222222-2222-4222-8222-222222222222';

function breach(overrides: Record<string, unknown> = {}) {
  return {
    limit_id: LIMIT,
    category_id: CATEGORY,
    amount_minor: 10000,
    spent_minor: 16000,
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    ...overrides,
  };
}

describe('notification kinds', () => {
  it('knows every kind the database enum carries', () => {
    expect([...NOTIFICATION_KINDS]).toEqual(['limit_exceeded', 'renewal_upcoming', 'trial_ending']);
  });

  /*
   * The database enum is seeded with kinds nothing produces yet, because
   * Postgres refuses to use an enum value in the transaction that added it.
   * The preferences screen is not: a switch for something that cannot happen
   * is a promise the app does not keep.
   */
  it('offers a switch only for the kinds that are actually sent', () => {
    expect([...SETTABLE_KINDS]).toEqual(['limit_exceeded']);
    for (const kind of SETTABLE_KINDS) {
      expect(notificationKindSchema.safeParse(kind).success).toBe(true);
    }
  });

  it('rejects a kind that is not one of them', () => {
    expect(notificationKindSchema.safeParse('budget_doubled').success).toBe(false);
  });
});

describe('parseLimitBreach', () => {
  it('reads the limits a purchase broke', () => {
    const payload = parseLimitBreach({ limits: [breach()] });

    expect(payload?.limits).toHaveLength(1);
    expect(payload?.limits[0]?.spent_minor).toBe(16000);
  });

  // One purchase can cross a category limit and the household-wide one at the
  // same time, and it is announced as a single event naming both.
  it('reads several at once', () => {
    const payload = parseLimitBreach({
      limits: [breach(), breach({ limit_id: CATEGORY, category_id: null })],
    });

    expect(payload?.limits).toHaveLength(2);
    expect(payload?.limits[1]?.category_id).toBeNull();
  });

  // Null is the household-wide limit, the same distinction the column carries.
  // There is no sentinel id, because any uuid meaning "everything" could one
  // day belong to a real category.
  it('accepts a null category as the household-wide limit', () => {
    expect(parseLimitBreach({ limits: [breach({ category_id: null })] })).not.toBeNull();
  });

  /*
   * Null rather than a throw. These rows are written by a trigger and read
   * months later by a screen, so one payload written by an older version must
   * be skippable — taking the whole inbox down because of a single row is the
   * worse failure.
   */
  it('returns null for a payload it does not understand', () => {
    expect(parseLimitBreach({ limits: [] })).toBeNull();
    expect(parseLimitBreach({ limits: [{ limit_id: 'not-a-uuid' }] })).toBeNull();
    expect(parseLimitBreach({})).toBeNull();
    expect(parseLimitBreach(null)).toBeNull();
  });
});
