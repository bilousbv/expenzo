import { createExpenseInput, type CreateExpenseInput, type ExpenseFilter } from '@expenzo/domain';

import type { Database, Db } from '../types';

type Row = Database['public']['Tables']['expenses']['Row'];

/**
 * The columns every expense screen reads. Picked from the generated Row rather
 * than restated, so a dropped column fails the type check instead of arriving
 * as undefined at runtime.
 */
export type ExpenseRow = Pick<
  Row,
  | 'id'
  | 'household_id'
  | 'created_by'
  | 'direction'
  | 'amount_minor'
  | 'currency'
  | 'base_amount_minor'
  | 'category_id'
  | 'merchant'
  | 'note'
  | 'occurred_on'
>;

const COLUMNS =
  'id, household_id, created_by, direction, amount_minor, currency, base_amount_minor, category_id, merchant, note, occurred_on';

export const DEFAULT_PAGE_SIZE = 25;

/**
 * Where the next page starts.
 *
 * Keyset rather than OFFSET: over a row-level-security-filtered table an offset
 * has to walk and discard every row before it, and it silently skips rows when
 * somebody else inserts while the user is paging.
 */
export interface ExpenseCursor {
  occurredOn: string;
  id: string;
}

export interface ExpensePage {
  rows: ExpenseRow[];
  nextCursor: ExpenseCursor | null;
}

export async function listExpenses(
  db: Db,
  filter: ExpenseFilter | Record<string, never>,
  cursor?: ExpenseCursor,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<ExpensePage> {
  let query = db.from('expenses').select(COLUMNS).is('deleted_at', null);

  const { from, to, categoryId, uncategorised, memberId } = filter as ExpenseFilter;

  if (from) query = query.gte('occurred_on', from);
  if (to) query = query.lte('occurred_on', to);
  if (categoryId) query = query.eq('category_id', categoryId);
  // A distinct filter rather than a sentinel id: the column is a uuid, so
  // anything standing in for "none" could one day be a real category.
  if (uncategorised) query = query.is('category_id', null);
  // The author filter. Every member sees every expense, so this narrows the
  // list rather than deciding what is reachable.
  if (memberId) query = query.eq('created_by', memberId);

  if (cursor) {
    // Strictly after the cursor in (occurred_on desc, id desc) order: an
    // earlier date, or the same date with a smaller id.
    query = query.or(
      `occurred_on.lt.${cursor.occurredOn},and(occurred_on.eq.${cursor.occurredOn},id.lt.${cursor.id})`,
    );
  }

  // One more than the page, so a full page is distinguishable from the last one
  // without a second count query.
  const { data, error } = await query
    .order('occurred_on', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);

  if (error) throw new Error(error.message);

  const all = data ?? [];
  const hasMore = all.length > pageSize;
  const rows = hasMore ? all.slice(0, pageSize) : all;
  const last = rows.at(-1);

  return {
    rows,
    nextCursor: hasMore && last ? { occurredOn: last.occurred_on, id: last.id } : null,
  };
}

export async function createExpense(
  db: Db,
  householdId: string,
  userId: string,
  input: CreateExpenseInput,
): Promise<ExpenseRow> {
  const parsed = createExpenseInput.parse(input);

  const { data, error } = await db
    .from('expenses')
    .insert({
      // Both are compared by the insert policy's WITH CHECK, and neither has a
      // column default to fall back on.
      household_id: householdId,
      created_by: userId,

      direction: parsed.direction,
      amount_minor: parsed.amountMinor,
      currency: parsed.currency,

      // base_amount_minor, fx_rate and fx_rate_date are deliberately absent.
      // The expenses_set_base_amount trigger converts into the household's base
      // currency at the rate for the day the expense happened, and overwrites
      // anything a client sends — that figure is what every household total is
      // summed from, and a client that is lying about it cannot be told from
      // one that is merely wrong.
      occurred_on: parsed.occurredOn,
      category_id: parsed.categoryId ?? null,
      merchant: parsed.merchant ?? null,
      note: parsed.note ?? null,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);

  return data;
}

/**
 * Soft delete.
 *
 * Every partial index already excludes `deleted_at`, the audit trigger records
 * who did it, and a household total that changes because a row simply vanished
 * is not something anybody can reconstruct afterwards.
 */
export async function deleteExpense(db: Db, id: string): Promise<void> {
  const { error } = await db
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}
