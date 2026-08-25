import type { CreateExpenseInput, ExpenseFilter } from '@expenzo/domain';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { queryKeys } from '../keys';
import { useSupabase } from '../provider';
import {
  createExpense,
  deleteExpense,
  listExpenses,
  type ExpenseCursor,
  type ExpensePage,
} from '../repositories/expenses';

/**
 * Everything a change to one expense invalidates.
 *
 * The dashboard totals come from their own aggregate query, so invalidating
 * only the list leaves the budget showing a figure that no longer includes the
 * expense the user just added — which reads as the app having ignored them.
 */
function invalidateExpenseViews(client: QueryClient, householdId: string | undefined) {
  const id = householdId ?? '';

  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.expenses.all(id) }),
    client.invalidateQueries({ queryKey: queryKeys.summary.all(id) }),
  ]);
}

export interface UseExpensesOptions {
  householdId: string | undefined;
  filter?: ExpenseFilter | Record<string, never>;
  pageSize?: number;
}

/**
 * The household's expenses, newest first, paged by keyset.
 *
 * The household id is only used for the cache key — the query itself is scoped
 * by row-level security. It is still required before anything runs, because a
 * key without it would be shared across households.
 */
export function useExpenses({ householdId, filter = {}, pageSize }: UseExpensesOptions) {
  const db = useSupabase();

  return useInfiniteQuery<
    ExpensePage,
    Error,
    ExpensePage[],
    readonly unknown[],
    ExpenseCursor | undefined
  >({
    queryKey: queryKeys.expenses.list(householdId ?? '', filter),
    queryFn: ({ pageParam }) => listExpenses(db, filter, pageParam, pageSize),
    initialPageParam: undefined,
    // Returning undefined rather than null is what tells TanStack Query there
    // is nothing more to fetch; null would be treated as a real cursor.
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: (data) => data.pages,
    enabled: Boolean(householdId),
  });
}

export function useCreateExpense(householdId: string | undefined, userId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExpenseInput) => {
      if (!householdId) throw new Error('No household is loaded yet.');
      if (!userId) throw new Error('No signed-in user.');
      return createExpense(db, householdId, userId, input);
    },
    // Invalidating the collection prefix rather than one filtered list: a new
    // expense can belong to any filter currently on screen, and the server
    // fills in the columns the triggers own.
    onSuccess: () => invalidateExpenseViews(client, householdId),
  });
}

export function useDeleteExpense(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteExpense(db, id),
    onSuccess: () => invalidateExpenseViews(client, householdId),
  });
}
