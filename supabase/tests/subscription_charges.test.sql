-- A subscription that has billed becomes an expense.
--
-- Until now a subscription was a promise about the future and nothing else: it
-- said what would be charged and when, and the money never appeared in the
-- ledger it was charged against. A household paying for eight services read a
-- monthly total that was missing all eight of them.
--
-- Posting is a database function rather than a client loop for two reasons.
-- The expense is attributed to whoever entered the subscription, not to
-- whoever happened to open the app, and the insert policy would not let a
-- client write somebody else's `created_by`. And it has to be safe to run on
-- every single visit, which is what the unique index on
-- (subscription_id, occurred_on) buys.

begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

---------------------------------------------------------------------------
-- Structure
---------------------------------------------------------------------------

select has_column(
  'public', 'expenses', 'subscription_id',
  'an expense can say which subscription charged it'
);

-- The whole idempotence story rests on this index, so it is asserted directly
-- rather than only through the behaviour it produces.
select is(
  (select indisunique from pg_index where indexrelid = 'public.expenses_subscription_charge_uq'::regclass),
  true,
  'one subscription bills a given day exactly once'
);

select has_function(
  'public', 'post_subscription_charges', array['date', 'date'],
  'and there is a function that writes those charges'
);

---------------------------------------------------------------------------
-- One household, one member
---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now());

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

---------------------------------------------------------------------------
-- A charge that fell due today
---------------------------------------------------------------------------

insert into public.subscriptions
  (household_id, created_by, name, amount_minor, currency, cadence,
   anchor_day, started_on)
values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
        'Posted Today', 1599, 'USD', 'monthly',
        extract(day from current_date)::int, current_date);

select is(
  public.post_subscription_charges(current_date, current_date),
  1,
  'a subscription billing today produces one expense'
);

select is(
  (select amount_minor from public.expenses where merchant = 'Posted Today'),
  1599::bigint,
  'for what the subscription costs'
);

select is(
  (select occurred_on from public.expenses where merchant = 'Posted Today'),
  current_date,
  'dated the day it billed'
);

-- The system "Subscriptions" category already existed in the expense taxonomy
-- and had nothing filed under it, because nothing was ever posted there.
select is(
  (select c.slug
     from public.expenses e
     join public.categories c on c.id = e.category_id
    where e.merchant = 'Posted Today'),
  'subscriptions',
  'filed under the Subscriptions expense category'
);

select is(
  (select source::text from public.expenses where merchant = 'Posted Today'),
  'subscription',
  'and marked as having come from a subscription rather than typed in'
);

select is(
  (select direction::text from public.expenses where merchant = 'Posted Today'),
  'spend',
  'money going out, so it counts against the budget'
);

select is(
  (select subscription_id from public.expenses where merchant = 'Posted Today'),
  (select id from public.subscriptions where name = 'Posted Today'),
  'linked back to the subscription that produced it'
);

-- Attributed to whoever entered the subscription rather than to whoever opened
-- the app. Both are the same person here; the assertion is that the column is
-- read off the subscription at all, which is what needs SECURITY DEFINER.
select is(
  (select e.created_by
     from public.expenses e
    where e.merchant = 'Posted Today'),
  (select s.created_by from public.subscriptions s where s.name = 'Posted Today'),
  'and authored by whoever entered the subscription'
);

-- The ordinary write-time conversion applies: the household reads in USD and
-- the charge is in USD, so the frozen figure is the amount itself.
select is(
  (select base_amount_minor from public.expenses where merchant = 'Posted Today'),
  1599::bigint,
  'converted into the household base currency like any other expense'
);

---------------------------------------------------------------------------
-- Running it again is free
---------------------------------------------------------------------------

select is(
  public.post_subscription_charges(current_date, current_date),
  0,
  'posting the same window twice adds nothing'
);

select is(
  (select count(*) from public.expenses where merchant = 'Posted Today'),
  1::bigint,
  'so a household that opens the app twice is not charged twice'
);

---------------------------------------------------------------------------
-- Deleting a posted charge is a decision, not a glitch
---------------------------------------------------------------------------

update public.expenses set deleted_at = now() where merchant = 'Posted Today';

