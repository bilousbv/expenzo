import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../keys';
import { useSupabase } from '../provider';
import { listHouseholdMembers, type HouseholdMember } from '../repositories/profiles';

/**
 * The household roster.
 *
 * Every expense row shows its author, and the author filter is built from this,
 * so it is fetched once and cached rather than joined onto each page of
 * expenses.
 */
export function useHouseholdMembers(householdId: string | undefined) {
  const db = useSupabase();

  return useQuery<HouseholdMember[]>({
    queryKey: queryKeys.households.members(householdId ?? ''),
    queryFn: () => listHouseholdMembers(db),
    enabled: Boolean(householdId),
  });
}
