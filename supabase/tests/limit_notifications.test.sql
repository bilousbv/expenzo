-- Crossing a spending limit produces a notification, once.
--
-- The limits themselves landed with the dashboard, deliberately without this:
-- a trigger that enqueues a notification needs somewhere for the notification
-- to go, and there was no dispatcher. `limit_period_state` is what turns "the
-- household is over budget", which is true every time an expense is added for
-- the rest of the month, into "the household has just gone over budget", which
-- happens once.

begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

---------------------------------------------------------------------------
-- Structure
---------------------------------------------------------------------------

select has_table('public', 'limit_period_state', 'a limit remembers the period it has already broken');
select has_table('public', 'notification_jobs', 'work is queued rather than sent from a trigger');
select has_table('public', 'notification_deliveries', 'and what reached whom is recorded');
select has_table('public', 'notification_preferences', 'each member decides what to be told about');

-- Seeded with the kinds the plan names even though only one is produced yet:
-- adding an enum value later needs a migration of its own, because Postgres
-- refuses to use one in the transaction that added it.
select has_enum('public', 'notification_kind', 'there is a kind of notification');
select results_eq(
  $$ select unnest(enum_range(null::public.notification_kind))::text order by 1 $$,
  $$ values ('limit_exceeded'), ('renewal_upcoming'), ('trial_ending') $$,
  'and the kinds M1 will need are all in it already'
);

---------------------------------------------------------------------------
-- Period bounds, which must agree with limitPeriodBounds in packages/domain
---------------------------------------------------------------------------

select is(
  (select starts_on from app.period_bounds('monthly', '2026-03-15'::date, 1)),
  '2026-03-01'::date,
  'a monthly period starts on the first'
);

select is(
  (select ends_on from app.period_bounds('monthly', '2026-02-15'::date, 1)),
  '2026-02-28'::date,
  'and ends on the last day of that month, however short'
);

select is(
  (select ends_on from app.period_bounds('yearly', '2026-03-15'::date, 1)),
  '2026-12-31'::date,
  'a yearly period runs to the end of December'
);

-- Asserted as properties rather than literals: a weekday hardcoded wrong is a
-- test that passes for the wrong reason.
select is(
  (select ends_on - starts_on from app.period_bounds('weekly', '2026-03-15'::date, 1)),
  6,
  'a weekly period is seven days inclusive'
);

select is(
  (select extract(isodow from starts_on)::int from app.period_bounds('weekly', '2026-03-15'::date, 1)),
  1,
  'starting on the day the household says its week starts'
);

---------------------------------------------------------------------------
-- One household, two limits
---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now());

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- $100 on groceries, $120 for everything.
insert into public.spending_limits (household_id, category_id, amount_minor, period, created_by)
values
  (app.current_household_id(),
   (select id from public.categories where household_id is null and kind = 'expense' and slug = 'groceries'),
   10000, 'monthly', '11111111-1111-4111-8111-111111111111'),
  (app.current_household_id(), null, 12000, 'monthly',
   '11111111-1111-4111-8111-111111111111');

---------------------------------------------------------------------------
-- Spending inside the limits is not news
---------------------------------------------------------------------------

insert into public.expenses
  (household_id, created_by, amount_minor, currency, base_amount_minor,
   category_id, merchant, occurred_on)
values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
        1000, 'USD', 0,
        (select id from public.categories where household_id is null and kind = 'expense' and slug = 'groceries'),
        'Under', current_date);

select is(
  (select count(*) from public.limit_period_state),
  0::bigint,
  'staying under a limit records nothing'
);

select is(
  (select count(*) from public.notification_jobs),
  0::bigint,
  'and notifies nobody'
);

---------------------------------------------------------------------------
-- One expense, two limits, one notification
---------------------------------------------------------------------------

-- $150 of groceries takes the category past $100 and the household past $120
-- in the same statement.
insert into public.expenses
  (household_id, created_by, amount_minor, currency, base_amount_minor,
   category_id, merchant, occurred_on)
values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
        15000, 'USD', 0,
        (select id from public.categories where household_id is null and kind = 'expense' and slug = 'groceries'),
        'Over', current_date);

select is(
  (select count(*) from public.limit_period_state),
  2::bigint,
  'both limits record that this period is broken'
);

-- One purchase, one event. Two notifications for one purchase reads as a bug
-- to the person holding the phone, whatever the data model thinks.
select is(
  (select count(*) from public.notification_jobs),
  1::bigint,
  'but only one notification is queued'
);

select is(
  (select jsonb_array_length(payload -> 'limits') from public.notification_jobs),
  2,
  'naming both of the limits it broke'
);

select is(
  (select kind::text from public.notification_jobs),
  'limit_exceeded',
  'as a limit_exceeded job'
);

---------------------------------------------------------------------------
-- Still over is not news either
---------------------------------------------------------------------------

insert into public.expenses
  (household_id, created_by, amount_minor, currency, base_amount_minor,
   category_id, merchant, occurred_on)
