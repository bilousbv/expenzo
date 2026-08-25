import { describe, expect, it } from 'vitest';

import { queryKeys } from './keys';

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const MEMBER = '33333333-3333-4333-8333-333333333333';

describe('queryKeys', () => {
  // The household id is the second segment of every key on purpose: switching
  // household invalidates everything with one prefix, and no other household's
  // cached data can be reached.
  it('puts the household id second in every key', () => {
    expect(queryKeys.expenses.all(HOUSEHOLD)[1]).toBe(HOUSEHOLD);
    expect(queryKeys.categories.all(HOUSEHOLD)[1]).toBe(HOUSEHOLD);
    expect(queryKeys.households.current(HOUSEHOLD)[1]).toBe(HOUSEHOLD);
  });

  it('prefixes list keys with the collection key, so one invalidation covers both', () => {
    const all = queryKeys.expenses.all(HOUSEHOLD);
    const list = queryKeys.expenses.list(HOUSEHOLD, { memberId: MEMBER });

    expect(list.slice(0, all.length)).toEqual([...all]);
  });

  it('prefixes detail keys the same way', () => {
    const all = queryKeys.expenses.all(HOUSEHOLD);
    const byId = queryKeys.expenses.byId(HOUSEHOLD, 'abc');

    expect(byId.slice(0, all.length)).toEqual([...all]);
  });

  it('separates households completely', () => {
    expect(queryKeys.expenses.all(HOUSEHOLD)).not.toEqual(queryKeys.expenses.all(OTHER));
  });

  it('distinguishes filters', () => {
    expect(queryKeys.expenses.list(HOUSEHOLD, { memberId: MEMBER })).not.toEqual(
      queryKeys.expenses.list(HOUSEHOLD, { memberId: OTHER }),
    );
  });

  it('is stable for the same input', () => {
    expect(queryKeys.expenses.list(HOUSEHOLD, { memberId: MEMBER })).toEqual(
      queryKeys.expenses.list(HOUSEHOLD, { memberId: MEMBER }),
    );
  });
});
