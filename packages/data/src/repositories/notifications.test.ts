import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../types';
import {
  deliverNotifications,
  listNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setNotificationPreference,
} from './notifications';

const USER = '22222222-2222-4222-8222-222222222222';
const DELIVERY = '33333333-3333-4333-8333-333333333333';

interface Recorder {
  table?: string;
  columns?: string;
  updated?: Record<string, unknown>;
  upserted?: Record<string, unknown>;
  upsertOptions?: Record<string, unknown>;
  filters: Array<[string, string, unknown]>;
  orders: Array<[string, boolean | undefined]>;
  limit?: number;
}

function fakeDb(result: { data: unknown; error: { message: string } | null }) {
  const recorder: Recorder = { filters: [], orders: [] };

  const builder = {
    select(columns?: string) {
      if (columns) recorder.columns = columns;
      return builder;
    },
    update(values: Record<string, unknown>) {
      recorder.updated = values;
      return builder;
    },
    upsert(values: Record<string, unknown>, options?: Record<string, unknown>) {
      recorder.upserted = values;
      recorder.upsertOptions = options;
      return builder;
    },
    eq(column: string, value: unknown) {
      recorder.filters.push(['eq', column, value]);
      return builder;
    },
    is(column: string, value: unknown) {
      recorder.filters.push(['is', column, value]);
      return builder;
    },
    order(column: string, options?: { ascending?: boolean }) {
      recorder.orders.push([column, options?.ascending]);
      return builder;
    },
    limit(count: number) {
      recorder.limit = count;
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

const delivery = {
  id: DELIVERY,
  created_at: '2026-08-31T09:00:00+00:00',
  read_at: null,
  job: { kind: 'limit_exceeded', payload: { limits: [] } },
};

describe('listNotifications', () => {
  it('reads the inbox newest first', async () => {
    const { db, recorder } = fakeDb({ data: [delivery], error: null });

    await listNotifications(db);

    expect(recorder.table).toBe('notification_deliveries');
    expect(recorder.orders).toContainEqual(['created_at', false]);
  });

  /*
   * A suppressed delivery is recorded so that "why did I not get a
   * notification?" stays answerable, but it is not an item in somebody's
   * inbox — showing it would be the app announcing what it deliberately
   * did not announce.
   */
  it('shows only what was actually sent', async () => {
    const { db, recorder } = fakeDb({ data: [delivery], error: null });

    await listNotifications(db);

    expect(recorder.filters).toContainEqual(['eq', 'status', 'sent']);
  });

  // Row-level security scopes deliveries to the caller, so no user filter is
  // applied here — one would only restate what the policy already guarantees.
  it('applies no user filter of its own', async () => {
    const { db, recorder } = fakeDb({ data: [delivery], error: null });

    await listNotifications(db);

    expect(recorder.filters.some(([, column]) => column === 'user_id')).toBe(false);
  });

  it('flattens the job onto the delivery', async () => {
    const { db } = fakeDb({ data: [delivery], error: null });

    const rows = await listNotifications(db);

    expect(rows[0]).toMatchObject({ id: DELIVERY, kind: 'limit_exceeded', readAt: null });
  });

  it('takes a page size', async () => {
    const { db, recorder } = fakeDb({ data: [delivery], error: null });

    await listNotifications(db, 5);

    expect(recorder.limit).toBe(5);
  });

  it('throws the database message', async () => {
    const { db } = fakeDb({ data: null, error: { message: 'JWT expired' } });

    await expect(listNotifications(db)).rejects.toThrow('JWT expired');
  });
});

describe('markNotificationRead', () => {
  it('stamps the row rather than deleting it', async () => {
    const { db, recorder } = fakeDb({ data: null, error: null });

    await markNotificationRead(db, DELIVERY);

    expect(recorder.updated).toHaveProperty('read_at');
    expect(recorder.filters).toContainEqual(['eq', 'id', DELIVERY]);
  });
});

describe('markAllNotificationsRead', () => {
  // Only the unread ones, so re-reading the inbox does not rewrite a timestamp
  // that already says when something was first seen.
  it('touches only what is still unread', async () => {
    const { db, recorder } = fakeDb({ data: null, error: null });

    await markAllNotificationsRead(db);

    expect(recorder.filters).toContainEqual(['is', 'read_at', null]);
  });
});

describe('deliverNotifications', () => {
  it('drains the queue through the function that owns the rules', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: 2, error: null }));
    const db = { rpc } as unknown as Db;

    await expect(deliverNotifications(db)).resolves.toBe(2);
    expect(rpc).toHaveBeenCalledWith('deliver_notifications');
  });

  // Nothing queued is the ordinary outcome on almost every load, not a failure.
  it('reports an empty queue as zero rather than as null', async () => {
    const db = { rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) } as unknown as Db;

    await expect(deliverNotifications(db)).resolves.toBe(0);
  });
});

describe('notification preferences', () => {
  it('reads the caller rows', async () => {
    const { db, recorder } = fakeDb({ data: [], error: null });

    await listNotificationPreferences(db);

    expect(recorder.table).toBe('notification_preferences');
  });

  /*
   * Upsert, because an absent row means "everything on". Nothing is created
   * when somebody joins and no backfill is needed when a kind is added, so the
   * first time anybody touches a switch is also the first time a row exists.
   */
  it('creates the row the first time a switch is touched', async () => {
    const { db, recorder } = fakeDb({ data: null, error: null });

    await setNotificationPreference(db, USER, 'limit_exceeded', { inApp: false });

    expect(recorder.upserted).toMatchObject({
      user_id: USER,
      kind: 'limit_exceeded',
      in_app_enabled: false,
    });
    expect(recorder.upsertOptions).toMatchObject({ onConflict: 'user_id,kind' });
  });

  it('leaves the other channel alone when only one is given', async () => {
    const { db, recorder } = fakeDb({ data: null, error: null });

    await setNotificationPreference(db, USER, 'limit_exceeded', { push: false });

    expect(recorder.upserted).not.toHaveProperty('in_app_enabled');
    expect(recorder.upserted).toMatchObject({ push_enabled: false });
  });
});
