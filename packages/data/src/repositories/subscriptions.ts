import {
  createSubscriptionInput,
  updateSubscriptionInput,
  type CreateSubscriptionInput,
  type UpdateSubscriptionInput,
} from '@expenzo/domain';

import type { Database, Db } from '../types';

type Row = Database['public']['Tables']['subscriptions']['Row'];

export type SubscriptionRow = Pick<
  Row,
  | 'id'
  | 'household_id'
  | 'created_by'
  | 'service_id'
  | 'name'
  | 'amount_minor'
  | 'currency'
  | 'cadence'
  | 'interval_count'
  | 'anchor_day'
  | 'started_on'
  | 'next_renewal_on'
  | 'trial_days'
  | 'trial_ends_on'
  | 'category_id'
  | 'status'
  | 'notes'
>;

type CatalogueRow = Database['public']['Tables']['service_catalogue']['Row'];

export type ServiceRow = Pick<CatalogueRow, 'id' | 'slug' | 'name' | 'domain' | 'category_hint'>;

// One literal rather than a concatenation: the generated client parses this
// string as a type to infer the row shape, and it cannot see through a `+`.
const COLUMNS =
  'id, household_id, created_by, service_id, name, amount_minor, currency, cadence, interval_count, anchor_day, started_on, next_renewal_on, trial_days, trial_ends_on, category_id, status, notes';

/**
 * Every subscription the household has, active and cancelled alike.
 *
 * Row-level security scopes this to the caller's household, so no filter is
 * applied here. Cancelled ones are included because they are history — the
 * screen decides how to present them, and a repository that hid them would
 * make "what did we used to pay for" unanswerable.
 */
export async function listSubscriptions(db: Db): Promise<SubscriptionRow[]> {
  const { data, error } = await db
    .from('subscriptions')
    .select(COLUMNS)
    .is('deleted_at', null)
    // Active first, then by what is due soonest. Nulls last so cancelled ones,
    // which have no next renewal, sit at the bottom rather than the top.
    .order('status', { ascending: true })
    .order('next_renewal_on', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);

  return data ?? [];
}

/** The window an upcoming-renewals query covers, both ends inclusive. */
export interface RenewalWindow {
  readonly from: string;
  readonly to: string;
}

/**
 * The subscriptions billing inside the window, soonest first.
 *
 * Deliberately a query of its own rather than a filter over the full list: the
 * status and the date bounds together are what let Postgres answer this from
 * subscriptions_household_idx, which is partial on active, undeleted rows and
 * ordered by the very column being ranged over.
 * Filtering in the client would read every subscription the household has ever
 * had to show the two that bill this week.
 */
export async function listUpcomingRenewals(
  db: Db,
  window: RenewalWindow,
): Promise<SubscriptionRow[]> {
  const { data, error } = await db
    .from('subscriptions')
    .select(COLUMNS)
    .eq('status', 'active')
    .is('deleted_at', null)
    .gte('next_renewal_on', window.from)
    .lte('next_renewal_on', window.to)
    .order('next_renewal_on', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);

  return data ?? [];
}

/** The catalogue of known services, for the picker on the entry form. */
export async function listServices(db: Db): Promise<ServiceRow[]> {
  const { data, error } = await db
    .from('service_catalogue')
    .select('id, slug, name, domain, category_hint')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function createSubscription(
  db: Db,
  householdId: string,
  userId: string,
  input: CreateSubscriptionInput,
): Promise<SubscriptionRow> {
  const parsed = createSubscriptionInput.parse(input);

  const { data, error } = await db
    .from('subscriptions')
    .insert({
      // Both are compared by the insert policy's WITH CHECK.
      household_id: householdId,
      created_by: userId,
      service_id: parsed.serviceId ?? null,
      name: parsed.name,
      amount_minor: parsed.amountMinor,
      currency: parsed.currency,
      cadence: parsed.cadence,
      interval_count: parsed.intervalCount,
      anchor_day: parsed.anchorDay,
      started_on: parsed.startedOn,
      // Null rather than omitted: an absent key would leave whatever was there
      // before in place. trial_ends_on is deliberately absent — it is a
      // generated column derived from these two, so there is only one place
      // the trial end can come from.
      trial_days: parsed.trialDays ?? null,
      category_id: parsed.categoryId ?? null,
      status: parsed.status,
      notes: parsed.notes ?? null,
      // next_renewal_on is deliberately absent. The
      // subscriptions_set_next_renewal trigger derives it and overwrites
      // anything sent — the upcoming-renewals card reads that column, and a
      // client that computes it wrongly puts a charge in front of somebody on
      // the wrong day.
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function updateSubscription(
  db: Db,
  input: UpdateSubscriptionInput,
): Promise<SubscriptionRow> {
  const parsed = updateSubscriptionInput.parse(input);
  const { id, ...changes } = parsed;

  const patch: Database['public']['Tables']['subscriptions']['Update'] = {
    updated_at: new Date().toISOString(),
  };

  if (changes.name !== undefined) patch.name = changes.name;
  if (changes.amountMinor !== undefined) patch.amount_minor = changes.amountMinor;
  if (changes.currency !== undefined) patch.currency = changes.currency;
  if (changes.cadence !== undefined) patch.cadence = changes.cadence;
  if (changes.intervalCount !== undefined) patch.interval_count = changes.intervalCount;
  if (changes.anchorDay !== undefined) patch.anchor_day = changes.anchorDay;
  if (changes.startedOn !== undefined) patch.started_on = changes.startedOn;
  if (changes.trialDays !== undefined) patch.trial_days = changes.trialDays;
  if (changes.categoryId !== undefined) patch.category_id = changes.categoryId;
  if (changes.status !== undefined) patch.status = changes.status;
  if (changes.notes !== undefined) patch.notes = changes.notes;

  const { data, error } = await db
    .from('subscriptions')
    .update(patch)
    .eq('id', id)
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);

  return data;
}

/**
 * Stops the renewals without pretending it never existed.
 *
 * Cancelling rather than deleting, because a subscription that has been paid
 * for two years is history, and the trigger clears `next_renewal_on` so it
 * drops out of what is due.
 */
export async function cancelSubscription(db: Db, id: string): Promise<SubscriptionRow> {
  return updateSubscription(db, { id, status: 'cancelled' });
}

/**
 * Removes it outright.
 *
 * Soft, matching expenses: a row that has been referenced by anything is worse
 * gone than archived, and the partial indexes already exclude it.
 */
export async function deleteSubscription(db: Db, id: string): Promise<void> {
  const { error } = await db
    .from('subscriptions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Turns the charges that fell due inside the window into expenses, and says
 * how many were written.
 *
 * A database function rather than a loop here for two reasons. The expense is
 * attributed to whoever entered the subscription, which the insert policy will
 * not let a client do for somebody else; and this runs on every visit to the
 * dashboard, so it has to be safe to repeat — which only the unique index
 * behind it can guarantee.
 *
 * Nothing posted is the ordinary outcome, not a failure: it means the window
 * has already been caught up.
 */
export async function postSubscriptionCharges(db: Db, window: RenewalWindow): Promise<number> {
  const { data, error } = await db.rpc('post_subscription_charges', {
    from_on: window.from,
    to_on: window.to,
  });

  if (error) throw new Error(error.message);

  return data ?? 0;
}
