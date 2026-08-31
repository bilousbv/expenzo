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
  /*
   * The card and the subscriptions screen read the same rows through different
   * queries, so adding a subscription has to invalidate both — which it does
   * only while the narrower key sits under the broader one.
   */
  it('nests the upcoming-renewals key under the subscriptions key', () => {
    const all = queryKeys.subscriptions.all(HOUSEHOLD);
    const upcoming = queryKeys.subscriptions.upcoming(HOUSEHOLD, {
      from: '2026-08-29',
      to: '2026-09-05',
    });

    expect(upcoming.slice(0, all.length)).toEqual([...all]);
  });

  it('distinguishes one renewal window from another', () => {
    expect(
      queryKeys.subscriptions.upcoming(HOUSEHOLD, { from: '2026-08-29', to: '2026-09-05' }),
    ).not.toEqual(
      queryKeys.subscriptions.upcoming(HOUSEHOLD, { from: '2026-08-30', to: '2026-09-06' }),
    );
  });
  /*
   * The two taxonomies are fetched separately, so they need separate cache
   * entries — one key for both would serve the expense list to the
   * subscription picker.
   */
  it('keys each category taxonomy separately', () => {
    expect(queryKeys.categories.byKind(HOUSEHOLD, 'expense')).not.toEqual(
      queryKeys.categories.byKind(HOUSEHOLD, 'subscription'),
    );
  });

  // Adding a category has to refresh whichever list it belongs to, and one
  // invalidation covering both is simpler than deciding which.
  it('nests them under the categories key', () => {
    const all = queryKeys.categories.all(HOUSEHOLD);
    const byKind = queryKeys.categories.byKind(HOUSEHOLD, 'subscription');

    expect(byKind.slice(0, all.length)).toEqual([...all]);
  });
});

describe('subscription charge keys', () => {
  // Posting sits behind a query key so one visit posts once. Sharing the key
  // with the upcoming-renewals card would serve that card's rows to the poster
  // as soon as either had been read.
  it('is distinct from the upcoming-renewals key for the same window', () => {
    const window = { from: '2026-08-01', to: '2026-08-31' };

    expect(queryKeys.subscriptions.charges(HOUSEHOLD, window)).not.toEqual([
      ...queryKeys.subscriptions.upcoming(HOUSEHOLD, window),
    ]);
  });

  it('nests under the subscriptions key so one invalidation reaches it', () => {
    const all = queryKeys.subscriptions.all(HOUSEHOLD);
    const charges = queryKeys.subscriptions.charges(HOUSEHOLD, {
      from: '2026-08-01',
      to: '2026-08-31',
    });

    expect(charges.slice(0, all.length)).toEqual([...all]);
  });

  it('separates one period from another', () => {
    expect(
      queryKeys.subscriptions.charges(HOUSEHOLD, { from: '2026-07-01', to: '2026-07-31' }),
    ).not.toEqual([
      ...queryKeys.subscriptions.charges(HOUSEHOLD, { from: '2026-08-01', to: '2026-08-31' }),
    ]);
  });
});

describe('notification keys', () => {
  it('nests the inbox under the household so one invalidation reaches it', () => {
    const all = queryKeys.notifications.all(HOUSEHOLD);

    expect(queryKeys.notifications.inbox(HOUSEHOLD).slice(0, all.length)).toEqual([...all]);
    expect(queryKeys.notifications.pending(HOUSEHOLD).slice(0, all.length)).toEqual([...all]);
  });

  // Draining the queue and reading the inbox are different questions. Sharing a
  // key would serve the drain count to the list.
  it('separates draining from reading', () => {
    expect(queryKeys.notifications.pending(HOUSEHOLD)).not.toEqual([
      ...queryKeys.notifications.inbox(HOUSEHOLD),
    ]);
  });

  /*
   * Preferences sit outside the household prefix on purpose. What somebody
   * wants to be told about follows the person, not the household, so switching
   * household must not throw it away — and it is the one thing here that is
   * not household data at all.
   */
  it('keeps preferences out of the household prefix', () => {
    const preferences = queryKeys.notifications.preferences(HOUSEHOLD);

    expect(preferences[0]).not.toBe('notifications');
    expect(preferences).not.toContain(HOUSEHOLD.concat('-household'));
  });
});
