import {
  createLimitInput,
  updateLimitInput,
  type CreateLimitInput,
  type UpdateLimitInput,
} from '@expenzo/domain';

import type { Database, Db } from '../types';

type Row = Database['public']['Tables']['spending_limits']['Row'];

export type SpendingLimitRow = Pick<
  Row,
  'id' | 'household_id' | 'category_id' | 'amount_minor' | 'period'
>;

const COLUMNS = 'id, household_id, category_id, amount_minor, period';

/** Postgres' unique_violation. */
const UNIQUE_VIOLATION = '23505';

/**
 * Every limit the household has set.
 *
 * Row-level security scopes this to the caller's household, so no filter is
 * applied here. The row with a null `category_id` is the household-wide one.
 */
export async function listLimits(db: Db): Promise<SpendingLimitRow[]> {
  const { data, error } = await db.from('spending_limits').select(COLUMNS);

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function createLimit(
  db: Db,
  householdId: string,
  userId: string,
  input: CreateLimitInput,
): Promise<SpendingLimitRow> {
  const parsed = createLimitInput.parse(input);

  const { data, error } = await db
    .from('spending_limits')
    .insert({
      // Both are compared by the insert policy's WITH CHECK.
      household_id: householdId,
      created_by: userId,
      // Absent means the household-wide limit, which is a NULL column rather
      // than a missing one.
      category_id: parsed.categoryId ?? null,
      amount_minor: parsed.amountMinor,
      period: parsed.period,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    // One limit per category per period. Hitting the index means a limit is
    // already set, which is something to change rather than an error.
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error('That already has a limit for this period. Change it instead.');
    }

    throw new Error(error.message);
  }

  return data;
}

/**
 * Changes the amount, and nothing else.
 *
 * Moving a limit to a different category is indistinguishable from setting a
 * different limit, and would slip past the unique index.
 */
export async function updateLimit(db: Db, input: UpdateLimitInput): Promise<SpendingLimitRow> {
  const parsed = updateLimitInput.parse(input);

  const { data, error } = await db
    .from('spending_limits')
    .update({ amount_minor: parsed.amountMinor, updated_at: new Date().toISOString() })
    .eq('id', parsed.id)
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);

  return data;
}

/**
 * Deletes rather than archives.
 *
 * Unlike a category, a limit has no history hanging off it — nothing references
 * it, and removing one means "there is no limit here" rather than losing a
 * record of anything.
 */
export async function deleteLimit(db: Db, id: string): Promise<void> {
  const { error } = await db.from('spending_limits').delete().eq('id', id);

  if (error) throw new Error(error.message);
}
