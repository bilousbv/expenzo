import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../types';
import {
  archiveCategory,
  createCategory,
  listCategories,
  updateCategory,
  type CategoryRow,
} from './categories';

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111';
const CATEGORY = '22222222-2222-4222-8222-222222222222';

interface Recorder {
  table?: string;
  columns?: string;
  inserted?: Record<string, unknown>;
  updated?: Record<string, unknown>;
  filters: Array<[string, string, unknown]>;
  orders: Array<[string, boolean | undefined]>;
}

/**
 * A stand-in for the PostgREST builder.
 *
 * The repositories are pure functions of the client, so the seam is the query
 * they build. Asserting on that catches a wrong column or a missing filter,
 * which is exactly the class of mistake row-level security turns into an empty
 * list rather than an error.
 */
function fakeDb(result: { data: unknown; error: { message: string } | null }) {
  const recorder: Recorder = { filters: [], orders: [] };

  const builder = {
    select(columns: string) {
      recorder.columns = columns;
      return builder;
    },
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
    order(column: string, options?: { ascending?: boolean }) {
      recorder.orders.push([column, options?.ascending]);
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

const row: CategoryRow = {
  id: CATEGORY,
  household_id: null,
  kind: 'expense',
  slug: 'groceries',
  name: 'Groceries',
  icon: 'shopping-cart',
  color: '#337dff',
  parent_id: null,
  is_system: true,
  sort_order: 10,
  archived_at: null,
};

describe('listCategories', () => {
  it('reads from categories', async () => {
    const { db, recorder } = fakeDb({ data: [row], error: null });

    await listCategories(db);

    expect(recorder.table).toBe('categories');
  });

  // Row-level security already limits this to system categories plus the
  // caller's own household, so no household filter is applied here. Adding one
  // would only be able to narrow it further, never widen it.
  it('applies no household filter of its own', async () => {
    const { db, recorder } = fakeDb({ data: [row], error: null });

    await listCategories(db);

    expect(recorder.filters.some(([, column]) => column === 'household_id')).toBe(false);
  });

  it('hides archived categories', async () => {
    const { db, recorder } = fakeDb({ data: [row], error: null });

    await listCategories(db);

    expect(recorder.filters).toContainEqual(['is', 'archived_at', null]);
  });

  it('orders by sort order and then name, so the list is stable', async () => {
    const { db, recorder } = fakeDb({ data: [row], error: null });

    await listCategories(db);

    expect(recorder.orders).toEqual([
      ['sort_order', undefined],
      ['name', undefined],
    ]);
  });

  it('returns the rows', async () => {
    const { db } = fakeDb({ data: [row], error: null });

    await expect(listCategories(db)).resolves.toEqual([row]);
  });

  it('returns an empty array rather than null when there is nothing', async () => {
    const { db } = fakeDb({ data: null, error: null });

    await expect(listCategories(db)).resolves.toEqual([]);
  });

  it('throws the database message', async () => {
    const { db } = fakeDb({ data: null, error: { message: 'permission denied' } });

    await expect(listCategories(db)).rejects.toThrow('permission denied');
  });
});

describe('createCategory', () => {
  it('derives the slug from the name', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await createCategory(db, HOUSEHOLD, { name: 'Dining Out', sortOrder: 500 });

    expect(recorder.inserted?.slug).toBe('dining-out');
  });

  // The insert has to name the household explicitly: the WITH CHECK on the
  // policy compares it, and there is no column default to fall back on.
  it('sets the household id', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await createCategory(db, HOUSEHOLD, { name: 'Coffee', sortOrder: 500 });

    expect(recorder.inserted?.household_id).toBe(HOUSEHOLD);
  });

  it('validates through the shared schema', async () => {
    const { db } = fakeDb({ data: row, error: null });

    await expect(createCategory(db, HOUSEHOLD, { name: '  ', sortOrder: 500 })).rejects.toThrow();
  });

  it('never writes is_system, which is a generated column', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await createCategory(db, HOUSEHOLD, { name: 'Coffee', sortOrder: 500 });

    expect(recorder.inserted).not.toHaveProperty('is_system');
  });

  // Two members adding "Coffee" at the same time both pass validation and one
  // loses on the unique index. 23505 is not a bug the user can act on, so it is
  // translated rather than surfaced raw.
  it('translates a duplicate slug into a message about the name', async () => {
    const { db } = fakeDb({
      data: null,
      error: { message: 'duplicate key value violates unique constraint', code: '23505' } as never,
    });

    await expect(createCategory(db, HOUSEHOLD, { name: 'Coffee', sortOrder: 500 })).rejects.toThrow(
      /already/i,
    );
  });
});

describe('updateCategory', () => {
  it('updates only the fields it was given', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await updateCategory(db, { id: CATEGORY, name: 'Coffee beans' });

    expect(recorder.updated).toEqual({ name: 'Coffee beans' });
  });

  it('targets the row by id', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await updateCategory(db, { id: CATEGORY, name: 'Coffee beans' });

    expect(recorder.filters).toContainEqual(['eq', 'id', CATEGORY]);
  });

  it('never writes the slug, which is frozen at creation', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await updateCategory(db, { id: CATEGORY, name: 'Coffee beans' });

    expect(recorder.updated).not.toHaveProperty('slug');
  });

  it('rejects an update with nothing in it, rather than issuing an empty write', async () => {
    const { db } = fakeDb({ data: row, error: null });

    await expect(updateCategory(db, { id: CATEGORY })).rejects.toThrow(/nothing to update/i);
  });
});

describe('archiveCategory', () => {
  // Deleting sets expenses.category_id to NULL, which silently uncategorises
  // history. Archiving keeps every past expense attributed while removing the
  // category from the picker.
  it('stamps archived_at instead of deleting', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await archiveCategory(db, CATEGORY);

    expect(recorder.table).toBe('categories');
    expect(recorder.updated).toHaveProperty('archived_at');
    expect(recorder.updated?.archived_at).not.toBeNull();
  });

  it('targets the row by id', async () => {
    const { db, recorder } = fakeDb({ data: row, error: null });

    await archiveCategory(db, CATEGORY);

    expect(recorder.filters).toContainEqual(['eq', 'id', CATEGORY]);
  });
});

describe('the two taxonomies', () => {
  /*
   * A picker asks for one kind. Without the filter the subscription form would
   * offer "Groceries" and the expense form "Cloud storage", which is the state
   * this split exists to end.
   */
  it('asks for one kind at a time', async () => {
    const { db, recorder } = fakeDb({ data: [], error: null });

    await listCategories(db, 'subscription');

    expect(recorder.filters).toContainEqual(['eq', 'kind', 'subscription']);
  });

  // Every caller that predates the split means an expense category, and there
  // are several — the dashboard rollup, the expense form, the category screen.
  it('defaults to expense categories', async () => {
    const { db, recorder } = fakeDb({ data: [], error: null });

    await listCategories(db);

    expect(recorder.filters).toContainEqual(['eq', 'kind', 'expense']);
  });

  it('reads the kind back, so a screen can tell which list a row is in', async () => {
    const { db, recorder } = fakeDb({ data: [], error: null });

    await listCategories(db);

    expect(recorder.columns).toContain('kind');
  });

  it('files a new category under the kind it was created in', async () => {
    const { db, recorder } = fakeDb({ data: null, error: null });

    await createCategory(db, HOUSEHOLD, { name: 'Streaming', kind: 'subscription' });

    expect(recorder.inserted).toMatchObject({ kind: 'subscription' });
  });
});
