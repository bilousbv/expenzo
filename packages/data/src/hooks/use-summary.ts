import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { queryKeys, type SummaryWindow } from '../keys';
import { useSupabase } from '../provider';
import {
  getCategorySpend,
  getPeriodSummary,
  type CategorySpend,
  type PeriodSummary,
} from '../repositories/summary';

/**
 * The budget figures for a period.
 *
 * Deliberately its own query rather than something derived from the expense
 * list: the list is paged, so anything computed from it would be the total of
 * whatever happens to be loaded.
 */
export function usePeriodSummary(householdId: string | undefined, window: SummaryWindow) {
  const db = useSupabase();

  return useQuery<PeriodSummary>({
    queryKey: queryKeys.summary.period(householdId ?? '', window),
    queryFn: () => getPeriodSummary(db, window),
    enabled: Boolean(householdId),
  });
}

export function useCategorySpend(householdId: string | undefined, window: SummaryWindow) {
  const db = useSupabase();

  return useQuery<CategorySpend[]>({
    queryKey: queryKeys.summary.categories(householdId ?? '', window),
    queryFn: () => getCategorySpend(db, window),
    enabled: Boolean(householdId),
  });
}

/** What the balance panel renders, once both halves have arrived. */
export interface BudgetSummaryResult {
  data: PeriodSummary | undefined;
  isPending: boolean;
}

/**
 * The budget figures for a period, with the author filter applied to spending
 * only.
 *
 * The filter answers "what did this person spend". Money arriving belongs to
 * the household rather than to whoever happened to type it in — one salary is
 * recorded by one member, so filtering income by author made picking anybody
 * else read as a household with no income at all, and the balance beneath it
 * collapse to the negative of their spending.
 *
 * Two queries rather than a second SQL function: `expense_summary` filters
 * what it is told to and should keep doing so. With nobody selected the two
 * are the same question and their keys hash identically, so the default view
 * still costs one request.
 */
export function useBudgetSummary(
  householdId: string | undefined,
  window: SummaryWindow,
): BudgetSummaryResult {
  const selected = usePeriodSummary(householdId, window);
  const household = usePeriodSummary(householdId, { from: window.from, to: window.to });

  return useMemo(() => {
    const spending = selected.data;
    const earning = household.data;

    if (!spending || !earning) {
      return { data: undefined, isPending: selected.isPending || household.isPending };
    }

    return {
      data: {
        spentMinor: spending.spentMinor,
        incomeMinor: earning.incomeMinor,
        // Derived from the two figures shown beneath it rather than read off
        // either query, so the three numbers on the panel always agree.
        balanceMinor: earning.incomeMinor - spending.spentMinor,
      },
      isPending: false,
    };
  }, [household.data, household.isPending, selected.data, selected.isPending]);
}
