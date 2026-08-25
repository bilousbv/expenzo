import type { Database, Db } from '../types';

type Direction = Database['public']['Enums']['expense_direction'];

export interface PeriodSummary {
  spentMinor: number;
  incomeMinor: number;
  /** Income minus spending. Negative means the household is running down. */
  balanceMinor: number;
}

export interface CategorySpend {
  categoryId: string | null;
  totalMinor: number;
}

export interface SummaryArgs {
  from: string;
  to: string;
  /** Restrict to one author, or undefined for the whole household. */
  memberId?: string;
}

/**
 * Totals for a period, aggregated in the database.
 *
 * Not summed in the client: the expense list is keyset-paged, so adding up the
 * rows the browser happens to hold gives the total of page one and labels it
 * the total of the month.
 */
export async function getPeriodSummary(db: Db, args: SummaryArgs): Promise<PeriodSummary> {
  const { data, error } = await db.rpc('expense_summary', {
    from_on: args.from,
    to_on: args.to,
    // The function takes null for "everyone"; undefined would be omitted from
    // the request body entirely, which PostgREST reads as the same thing, but
    // being explicit keeps the two callers symmetrical.
    member: args.memberId ?? undefined,
  });

  if (error) throw new Error(error.message);

  const totals = new Map<Direction, number>(
    (data ?? []).map((row) => [row.direction, Number(row.total_minor)]),
  );

  const spentMinor = totals.get('spend') ?? 0;
  const incomeMinor = totals.get('income') ?? 0;

  return { spentMinor, incomeMinor, balanceMinor: incomeMinor - spentMinor };
}

/**
 * Spending per category for the same window.
 *
 * Spending only — income has no category rollup to belong to, and counting it
 * would make a salary look like the month's largest outgoing. The uncategorised
 * bucket arrives with a null id rather than being dropped.
 */
export async function getCategorySpend(db: Db, args: SummaryArgs): Promise<CategorySpend[]> {
  const { data, error } = await db.rpc('category_summary', {
    from_on: args.from,
    to_on: args.to,
    member: args.memberId ?? undefined,
  });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    categoryId: row.category_id,
    totalMinor: Number(row.total_minor),
  }));
}
