import type { CreateLimitInput, UpdateLimitInput } from '@expenzo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../keys';
import { useSupabase } from '../provider';
import {
  createLimit,
  deleteLimit,
  listLimits,
  updateLimit,
  type SpendingLimitRow,
} from '../repositories/limits';

export function useLimits(householdId: string | undefined) {
  const db = useSupabase();

  return useQuery<SpendingLimitRow[]>({
    queryKey: queryKeys.limits.all(householdId ?? ''),
    queryFn: () => listLimits(db),
    enabled: Boolean(householdId),
  });
}

export function useCreateLimit(householdId: string | undefined, userId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLimitInput) => {
      if (!householdId) throw new Error('No household is loaded yet.');
      if (!userId) throw new Error('No signed-in user.');
      return createLimit(db, householdId, userId, input);
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.limits.all(householdId ?? '') }),
  });
}

export function useUpdateLimit(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateLimitInput) => updateLimit(db, input),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.limits.all(householdId ?? '') }),
  });
}

export function useDeleteLimit(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteLimit(db, id),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.limits.all(householdId ?? '') }),
  });
}
