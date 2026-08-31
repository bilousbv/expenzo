-- Crossing a spending limit tells somebody.
--
-- The limits landed with the dashboard deliberately without this: a trigger
-- that enqueues a notification needs somewhere for the notification to go.
--
-- The idea the whole design turns on is `limit_period_state`. "The household is
-- over budget" is true for every expense added for the rest of the month; "the
-- household has just gone over budget" happens once. Recording the crossing is
-- what turns the first into the second, and it is a table rather than a query
-- because the answer has to survive the expense being edited afterwards.
--
-- There is no scheduler in this project yet, so the queue is drained by
-- `public.deliver_notifications()`, called by the app as it loads — the same
-- shape as `post_subscription_charges`. When pg_cron and the push dispatcher
-- arrive, that function is what the tick calls; nothing here has to move.

---------------------------------------------------------------------------
-- Period bounds
---------------------------------------------------------------------------

/**
 * The period of a given kind containing `on_date`, both ends inclusive.
 *
 * Mirrors `limitPeriodBounds` in packages/domain, and must keep agreeing with
 * it: the dashboard says "€480 of €500" from the TypeScript, and this decides
 * whether a notification fires. Two answers to one question is how a screen and
 * an alert come to contradict each other.
 *
 * Takes a date rather than an instant. `occurred_on` is already the household's
 * local calendar date, frozen at write time, so there is no timezone left to
 * apply and the function can be IMMUTABLE.
 *
 * `date_trunc` is cast through `timestamp`: on a `date` it widens to
 * `timestamptz` and is only STABLE there, which `supabase db lint` flags and
 * which would licence Postgres to fold a wrong constant.
 */
create or replace function app.period_bounds(
  p        public.limit_period,
  on_date  date,
  -- int rather than smallint: a literal 1 at a call site is an integer, and
  -- Postgres will not narrow it to pick an overload, so every caller would
  -- have to write 1::smallint. households.week_starts_on widens for free.
  week_start int default 1
)
returns table (starts_on date, ends_on date)
language sql
immutable
set search_path = ''
as $$
  select
    case p
      when 'weekly' then on_date - ((7 + extract(isodow from on_date)::int - week_start) % 7)
      when 'monthly' then date_trunc('month', on_date::timestamp)::date
      when 'yearly' then date_trunc('year', on_date::timestamp)::date
    end,
    case p
      when 'weekly' then on_date - ((7 + extract(isodow from on_date)::int - week_start) % 7) + 6
      when 'monthly' then (date_trunc('month', on_date::timestamp) + interval '1 month' - interval '1 day')::date
      when 'yearly' then (date_trunc('year', on_date::timestamp) + interval '1 year' - interval '1 day')::date
    end
$$;

---------------------------------------------------------------------------
-- Notifications
---------------------------------------------------------------------------

-- Seeded with every kind M1 will produce, even though only the first is
-- enqueued yet. Postgres refuses to use an enum value in the transaction that
-- added it, so a value added later costs a migration of its own — cheap to
-- avoid now, tedious to discover later.
create type public.notification_kind as enum (
  'limit_exceeded', 'renewal_upcoming', 'trial_ending'
);

-- Web push is deferred to M3 with the PWA shell; the column exists so the
-- dispatcher that arrives with mobile push has somewhere to record its work.
create type public.notification_channel as enum ('in_app', 'push');

create type public.delivery_status as enum ('sent', 'suppressed', 'failed');

/**
 * What each member wants to be told about.
 *
 * An absent row means everything is on, so nothing has to be created when
 * somebody joins and a new kind does not need backfilling.
 */
create table public.notification_preferences (
  user_id        uuid not null references auth.users (id) on delete cascade,
  kind           public.notification_kind not null,
  in_app_enabled boolean not null default true,
  push_enabled   boolean not null default true,
  updated_at     timestamptz not null default now(),
  primary key (user_id, kind)
);

