import type { Database, Db } from '../types';

type Row = Database['public']['Tables']['households']['Row'];

export type HouseholdRow = Pick<Row, 'id' | 'name' | 'base_currency' | 'timezone'>;

/**
 * The caller's household.
 *
 * One household per user for now, and the select policy already limits the
 * table to that single row, so this needs no filter. maybeSingle rather than
 * single: a user whose signup trigger has not committed yet has no household,
 * and that is a null rather than an error.
 */
export async function getCurrentHousehold(db: Db): Promise<HouseholdRow | null> {
  const { data, error } = await db
    .from('households')
    .select('id, name, base_currency, timezone')
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data;
}
