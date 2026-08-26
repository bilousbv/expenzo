import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../types';
import {
  cancelSubscription,
  createSubscription,
  deleteSubscription,
  listServices,
  listSubscriptions,
  updateSubscription,
} from './subscriptions';

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const SUBSCRIPTION = '44444444-4444-4444-8444-444444444444';

interface Recorder {
  table?: string;
  inserted?: Record<string, unknown>;
  updated?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
  orders: string[];
  nullFilters: Array<[string, unknown]>;
}

function fakeDb(result: { data: unknown; error: { message: string; code?: string } | null }) {
  const recorder: Recorder = { filters: [], orders: [], nullFilters: [] };

  const builder = {
    select: () => builder,
    insert(values: Record<string, unknown>) {
      recorder.inserted = values;
      return builder;
    },
    update(values: Record<string, unknown>) {
      recorder.updated = values;
      return builder;
    },
    eq(column: string, value: unknown) {
      recorder.filters.push([column, value]);
      return builder;
    },
    is(column: string, value: unknown) {
      recorder.nullFilters.push([column, value]);
      return builder;
    },
    order(column: string) {
      recorder.orders.push(column);
      return builder;
    },
    single: () => Promise.resolve(result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };

  const db = {
    from: vi.fn((table: string) => {
      recorder.table = table;
      return builder;
    }),
  };

  return { db: db as unknown as Db, recorder };
}

const row = {
  id: SUBSCRIPTION,
  household_id: HOUSEHOLD,
  created_by: USER,
  service_id: null,
  name: 'Netflix',
  amount_minor: 1599,
  currency: 'USD',
  cadence: 'monthly' as const,
  interval_count: 1,
  anchor_day: 12,
  started_on: '2026-01-12',
  next_renewal_on: '2026-09-12',
  category_id: null,
  status: 'active' as const,
  notes: null,
};

const input = {
  name: 'Netflix',
  amountMinor: 1599,
  currency: 'USD',
  cadence: 'monthly' as const,
  anchorDay: 12,
  startedOn: '2026-01-12',
};

describe('listSubscriptions', () => {
  it('applies no household filter of its own', async () => {
    const { db, recorder } = fakeDb({ data: [row], error: null });

    await listSubscriptions(db);

    expect(recorder.table).toBe('subscriptions');
    expect(recorder.filters).toEqual([]);
  });

  it('leaves out the soft-deleted ones', async () => {
    const { db, recorder } = fakeDb({ data: [row], error: null });

    await listSubscriptions(db);

    expect(recorder.nullFilters).toContainEqual(['deleted_at', null]);
  });

  // Cancelled ones are history, and a repository that hid them would make
  // "what did we used to pay for" unanswerable.
  it('does not filter cancelled ones out', async () => {
    const { db, recorder } = fakeDb({ data: [row], error: null });

    await listSubscriptions(db);

    expect(recorder.filters.map(([column]) => column)).not.toContain('status');
  });

  it('orders by what is due soonest', async () => {
    const { db, recorder } = fakeDb({ data: [row], error: null });

    await listSubscriptions(db);

    expect(recorder.orders).toContain('next_renewal_on');
  });

  it('throws the message rather than returning an error object', async () => {
    const { db } = fakeDb({ data: null, error: { message: 'permission denied' } });

    await expect(listSubscriptions(db)).rejects.toThrow(/permission denied/);
  });
});

describe('listServices', () => {
  it('reads the catalogue', async () => {
    const { db, recorder } = fakeDb({ data: [], error: null });

    await listServices(db);

    expect(recorder.table).toBe('service_catalogue');
  });
});

describe('createSubscription', () => {
  it('sends the household and author the insert policy checks', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await createSubscription(db, HOUSEHOLD, USER, input);

    expect(recorder.inserted).toMatchObject({ household_id: HOUSEHOLD, created_by: USER });
  });

  /**
   * The whole reason the column is trigger-owned. The upcoming-renewals card
   * reads it, so a client that computes it wrongly — or lies — puts a charge
   * in front of somebody on the wrong day.
   */
  it('never sends a next renewal date', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await createSubscription(db, HOUSEHOLD, USER, input);

    expect(recorder.inserted).not.toHaveProperty('next_renewal_on');
  });

  it('defaults the interval count and the status', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await createSubscription(db, HOUSEHOLD, USER, input);

    expect(recorder.inserted).toMatchObject({ interval_count: 1, status: 'active' });
  });

  // A missing optional is a NULL column rather than an absent one, or
  // PostgREST leaves the previous value in place on an upsert.
  it('sends nulls rather than omitting the optional columns', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await createSubscription(db, HOUSEHOLD, USER, input);

    expect(recorder.inserted).toMatchObject({
      service_id: null,
      category_id: null,
      notes: null,
    });
  });

  it('refuses input the schema rejects, before reaching the database', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await expect(
      createSubscription(db, HOUSEHOLD, USER, { ...input, anchorDay: 32 }),
    ).rejects.toThrow();
    expect(recorder.inserted).toBeUndefined();
  });
});

describe('updateSubscription', () => {
  it('sends only what changed', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await updateSubscription(db, { id: SUBSCRIPTION, amountMinor: 1799 });

    expect(recorder.updated).toHaveProperty('amount_minor', 1799);
    expect(recorder.updated).not.toHaveProperty('name');
  });

  it('targets the row by id', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await updateSubscription(db, { id: SUBSCRIPTION, amountMinor: 1799 });

    expect(recorder.filters).toContainEqual(['id', SUBSCRIPTION]);
  });

  // Changing the schedule must not carry a stale renewal date with it; the
  // trigger recomputes, and sending one would only be overwritten anyway.
  it('never sends a next renewal date either', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await updateSubscription(db, { id: SUBSCRIPTION, cadence: 'yearly' });

    expect(recorder.updated).not.toHaveProperty('next_renewal_on');
  });
});

describe('cancelSubscription', () => {
  it('sets the status rather than removing the row', async () => {
    const { db, recorder } = fakeDb({ data: { ...row, status: 'cancelled' }, error: null });

    await cancelSubscription(db, SUBSCRIPTION);

    expect(recorder.updated).toHaveProperty('status', 'cancelled');
  });
});

describe('deleteSubscription', () => {
  it('stamps deleted_at rather than issuing a delete', async () => {
    const { db, recorder } = fakeDb({ data: null, error: null });

    await deleteSubscription(db, SUBSCRIPTION);

    expect(recorder.updated).toHaveProperty('deleted_at');
    expect(recorder.filters).toContainEqual(['id', SUBSCRIPTION]);
  });
});
