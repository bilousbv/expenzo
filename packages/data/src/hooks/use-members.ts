import type { MemberRole } from '@expenzo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../keys';
import { useSupabase } from '../provider';
import { removeMember, setMemberRole } from '../repositories/members';
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

/**
 * Changing what somebody is, or taking them out of the household.
 *
 * Both invalidate the whole household key rather than only the roster: a role
 * decides what its holder may do, and a removal takes their expenses out of
 * every filter the screen is holding.
 */
export function useSetMemberRole(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ member, role }: { member: string; role: MemberRole }) =>
      setMemberRole(db, member, role),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.households.current(householdId ?? '') }),
  });
}

export function useRemoveMember(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (member: string) => removeMember(db, member),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.households.current(householdId ?? '') }),
  });
}