values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
        2000, 'USD', 0,
        (select id from public.categories where household_id is null and kind = 'expense' and slug = 'groceries'),
        'Still over', current_date);

-- Without limit_period_state this is where it would go wrong: every expense for
-- the rest of the month is also "over the limit".
select is(
  (select count(*) from public.notification_jobs),
  1::bigint,
  'spending again while already over notifies nobody a second time'
);

---------------------------------------------------------------------------
-- A different limit in the same period is its own event
---------------------------------------------------------------------------

insert into public.spending_limits (household_id, category_id, amount_minor, period, created_by)
values (app.current_household_id(),
        (select id from public.categories where household_id is null and kind = 'expense' and slug = 'dining'),
        1000, 'monthly', '11111111-1111-4111-8111-111111111111');

insert into public.expenses
  (household_id, created_by, amount_minor, currency, base_amount_minor,
   category_id, merchant, occurred_on)
values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
        5000, 'USD', 0,
        (select id from public.categories where household_id is null and kind = 'expense' and slug = 'dining'),
        'Dinner', current_date);

select is(
  (select count(*) from public.notification_jobs),
  2::bigint,
  'breaking a limit that was still intact is worth saying'
);

---------------------------------------------------------------------------
-- Back-dating into a period nobody can influence any more
---------------------------------------------------------------------------

insert into public.spending_limits (household_id, category_id, amount_minor, period, created_by)
values (app.current_household_id(),
        (select id from public.categories where household_id is null and kind = 'expense' and slug = 'transport'),
        1000, 'monthly', '11111111-1111-4111-8111-111111111111');

-- Dated into last month, which is closed.
insert into public.expenses
  (household_id, created_by, amount_minor, currency, base_amount_minor,
   category_id, merchant, occurred_on)
values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
        9000, 'USD', 0,
        (select id from public.categories where household_id is null and kind = 'expense' and slug = 'transport'),
        'Last month', (date_trunc('month', current_date::timestamp) - interval '1 day')::date);

-- Recorded, so the figure on the screen is right and the period is not
-- reported broken twice if another back-dated expense arrives.
select isnt_empty(
  $$ select 1 from public.limit_period_state s
     join public.spending_limits l on l.id = s.limit_id
     join public.categories c on c.id = l.category_id
     where c.slug = 'transport' $$,
  'a back-dated expense still records that the period was broken'
);

-- A notification about a month you can no longer influence is noise, and a
-- bulk import of last year would fire a burst of them.
select is(
  (select count(*) from public.notification_jobs),
  2::bigint,
  'but nobody is told about a period that has already closed'
);

---------------------------------------------------------------------------
-- Delivery
---------------------------------------------------------------------------

select is(
  public.deliver_notifications(),
  2,
  'delivering turns the queued jobs into deliveries'
);

select is(
  (select count(*) from public.notification_deliveries where status = 'sent'),
  2::bigint,
  'one per member per job, in-app needing nothing but a row'
);

select is(
  (select distinct user_id from public.notification_deliveries),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'addressed to the household member rather than to the household'
);

-- Claimed, not re-read. Two dispatchers must never double-send, which is what
-- FOR UPDATE SKIP LOCKED and a claim column are between them for.
select is(
  public.deliver_notifications(),
  0,
  'delivering again sends nothing twice'
);

---------------------------------------------------------------------------
-- Preferences gate at dispatch, not at enqueue
---------------------------------------------------------------------------

insert into public.notification_preferences (user_id, kind, in_app_enabled)
values ('11111111-1111-4111-8111-111111111111', 'limit_exceeded', false);

insert into public.spending_limits (household_id, category_id, amount_minor, period, created_by)
values (app.current_household_id(),
        (select id from public.categories where household_id is null and kind = 'expense' and slug = 'fuel'),
        1000, 'monthly', '11111111-1111-4111-8111-111111111111');

insert into public.expenses
  (household_id, created_by, amount_minor, currency, base_amount_minor,
   category_id, merchant, occurred_on)
values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
        4000, 'USD', 0,
        (select id from public.categories where household_id is null and kind = 'expense' and slug = 'fuel'),
        'Petrol', current_date);

select is(
  public.deliver_notifications(),
  1,
  'the job is still queued and still claimed'
);

-- Recorded rather than dropped, which is what makes "why did I not get a
-- notification?" answerable at all.
select is(
  (select count(*) from public.notification_deliveries where status = 'suppressed'),
  1::bigint,
  'but a member who turned it off gets a suppressed delivery, not silence'
);

select is(
  (select count(*) from public.notification_deliveries where status = 'sent'),
  2::bigint,
  'and no sent delivery beside it'
);

---------------------------------------------------------------------------
-- Reading one
---------------------------------------------------------------------------

update public.notification_deliveries set read_at = now() where status = 'sent';

select is(
  (select count(*) from public.notification_deliveries where read_at is not null),
  2::bigint,
  'a member can mark their own delivery read'
);

select * from finish();

rollback;
