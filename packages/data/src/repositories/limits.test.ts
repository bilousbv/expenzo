import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../types';
import { createLimit, deleteLimit, listLimits, updateLimit } from './limits';

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const CATEGORY = '33333333-3333-4333-8333-333333333333';
const LIMIT = '44444444-4444-4444-8444-444444444444';

interface Recorder {
  table?: string;
  inserted?: Record<string, unknown>;
  updated?: Record<string, unknown>;
  deleted?: boolean;
  filters: Array<[string, unknown]>;
}

function fakeDb(result: { data: unknown; error: { message: string; code?: string } | null }) {
  const recorder: Recorder = { filters: [] };

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
    delete() {
      recorder.deleted = true;
      return builder;
    },
    eq(column: string, value: unknown) {
      recorder.filters.push([column, value]);
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
  id: LIMIT,
  household_id: HOUSEHOLD,
  category_id: CATEGORY,
  amount_minor: 50000,
  period: 'monthly' as const,
};

describe('listLimits', () => {
  // Row-level security already scopes this to the caller's household, so a
  // filter here could only narrow it further.
  it('applies no household filter of its own', async () => {
    const { db, recorder } = fakeDb({ data: [row], error: null });

    await listLimits(db);

    expect(recorder.table).toBe('spending_limits');
    expect(recorder.filters).toHaveLength(0);
  });

  it('returns an empty list rather than null', async () => {
    const { db } = fakeDb({ data: null, error: null });

    await expect(listLimits(db)).resolves.toEqual([]);
  });
});

describe('createLimit', () => {
  it('names the household and the creator, which the policy checks', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await createLimit(db, HOUSEHOLD, USER, { categoryId: CATEGORY, amountMinor: 50000 });

    expect(recorder.inserted?.household_id).toBe(HOUSEHOLD);
    expect(recorder.inserted?.created_by).toBe(USER);
  });

  // The household-wide limit is the row with no category, and that has to be a
  // NULL column rather than a missing key.
  it('writes an absent category as null', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await createLimit(db, HOUSEHOLD, USER, { amountMinor: 200000 });

    expect(recorder.inserted?.category_id).toBeNull();
  });

  it('defaults the period to monthly', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await createLimit(db, HOUSEHOLD, USER, { amountMinor: 200000 });

    expect(recorder.inserted?.period).toBe('monthly');
  });

  it('validates through the shared schema', async () => {
    const { db } = fakeDb({ data: row, error: null });

    await expect(createLimit(db, HOUSEHOLD, USER, { amountMinor: 0 })).rejects.toThrow();
  });

  // Hitting the unique index means a limit already exists, which is something
  // to change rather than a failure the user can act on as stated.
  it('translates a duplicate into an instruction', async () => {
    const { db } = fakeDb({
      data: null,
      error: { message: 'duplicate key value violates unique constraint', code: '23505' },
    });

    await expect(
      createLimit(db, HOUSEHOLD, USER, { categoryId: CATEGORY, amountMinor: 50000 }),
    ).rejects.toThrow(/change it instead/i);
  });
});

describe('updateLimit', () => {
  it('changes the amount', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await updateLimit(db, { id: LIMIT, amountMinor: 60000 });

    expect(recorder.updated?.amount_minor).toBe(60000);
    expect(recorder.filters).toContainEqual(['id', LIMIT]);
  });

  // Moving a limit between categories is indistinguishable from setting a
  // different limit, and would slip past the unique index.
  it('never moves a limit to another category', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await updateLimit(db, { id: LIMIT, amountMinor: 60000 });

    expect(recorder.updated).not.toHaveProperty('category_id');
  });

  it('rejects a limit of zero', async () => {
    const { db } = fakeDb({ data: row, error: null });

    await expect(updateLimit(db, { id: LIMIT, amountMinor: 0 })).rejects.toThrow();
  });
});

describe('deleteLimit', () => {
  // Unlike a category, nothing references a limit — removing one means "there
  // is no limit here" rather than losing a record of anything.
  it('deletes rather than archiving', async () => {
    const { db, recorder } = fakeDb({ data: null, error: null });

    await deleteLimit(db, LIMIT);

    expect(recorder.deleted).toBe(true);
    expect(recorder.filters).toContainEqual(['id', LIMIT]);
  });
});