/**
 * Work to be done, enqueued by triggers.
 *
 * A trigger never issues HTTP: that would put network latency and a foreign
 * failure mode inside the user's transaction, so adding an expense would fail
 * because a push service was slow.
 *
 * `dedupe_key` is unique and every enqueue is `on conflict do nothing`, which
 * makes re-running whatever produced it free.
 */
create table public.notification_jobs (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind         public.notification_kind not null,
  dedupe_key   text not null unique,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  -- Claimed rather than deleted, so what was sent stays answerable.
  claimed_at   timestamptz
);

create index notification_jobs_pending_idx
  on public.notification_jobs (household_id, created_at)
  where claimed_at is null;

/**
 * What actually reached whom.
 *
 * Suppressed deliveries are recorded rather than dropped. "Why did I not get a
 * notification?" is otherwise unanswerable, and it is the first question asked.
 */
create table public.notification_deliveries (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.notification_jobs (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  channel      public.notification_channel not null default 'in_app',
  status       public.delivery_status not null default 'sent',
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

-- One delivery per member per job per channel.
create unique index notification_deliveries_once_uq
  on public.notification_deliveries (job_id, user_id, channel);

-- What the in-app centre reads: this member's, newest first.
create index notification_deliveries_inbox_idx
  on public.notification_deliveries (user_id, created_at desc)
  where status = 'sent';

/**
 * Which limit has already been reported broken, for which period.
 *
 * The primary key is the whole point: one row per limit per period means the
 * crossing is an event rather than a standing condition.
 */
create table public.limit_period_state (
  limit_id     uuid not null references public.spending_limits (id) on delete cascade,
  period_start date not null,
  household_id uuid not null references public.households (id) on delete cascade,
  spent_minor  bigint not null,
  breached_at  timestamptz not null default now(),
  primary key (limit_id, period_start)
);

---------------------------------------------------------------------------
-- Row-level security
---------------------------------------------------------------------------

alter table public.notification_preferences enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.limit_period_state enable row level security;

grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select on public.notification_jobs to authenticated;
grant select on public.notification_deliveries to authenticated;
-- Marking one read is the only write a client makes here. Row-level security
-- gates rows, not columns, so the column list is what stops a client inventing
-- a delivery's status.
grant update (read_at) on public.notification_deliveries to authenticated;
grant select on public.limit_period_state to authenticated;

-- Preferences are personal, not household business: whether somebody wants to
-- be told about the budget is between them and their phone.
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notification_jobs_select on public.notification_jobs
  for select to authenticated
  using (household_id = app.current_household_id());

create policy notification_deliveries_select on public.notification_deliveries
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notification_deliveries_update on public.notification_deliveries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy limit_period_state_select on public.limit_period_state
  for select to authenticated
  using (household_id = app.current_household_id());

---------------------------------------------------------------------------
-- The breach trigger
---------------------------------------------------------------------------

/**
 * Records the limits this expense has just broken, and queues one notification
 * naming all of them.
 *
 * One notification, not one per limit. A single purchase that takes a category
 * past its limit and the household past its overall limit is one event; two
 * notifications for one purchase reads as a bug to the person holding the
 * phone, whatever the data model thinks.
 *
 * Back-dating is recorded but not announced. An expense dated into a closed
 * period can still push it over, and the figure on the screen has to be right —
 * but a notification about a month nobody can influence any more is noise, and
 * importing a year of receipts would fire a burst of them.
 *
 * Spending only: `direction = 'spend'`, and `base_amount_minor`, so a household
 * with mixed currencies is compared against its limit in one currency.
 */
create or replace function app.check_spending_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  week_start smallint;
  today      date;
  lim        record;
  bounds     record;
  spent      bigint;
  breached   jsonb := '[]'::jsonb;
  ids        text[] := '{}';
  period_key date;
begin
  if new.direction <> 'spend' or new.deleted_at is not null then
    return null;
  end if;

  select h.week_starts_on into week_start
  from public.households h where h.id = new.household_id;

  today := current_date;

  -- The overall limit, and the one for this expense's category. No other limit
  -- can have moved, so no other limit is worth summing.
  for lim in
    select l.id, l.category_id, l.amount_minor, l.period
    from public.spending_limits l
    where l.household_id = new.household_id
      and (l.category_id is null or l.category_id is not distinct from new.category_id)
  loop
    select b.starts_on into period_key
    from app.period_bounds(lim.period, new.occurred_on, coalesce(week_start, 1)) b;

    select b.starts_on, b.ends_on into bounds
    from app.period_bounds(lim.period, new.occurred_on, coalesce(week_start, 1)) b;

    select coalesce(sum(e.base_amount_minor), 0) into spent
    from public.expenses e
    where e.household_id = new.household_id
      and e.deleted_at is null
      and e.direction = 'spend'
      and e.occurred_on between bounds.starts_on and bounds.ends_on
      and (lim.category_id is null or e.category_id = lim.category_id);

    if spent <= lim.amount_minor then
      continue;
    end if;

    -- The guard. An insert that conflicts means this limit was already
    -- reported broken for this period, and nothing more is owed.
    insert into public.limit_period_state
      (limit_id, period_start, household_id, spent_minor)
    values (lim.id, bounds.starts_on, new.household_id, spent)
    on conflict do nothing;

    if not found then
      continue;
    end if;

    breached := breached || jsonb_build_object(
      'limit_id', lim.id,
      'category_id', lim.category_id,
      'amount_minor', lim.amount_minor,
      'spent_minor', spent,
      'period_start', bounds.starts_on,
      'period_end', bounds.ends_on
    );
    ids := ids || lim.id::text;
  end loop;

  if jsonb_array_length(breached) = 0 then
    return null;
  end if;

  -- Recorded above, announced only while the period is still running.
  if bounds.ends_on < today then
    return null;
  end if;

  insert into public.notification_jobs (household_id, kind, dedupe_key, payload)
  values (
    new.household_id,
    'limit_exceeded',
    'limit_exceeded:' || period_key::text || ':' || array_to_string(ids, '.'),
    jsonb_build_object('limits', breached)
  )
  on conflict do nothing;

  return null;
end
$$;

alter function app.check_spending_limits() owner to postgres;

-- AFTER, so the row it sums over includes the one that triggered it. Statement
-- result is discarded, which is what `returns null` above says.
create trigger expenses_check_limits
  after insert or update on public.expenses
  for each row execute function app.check_spending_limits();

---------------------------------------------------------------------------
-- Delivery
---------------------------------------------------------------------------

/**
 * Turns queued jobs into in-app deliveries for the caller's household, and
 * answers with how many jobs were drained.
 *
 * Preferences are applied here rather than at enqueue, so turning a
 * notification off after a job exists suppresses it and turning one on delivers
 * what is pending. A member who has said no gets a `suppressed` row rather than
 * nothing at all.
 *
 * `for update skip locked` so two callers never deliver the same job twice —
 * which matters more once a cron tick and an app load can race.
 */
create or replace function public.deliver_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := app.current_household_id();
  job       record;
  drained   integer := 0;
begin
  if household is null then
    raise exception 'not a member of a household' using errcode = '42501';
  end if;

  for job in
    select j.id, j.kind
    from public.notification_jobs j
    where j.household_id = household
      and j.claimed_at is null
    order by j.created_at
    for update skip locked
  loop
    insert into public.notification_deliveries
      (job_id, household_id, user_id, channel, status)
    select
      job.id, household, m.user_id, 'in_app',
      case when coalesce(p.in_app_enabled, true) then 'sent' else 'suppressed' end::public.delivery_status
    from public.household_members m
    left join public.notification_preferences p
      on p.user_id = m.user_id and p.kind = job.kind
    where m.household_id = household and m.status = 'active'
    on conflict do nothing;

    update public.notification_jobs set claimed_at = now() where id = job.id;

    drained := drained + 1;
  end loop;

  return drained;
end
$$;

alter function public.deliver_notifications() owner to postgres;

revoke all on function public.deliver_notifications() from public;
grant execute on function public.deliver_notifications() to authenticated;
