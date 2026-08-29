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

/**
 * Net movement per day.
 *
 * Nothing on the dashboard reads this today â the saved figure comes straight
 * from the period summary. It is kept because `public.daily_net` is the series
 * the charts in M3 are built from, and re-deriving a tested migration later is
 * more work than leaving it here.
 */
export interface DailyNetRow {
  occurredOn: string;
  netMinor: number;
}

/**
 * Net movement per day, for the balance swing card.
 *
 * Only days that have something on them come back — the caller walks the whole
 * window itself, and a row per empty day would mean sending a year of zeroes to
 * describe a quiet year.
 */
export async function getDailyNet(db: Db, args: SummaryArgs): Promise<DailyNetRow[]> {
  const { data, error } = await db.rpc('daily_net', {
    from_on: args.from,
    to_on: args.to,
    member: args.memberId ?? undefined,
  });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    occurredOn: row.occurred_on,
    // Postgres returns bigint as a string, because it does not fit a JavaScript
    // number safely. Left as one it would concatenate rather than add the first
    // time a running balance was accumulated.
    netMinor: Number(row.net_minor),
  }));
}
