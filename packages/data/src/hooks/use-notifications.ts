import type { NotificationKind } from '@expenzo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryKeys } from '../keys';
import { useSupabase } from '../provider';
import {
  deliverNotifications,
  listNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setNotificationPreference,
  type NotificationPreferenceRow,
  type NotificationRow,
} from '../repositories/notifications';

export function useNotifications(householdId: string | undefined, limit = 20) {
  const db = useSupabase();

  return useQuery<NotificationRow[]>({
    queryKey: queryKeys.notifications.inbox(householdId ?? ''),
    queryFn: () => listNotifications(db, limit),
    enabled: Boolean(householdId),
  });
}

/**
 * Drains the notification queue as the screen holding this loads.
 *
 * A query rather than a mutation fired from an effect: React runs an effect
 * twice on mount in development, and a mutation would drain, drain again and
 * race its own invalidation. A query key is deduped and held.
 *
 * There is no scheduler yet, so opening the app is what moves the queue. When
 * pg_cron and the push dispatcher arrive they call the same function, and
 * `for update skip locked` is what stops the two racing.
 */
export function useDeliverNotifications(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  const query = useQuery<number>({
    queryKey: queryKeys.notifications.pending(householdId ?? ''),
    queryFn: () => deliverNotifications(db),
    enabled: Boolean(householdId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const drained = query.data ?? 0;

  useEffect(() => {
    if (drained <= 0) return;

    // Only when something was actually delivered. Invalidating on every load
    // would refetch the inbox a second time for nothing.
    void client.invalidateQueries({ queryKey: queryKeys.notifications.inbox(householdId ?? '') });
  }, [client, drained, householdId]);

  return query;
}

export function useMarkNotificationRead(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markNotificationRead(db, id),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.notifications.inbox(householdId ?? '') }),
  });
}

export function useMarkAllNotificationsRead(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsRead(db),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.notifications.inbox(householdId ?? '') }),
  });
}

export function useNotificationPreferences(userId: string | undefined) {
  const db = useSupabase();

  return useQuery<NotificationPreferenceRow[]>({
    queryKey: queryKeys.notifications.preferences(userId ?? ''),
    queryFn: () => listNotificationPreferences(db),
    enabled: Boolean(userId),
  });
}

export function useSetNotificationPreference(userId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: { kind: NotificationKind; inApp?: boolean; push?: boolean }) => {
      if (!userId) throw new Error('No signed-in user.');

      return setNotificationPreference(db, userId, input.kind, {
        inApp: input.inApp,
        push: input.push,
      });
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.notifications.preferences(userId ?? '') }),
  });
}
