-- A subscription that has billed becomes an expense.
--
-- Until now a subscription was a promise about the future and nothing else. It
-- said what would be charged and when, and the money never appeared in the
-- ledger it was charged against, so a household paying for eight services read
-- a monthly total with none of them in it.
--
-- The charge is posted rather than derived. A derived total would have to be
-- recomputed on every read, could never be corrected when the merchant took a
-- different amount, and would leave nothing to file, split or annotate. An
-- expense row is the thing the rest of the app already knows how to handle.

---------------------------------------------------------------------------
-- The link, and the index that makes posting idempotent
---------------------------------------------------------------------------

alter table public.expenses
  add column subscription_id uuid references public.subscriptions (id) on delete set null;

/*
 * One subscription bills a given day exactly once.
 *
 * Deliberately with no `deleted_at is null` predicate, unlike every other
 * partial index on this table. With one, deleting a posted charge would let
 * the next dashboard visit write it again — the most annoying behaviour this
 * feature could have. A deletion is a decision, and the index is what makes it
 * stick.
 */
create unique index expenses_subscription_charge_uq
  on public.expenses (subscription_id, occurred_on)
  where subscription_id is not null;

-- Row-level security gates rows, not columns, and this one is derived: it says
-- which subscription paid for the row, and only the function below may answer.
revoke update (subscription_id) on public.expenses from authenticated;

---------------------------------------------------------------------------
-- Posting
---------------------------------------------------------------------------

/**
 * Writes an expense for every subscription charge that fell due in the window
 * and has not been posted yet, and answers with how many that was.
 *
 * SECURITY DEFINER for one specific reason: the expense is attributed to
 * whoever entered the subscription, and `expenses_insert` requires
 * `created_by = auth.uid()`. Attributing eight charges to whoever happened to
 * open the app first would make the author filter on the dashboard say
 * something false about every one of them.
 *
 * There is no scheduler in this project yet, so this is called by the client
 * as the dashboard loads, with the period on screen. That works because it is
 * safe to run on every single visit — `expenses_subscription_charge_uq` is
 * what makes the second call a no-op rather than a second charge.
 *
 * The window is clamped to today at the far end and refused past a year wide.
 * A renewal date is a promise until the day arrives, and backfilling years of
 * history from one dashboard visit is not something to discover in production.
 */
create or replace function public.post_subscription_charges(
  from_on date default null,
  to_on   date default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  household   uuid := app.current_household_id();
  today       date := current_date;
  window_from date;
  window_to   date;
  zone        text;
  category    uuid;
  sub         record;
  charge_on   date;
  posted      integer := 0;
  guard       integer;
begin
  if household is null then
    raise exception 'not a member of a household' using errcode = '42501';
  end if;

  window_from := coalesce(from_on, date_trunc('month', today::timestamp)::date);
  window_to   := least(coalesce(to_on, today), today);

  -- A period that has not started yet, or one asked for backwards. Neither is
  -- an error: stepping the period bar forward produces the first every time.
  if window_to < window_from then
    return 0;
  end if;

  if window_to - window_from > 366 then
    raise exception 'a posting window cannot be wider than a year'
      using errcode = '22023';
  end if;

  select h.timezone into zone from public.households h where h.id = household;

  -- The system "Subscriptions" category, which has existed in the expense
  -- taxonomy since the first migration and had nothing filed under it because
  -- nothing was ever posted there. A household category of the same name is
  -- deliberately not matched: system rows are the ones that cannot be renamed
  -- or archived out from under this.
  select c.id into category
  from public.categories c
  where c.household_id is null and c.kind = 'expense' and c.slug = 'subscriptions';

  for sub in
    select s.id, s.created_by, s.name, s.amount_minor, s.currency,
           s.anchor_day, s.cadence, s.interval_count, s.started_on, s.trial_days
    from public.subscriptions s
    where s.household_id = household
      and s.deleted_at is null
      -- A cancelled subscription records no date it was cancelled on, so there
      -- is no honest way to know which of its charges were taken. Posting none
      -- of them is the only answer that cannot invent money.
      and s.status = 'active'
  loop
    -- Money starts moving when the trial runs out, mirroring the coalesce in
    -- app.set_subscription_next_renewal. Anchoring to the sign-up date would
    -- post a charge for a month nobody paid for.
    charge_on := case
      when sub.trial_days is null then sub.started_on
      else sub.started_on + sub.trial_days
    end;

    guard := 0;

    while charge_on <= window_to loop
      if charge_on >= window_from then
        begin
          insert into public.expenses (
            household_id, created_by, subscription_id,
            amount_minor, currency, base_amount_minor,
            category_id, merchant, direction,
            occurred_on, occurred_at, source
          )
          values (
            household, sub.created_by, sub.id,
            sub.amount_minor, sub.currency,
            -- Overwritten by app.set_expense_base_amount before the row lands;
            -- the column is NOT NULL, so something has to be sent.
            0,
            category, sub.name, 'spend',
            charge_on,
            charge_on::timestamp at time zone coalesce(zone, 'UTC'),
            'subscription'
          )
          on conflict do nothing;

          -- Untargeted, so it also absorbs a collision on the dedup
          -- fingerprint — two services with the same name, price and billing
          -- day. Rare, and quietly skipping the duplicate is what the
          -- fingerprint is for.
          if found then
            posted := posted + 1;
          end if;
        exception
          -- app.set_expense_base_amount refuses a currency it cannot convert
          -- on the day of the charge, which is right: recording it at a rate
          -- of one would put a silently wrong figure into every total. One
          -- unratable subscription must not stop the others from posting, so
          -- it is skipped and will post whenever a rate for that day exists.
          when sqlstate '22023' then
            null;
        end;
      end if;

      charge_on := app.next_renewal_on(
        sub.anchor_day, sub.cadence, sub.interval_count, charge_on
      );

      guard := guard + 1;

      -- Every cadence advances at least seven days, and the window is at most
      -- a year, so this cannot be reached. It is here so a future cadence that
      -- failed to advance would raise rather than spin.
      if guard > 5000 then
        raise exception 'renewal schedule failed to advance past %', window_to
          using errcode = '22023';
      end if;
    end loop;
  end loop;

  return posted;
end
$$;

alter function public.post_subscription_charges(date, date) owner to postgres;

revoke all on function public.post_subscription_charges(date, date) from public;
grant execute on function public.post_subscription_charges(date, date) to authenticated;
