import type { CreateSubscriptionInput, UpdateSubscriptionInput } from '@expenzo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryKeys } from '../keys';
import { useSupabase } from '../provider';
import {
  cancelSubscription,
  createSubscription,
  deleteSubscription,
  listServices,
  listSubscriptions,
  listUpcomingRenewals,
  postSubscriptionCharges,
  updateSubscription,
  type RenewalWindow,
  type ServiceRow,
  type SubscriptionRow,
} from '../repositories/subscriptions';

export function useSubscriptions(householdId: string | undefined) {
  const db = useSupabase();

  return useQuery<SubscriptionRow[]>({
    queryKey: queryKeys.subscriptions.all(householdId ?? ''),
    queryFn: () => listSubscriptions(db),
    enabled: Boolean(householdId),
  });
}

/**
 * What bills inside the window, for the dashboard card.
 *
 * A query of its own rather than a slice of the full list: it is the narrow
 * one the partial index serves, and the dashboard should not have to load
 * every subscription the household has ever had to show the two due this week.
 */
export function useUpcomingRenewals(householdId: string | undefined, window: RenewalWindow) {
  const db = useSupabase();

  return useQuery<SubscriptionRow[]>({
    queryKey: queryKeys.subscriptions.upcoming(householdId ?? '', window),
    queryFn: () => listUpcomingRenewals(db, window),
    enabled: Boolean(householdId),
  });
}

/**
 * The service catalogue.
 *
 * Reference data shared by every household and changed only by a migration, so
 * it is held for a day rather than re-fetched with the rest of the screen.
 */
export function useServices() {
  const db = useSupabase();

  return useQuery<ServiceRow[]>({
    queryKey: queryKeys.services.all(),
    queryFn: () => listServices(db),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useCreateSubscription(householdId: string | undefined, userId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSubscriptionInput) => {
      if (!householdId) throw new Error('No household is loaded yet.');
      if (!userId) throw new Error('No signed-in user.');
      return createSubscription(db, householdId, userId, input);
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.subscriptions.all(householdId ?? '') }),
  });
}

export function useUpdateSubscription(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSubscriptionInput) => updateSubscription(db, input),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.subscriptions.all(householdId ?? '') }),
  });
}

export function useCancelSubscription(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelSubscription(db, id),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.subscriptions.all(householdId ?? '') }),
  });
}

export function useDeleteSubscription(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSubscription(db, id),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.subscriptions.all(householdId ?? '') }),
  });
}

/**
 * Turns the subscription charges that fell due inside the window into
 * expenses, as the screen holding this loads.
 *
 * A query rather than a mutation fired from an effect, deliberately. React
 * runs an effect twice on mount in development, and a mutation would post,
 * post again and race its own invalidation; a query key is deduped, held, and
 * re-run only when the window changes. Posting is a write, so this is an
 * unusual shape — the unique index behind it is what makes it a safe one.
 *
 * There is no scheduler in this project yet. Until there is, opening the app
 * is what catches the ledger up.
 */
export function usePostSubscriptionCharges(
  householdId: string | undefined,
  window: RenewalWindow | null,
) {
  const db = useSupabase();
  const client = useQueryClient();

  const query = useQuery<number>({
    queryKey: queryKeys.subscriptions.charges(householdId ?? '', window ?? { from: '', to: '' }),
    queryFn: () => postSubscriptionCharges(db, window as RenewalWindow),
    // A period that has not started has nothing to post, and asking anyway is a
    // round trip for a certain zero.
    enabled: Boolean(householdId) && window !== null,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const posted = query.data ?? 0;

  useEffect(() => {
    if (posted <= 0) return;

    // Only when something was actually written. Invalidating on every load
    // would refetch the whole dashboard a second time for nothing.
    void client.invalidateQueries({ queryKey: queryKeys.expenses.all(householdId ?? '') });
    void client.invalidateQueries({ queryKey: queryKeys.summary.all(householdId ?? '') });
  }, [client, householdId, posted]);

  return query;
}
