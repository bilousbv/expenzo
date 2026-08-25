import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../types';
import { createExpense, deleteExpense, listExpenses, type ExpenseRow } from './expenses';

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const CATEGORY = '33333333-3333-4333-8333-333333333333';

interface Recorder {
  table?: string;
  inserted?: Record<string, unknown>;
  updated?: Record<string, unknown>;
  filters: Array<[string, string, unknown]>;
  orders: Array<[string, boolean | undefined]>;
  limit?: number;
  or?: string;
}

function fakeDb(result: { data: unknown; error: { message: string } | null }) {
  const recorder: Recorder = { filters: [], orders: [] };

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
      recorder.filters.push(['eq', column, value]);
      return builder;
    },
    is(column: string, value: unknown) {
      recorder.filters.push(['is', column, value]);
      return builder;
    },
    gte(column: string, value: unknown) {
      recorder.filters.push(['gte', column, value]);
      return builder;
    },
    lte(column: string, value: unknown) {
      recorder.filters.push(['lte', column, value]);
      return builder;
    },
    or(expression: string) {
      recorder.or = expression;
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

function row(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  return {
    id: 'e1',
    household_id: HOUSEHOLD,
    created_by: USER,
    direction: 'spend',
    amount_minor: 1250,
    currency: 'USD',
    base_amount_minor: 1250,
    category_id: CATEGORY,
    merchant: 'Blue Bottle',
    note: null,
    occurred_on: '2026-08-25',
    ...overrides,
  };
}

describe('listExpenses', () => {
  it('hides soft-deleted rows', async () => {
    const { db, recorder } = fakeDb({ data: [row()], error: null });

    await listExpenses(db, {});

    expect(recorder.filters).toContainEqual(['is', 'deleted_at', null]);
  });

  // The index is (household_id, occurred_on desc), and row-level security
  // already restricts the household, so this ordering is what it can serve.
  it('orders newest first, breaking ties by id', async () => {
    const { db, recorder } = fakeDb({ data: [row()], error: null });

    await listExpenses(db, {});

    expect(recorder.orders).toEqual([
      ['occurred_on', false],
      ['id', false],
    ]);
  });

  it('filters by date range', async () => {
    const { db, recorder } = fakeDb({ data: [row()], error: null });

    await listExpenses(db, { from: '2026-08-01', to: '2026-08-31' });

    expect(recorder.filters).toContainEqual(['gte', 'occurred_on', '2026-08-01']);
    expect(recorder.filters).toContainEqual(['lte', 'occurred_on', '2026-08-31']);
  });

  it('filters by category and member', async () => {
    const { db, recorder } = fakeDb({ data: [row()], error: null });

    await listExpenses(db, { categoryId: CATEGORY, memberId: USER });

    expect(recorder.filters).toContainEqual(['eq', 'category_id', CATEGORY]);
    expect(recorder.filters).toContainEqual(['eq', 'created_by', USER]);
  });

  // Every member sees every expense, so the author filter narrows the list
  // rather than deciding what is reachable. There is no scope any more.
  it('never filters on visibility, which no longer exists', async () => {
    const { db, recorder } = fakeDb({ data: [row()], error: null });

    await listExpenses(db, { memberId: USER });

    expect(recorder.filters.some(([, column]) => column === 'visibility')).toBe(false);
  });

  // Keyset, not OFFSET. Over an RLS-filtered table offset degrades badly, and
  // it silently skips rows when somebody else inserts while you are paging.
  it('pages from a cursor rather than an offset', async () => {
    const { db, recorder } = fakeDb({ data: [row()], error: null });

    await listExpenses(db, {}, { occurredOn: '2026-08-20', id: 'e9' });

    expect(recorder.or).toBe('occurred_on.lt.2026-08-20,and(occurred_on.eq.2026-08-20,id.lt.e9)');
  });

  it('asks for one row more than the page, to know whether there is another', async () => {
    const { db, recorder } = fakeDb({ data: [row()], error: null });

    await listExpenses(db, {}, undefined, 20);

    expect(recorder.limit).toBe(21);
  });

  it('reports no next cursor when the page is not full', async () => {
    const { db } = fakeDb({ data: [row({ id: 'a' })], error: null });

    const page = await listExpenses(db, {}, undefined, 20);

    expect(page.rows).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it('trims the extra row and returns a cursor when there is more', async () => {
    const rows = [row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c', occurred_on: '2026-08-01' })];
    const { db } = fakeDb({ data: rows, error: null });

    const page = await listExpenses(db, {}, undefined, 2);

    expect(page.rows.map((r) => r.id)).toEqual(['a', 'b']);
    // The cursor is the last row of the page, not the row that was trimmed.
    expect(page.nextCursor).toEqual({ occurredOn: '2026-08-25', id: 'b' });
  });

  it('throws the database message', async () => {
    const { db } = fakeDb({ data: null, error: { message: 'JWT expired' } });

    await expect(listExpenses(db, {})).rejects.toThrow('JWT expired');
  });
});

describe('createExpense', () => {
  const input = {
    amountMinor: 1250,
    currency: 'USD',
    occurredOn: '2026-08-25',
    categoryId: CATEGORY,
    merchant: 'Blue Bottle',
  };

  it('names the household and the creator, which the policy checks', async () => {
    const { db, recorder } = fakeDb({ data: row(), error: null });

    await createExpense(db, HOUSEHOLD, USER, input);

    expect(recorder.inserted?.household_id).toBe(HOUSEHOLD);
    expect(recorder.inserted?.created_by).toBe(USER);
  });

  // Until M1.8 there is no rate table, so an expense is recorded in the
  // household's own currency at a rate of one. base_amount_minor is not null,
  // so it has to be written either way.
  it('sets the base amount equal to the amount at a rate of one', async () => {
    const { db, recorder } = fakeDb({ data: row(), error: null });

    await createExpense(db, HOUSEHOLD, USER, input);

    expect(recorder.inserted?.base_amount_minor).toBe(1250);
    expect(recorder.inserted?.fx_rate).toBe(1);
  });

  it('validates through the shared schema', async () => {
    const { db } = fakeDb({ data: row(), error: null });

    await expect(
      createExpense(db, HOUSEHOLD, USER, { ...input, amountMinor: 0 }),
    ).rejects.toThrow();
  });

  it('never writes the columns the trigger owns', async () => {
    const { db, recorder } = fakeDb({ data: row(), error: null });

    await createExpense(db, HOUSEHOLD, USER, input);

    expect(recorder.inserted).not.toHaveProperty('dedup_fingerprint');
    expect(recorder.inserted).not.toHaveProperty('merchant_normalized');
  });

  it('stores an absent category as null rather than undefined', async () => {
    const { db, recorder } = fakeDb({ data: row(), error: null });

    await createExpense(db, HOUSEHOLD, USER, { ...input, categoryId: undefined });

    expect(recorder.inserted?.category_id).toBeNull();
  });
});

describe('deleteExpense', () => {
  // Soft delete: the audit trigger records it, every partial index excludes
  // deleted_at, and a household total that silently changes because a row
  // vanished is not something anyone can reconstruct afterwards.
  it('stamps deleted_at rather than removing the row', async () => {
    const { db, recorder } = fakeDb({ data: row(), error: null });

    await deleteExpense(db, 'e1');

    expect(recorder.updated).toHaveProperty('deleted_at');
    expect(recorder.updated?.deleted_at).not.toBeNull();
    expect(recorder.filters).toContainEqual(['eq', 'id', 'e1']);
  });
});
