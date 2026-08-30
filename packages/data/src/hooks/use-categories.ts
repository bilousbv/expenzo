import type { CategoryKind, CreateCategoryInput, UpdateCategoryInput } from '@expenzo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../keys';
import { useSupabase } from '../provider';
import {
  archiveCategory,
  createCategory,
  listCategories,
  updateCategory,
  type CategoryRow,
} from '../repositories/categories';

/**
 * System categories and the household's own, in display order.
 *
 * The household id is only used for the cache key — the query itself is scoped
 * by row-level security. It is still required before the query runs, because a
 * key without it would be shared across households and could serve one
 * household's list to another after a switch.
 */
export function useCategories(householdId: string | undefined, kind: CategoryKind = 'expense') {
  const db = useSupabase();

  return useQuery<CategoryRow[]>({
    queryKey: queryKeys.categories.byKind(householdId ?? '', kind),
    queryFn: () => listCategories(db, kind),
    enabled: Boolean(householdId),
  });
}

export function useCreateCategory(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => {
      if (!householdId) throw new Error('No household is loaded yet.');
      return createCategory(db, householdId, input);
    },
    // Invalidate rather than write the new row into the cache: the database
    // fills in the slug and the generated is_system, so the server's copy is
    // the only complete one.
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.categories.all(householdId ?? '') }),
  });
}

export function useUpdateCategory(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateCategoryInput) => updateCategory(db, input),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.categories.all(householdId ?? '') }),
  });
}

export function useArchiveCategory(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => archiveCategory(db, id),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.categories.all(householdId ?? '') }),
  });
}