-- The unique index deliberately carries no `deleted_at is null` predicate.
-- With one, deleting a charge would make it reappear on the next visit, which
-- is the most annoying behaviour this feature could possibly have.
select is(
  public.post_subscription_charges(current_date, current_date),
  0,
  'a charge that was deleted does not come back'
);

select is(
  (select count(*) from public.expenses where merchant = 'Posted Today'),
  1::bigint,
  'and no second copy is written beside it'
);

---------------------------------------------------------------------------
-- What is not posted
---------------------------------------------------------------------------

insert into public.subscriptions
  (household_id, created_by, name, amount_minor, currency, cadence,
   anchor_day, started_on)
values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
        'Starts Tomorrow', 500, 'USD', 'monthly',
        extract(day from current_date + 1)::int, current_date + 1);

select is(
  public.post_subscription_charges(current_date, current_date),
  0,
  'nothing is posted for a subscription that has not started'
);

insert into public.subscriptions
  (household_id, created_by, name, amount_minor, currency, cadence,
   anchor_day, started_on, status)
values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
        'Already Cancelled', 700, 'USD', 'monthly',
        extract(day from current_date)::int, current_date, 'cancelled');

-- A cancelled subscription records no date it was cancelled on, so there is no
-- honest way to know which of its charges were taken. Posting none of them is
-- the only answer that cannot invent money.
select is(
  public.post_subscription_charges(current_date, current_date),
  0,
  'nor for one that has been cancelled'
);

-- The far end of the window is clamped to today whatever is asked for: a
-- renewal date is a promise until the day arrives.
select is(
  public.post_subscription_charges(current_date, current_date + 30),
  0,
  'and never for a date that has not happened yet'
);

---------------------------------------------------------------------------
-- Catching up on a window that was missed
---------------------------------------------------------------------------

insert into public.subscriptions
  (household_id, created_by, name, amount_minor, currency, cadence,
   anchor_day, started_on)
values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
        'Weekly Post', 300, 'USD', 'weekly', 1, current_date - 21);

select is(
  public.post_subscription_charges(current_date - 21, current_date),
  4,
  'every charge inside the window is posted, not only the latest'
);

select is(
  (select array_agg(occurred_on order by occurred_on)
     from public.expenses where merchant = 'Weekly Post'),
  array[current_date - 21, current_date - 14, current_date - 7, current_date]::date[],
  'on the days the schedule says, walked from the anchor'
);

---------------------------------------------------------------------------
-- Two subscriptions billing on the same day
---------------------------------------------------------------------------

-- The unique index is on (subscription_id, occurred_on), not on the day alone.
-- A household paying for two services on the first of the month is ordinary,
-- and only one of them appearing would be the sort of quiet loss that never
-- gets noticed.
insert into public.subscriptions
  (household_id, created_by, name, amount_minor, currency, cadence,
   anchor_day, started_on)
values
  (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
   'Twin One', 111, 'USD', 'monthly', extract(day from current_date)::int, current_date),
  (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
   'Twin Two', 222, 'USD', 'monthly', extract(day from current_date)::int, current_date);

select is(
  public.post_subscription_charges(current_date, current_date),
  2,
  'two subscriptions billing the same day post two expenses'
);

select is(
  (select count(*) from public.expenses
    where merchant in ('Twin One', 'Twin Two') and occurred_on = current_date),
  2::bigint,
  'one each, rather than one between them'
);

---------------------------------------------------------------------------
-- The default window, and its bounds
---------------------------------------------------------------------------

insert into public.subscriptions
  (household_id, created_by, name, amount_minor, currency, cadence,
   anchor_day, started_on)
values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
        'This Month', 1200, 'USD', 'monthly', 1,
        date_trunc('month', current_date::timestamp)::date);

select is(
  public.post_subscription_charges(),
  1,
  'called with no window at all it covers the month so far'
);

select is(
  public.post_subscription_charges(current_date, current_date - 5),
  0,
  'a window that ends before it starts posts nothing rather than failing'
);

-- Backfilling years of history from one dashboard visit is not something to
-- discover in production. The client only ever asks for the period on screen.
select throws_ok(
  $$ select public.post_subscription_charges(current_date - 400, current_date) $$,
  '22023',
  'a posting window cannot be wider than a year',
  'a window wider than a year is refused'
);

select * from finish();

rollback;
