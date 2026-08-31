import type { NotificationKind } from '@expenzo/domain';

import type { Database, Db } from '../types';

type PreferenceRow = Database['public']['Tables']['notification_preferences']['Row'];

export type NotificationPreferenceRow = Pick<
  PreferenceRow,
  'kind' | 'in_app_enabled' | 'push_enabled'
>;

/** One item in the in-app centre: a delivery, with the job it came from. */
export interface NotificationRow {
  id: string;
  createdAt: string;
  readAt: string | null;
  kind: NotificationKind;
  payload: unknown;
}

// One string literal rather than a concatenation: the generated client parses
// this as a type to infer the row shape, and it cannot see through a `+`.
const COLUMNS = 'id, created_at, read_at, job:notification_jobs!inner(kind, payload)';

/**
 * This member's notifications, newest first.
 *
 * No user filter: row-level security already scopes deliveries to the caller,
 * and restating it here would only be a second place to get it wrong.
 *
 * Only `sent`. A suppressed delivery is recorded so "why did I not get a
 * notification?" stays answerable, but putting it in the inbox would be the app
 * announcing exactly what it had decided not to announce.
 */
export async function listNotifications(db: Db, limit = 20): Promise<NotificationRow[]> {
  const { data, error } = await db
    .from('notification_deliveries')
    .select(COLUMNS)
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    readAt: row.read_at,
    kind: row.job.kind,
    payload: row.job.payload,
  }));
}

/**
 * Marks one as read.
 *
 * `read_at` is the only column a client may write on this table — the grant is
 * per-column, because row-level security gates rows and would happily let a
 * member rewrite the status of a delivery it can see.
 */
export async function markNotificationRead(db: Db, id: string): Promise<void> {
  const { error } = await db
    .from('notification_deliveries')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/** Marks everything still unread as read, leaving earlier timestamps alone. */
export async function markAllNotificationsRead(db: Db): Promise<void> {
  const { error } = await db
    .from('notification_deliveries')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  if (error) throw new Error(error.message);
}

/**
 * Turns queued jobs into deliveries, and says how many were drained.
 *
 * There is no scheduler in this project yet, so opening the app is what moves
 * the queue — the same shape as `postSubscriptionCharges`. Nothing queued is
 * the ordinary outcome on almost every load rather than a failure.
 */
export async function deliverNotifications(db: Db): Promise<number> {
  const { data, error } = await db.rpc('deliver_notifications');

  if (error) throw new Error(error.message);

  return data ?? 0;
}

export async function listNotificationPreferences(db: Db): Promise<NotificationPreferenceRow[]> {
  const { data, error } = await db
    .from('notification_preferences')
    .select('kind, in_app_enabled, push_enabled');

  if (error) throw new Error(error.message);

  return data ?? [];
}

/**
 * Turns one channel of one kind on or off for this member.
 *
 * An upsert because an absent row means everything is on: nothing is created
 * when somebody joins a household, and a kind added later needs no backfill.
 * The first time anybody touches a switch is the first time a row exists.
 *
 * A channel that was not named is left out of the write entirely rather than
 * sent as its current value, so two devices changing different switches do not
 * overwrite each other.
 */
export async function setNotificationPreference(
  db: Db,
  userId: string,
  kind: NotificationKind,
  patch: { inApp?: boolean; push?: boolean },
): Promise<void> {
  const { error } = await db.from('notification_preferences').upsert(
    {
      user_id: userId,
      kind,
      ...(patch.inApp === undefined ? {} : { in_app_enabled: patch.inApp }),
      ...(patch.push === undefined ? {} : { push_enabled: patch.push }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,kind' },
  );

  if (error) throw new Error(error.message);
}
