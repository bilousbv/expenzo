-- Subscription categories, and free trials.
--
-- Two changes that arrive together because they are the same screen's problem:
-- what a household pays for every month is filed differently from what it
-- spent last week, and a trial is the part of a subscription where the filing
-- matters most — it is the only window in which cancelling is free.

---------------------------------------------------------------------------
-- Categories come in two kinds
---------------------------------------------------------------------------

-- "Streaming", "Cloud storage" and "Fitness" are answers to "what do we pay
-- for every month". They are not answers to "what did we spend money on last
-- week", and putting both in one list made each of them harder to read.
create type public.category_kind as enum ('expense', 'subscription');

-- Defaulted rather than backfilled: everything that existed before this column
-- did was an expense category, and an unqualified insert still means one.
alter table public.categories
  add column kind public.category_kind not null default 'expense';

-- The slug is unique per taxonomy, not globally. A household that pays for a
-- gym and also buys gym gear legitimately wants "Fitness" in both lists, and
-- one shared unique index would let the first one entered block the second.
drop index public.categories_system_slug_uq;
drop index public.categories_household_slug_uq;

create unique index categories_system_slug_uq
  on public.categories (kind, slug)
  where household_id is null;

create unique index categories_household_slug_uq
  on public.categories (household_id, kind, slug)
  where household_id is not null;

-- Every picker asks for one kind, so the kind belongs in the index between the
-- household and the sort order rather than being filtered afterwards.
drop index public.categories_household_idx;

create index categories_household_idx
  on public.categories (household_id, kind, sort_order)
  where archived_at is null;

-- Seeded in a migration rather than seed.sql, because production needs these
-- too. Deliberately shorter than the expense taxonomy: a household has a dozen
-- subscriptions, not a dozen a month, and a long list to scroll is worse than
-- a short one to choose from.
insert into public.categories (slug, name, icon, color, sort_order, kind)
values
  ('streaming',     'Streaming',        'clapperboard',  '#ec4899', 10,  'subscription'),
  ('music',         'Music',            'music',         '#8b5cf6', 20,  'subscription'),
  ('gaming',        'Gaming',           'gamepad-2',     '#6366f1', 30,  'subscription'),
  ('software',      'Software',         'app-window',    '#337dff', 40,  'subscription'),
  ('cloud',         'Cloud storage',    'cloud',         '#0ea5e9', 50,  'subscription'),
  ('ai',            'AI tools',         'sparkles',      '#14b8a6', 60,  'subscription'),
  ('news',          'News and reading', 'newspaper',     '#78716c', 70,  'subscription'),
  ('fitness',       'Fitness',          'dumbbell',      '#22c55e', 80,  'subscription'),
  ('education',     'Learning',         'graduation-cap','#f59e0b', 90,  'subscription'),
  ('delivery',      'Delivery',         'package',       '#f97316', 100, 'subscription'),
  ('telecom',       'Phone and internet', 'wifi',        '#06b6d4', 110, 'subscription'),
  ('insurance',     'Insurance',        'shield',        '#a855f7', 120, 'subscription'),
  ('uncategorized', 'Uncategorised',    'circle-help',   '#9ca3af', 999, 'subscription');

---------------------------------------------------------------------------
-- Free trials
---------------------------------------------------------------------------

alter table public.subscriptions
  -- A year is the longest trial anybody actually offers; beyond that it is a
  -- typo, and a typo here moves the first charge out of sight.
  add column trial_days int
    check (trial_days is null or trial_days between 1 and 365),
  -- Generated rather than written: two ways to say when the trial ends is one
  -- way for them to disagree, exactly as with next_renewal_on. `date + int` is
  -- immutable, so this can be stored.
  add column trial_ends_on date
    generated always as (
      case when trial_days is null then null else started_on + trial_days end
    ) stored;

-- The card reads this column for what is ending, the same way it reads
-- next_renewal_on for what is billing, so it wants the same shape of index.
create index subscriptions_household_trial_idx
  on public.subscriptions (household_id, trial_ends_on)
  where deleted_at is null and status = 'active' and trial_days is not null;

/**
 * Keeps `next_renewal_on` derived, now with the trial in front of it.
 *
 * Nothing is charged while a trial runs, so the first renewal *is* the day the
 * trial ends rather than a date sitting beside it — one date, so the card
 * cannot show a charge that has not been agreed to yet.
 *
 * After the trial the schedule runs from its end, not from the sign-up date: a
 * trial started on the 1st and lasting 30 days bills on the 31st and monthly
 * from there, which is what the merchant does.
 */
create or replace function app.set_subscription_next_renewal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Computed here rather than read from new.trial_ends_on: Postgres fills
  -- generated columns in *after* BEFORE triggers run, so the stored value is
  -- still null at this point.
  trial_end date := case
    when new.trial_days is null then null
    else new.started_on + new.trial_days
  end;
begin
  -- Nothing is due from something that is not running, and a stale date would
  -- keep it in the upcoming list for ever.
  if new.status <> 'active' or new.deleted_at is not null then
    new.next_renewal_on := null;
    return new;
  end if;

  -- Still inside the free period. The day it runs out is the day money starts
  -- moving, which is the only date worth putting in front of somebody.
  if trial_end is not null and trial_end >= current_date then
    new.next_renewal_on := trial_end;
    return new;
  end if;

  new.next_renewal_on := app.subscription_next_renewal(
    coalesce(trial_end, new.started_on),
    new.anchor_day, new.cadence, new.interval_count, current_date
  );

  return new;
end
$$;
