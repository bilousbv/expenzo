import { useQuery } from '@tanstack/react-query';

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
