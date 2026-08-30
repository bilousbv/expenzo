import type { CreateSubscriptionInput, UpdateSubscriptionInput } from '@expenzo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../keys';
import { useSupabase } from '../provider';
import {
  cancelSubscription,
  createSubscription,
  deleteSubscription,
  listServices,
  listSubscriptions,
  listUpcomingRenewals,
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
