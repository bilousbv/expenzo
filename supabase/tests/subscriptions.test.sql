-- Subscriptions, the service catalogue, and the renewal arithmetic.
--
-- The arithmetic here mirrors nextRenewalOn in packages/domain/src/renewal.ts.
-- Both must agree: the date the user is shown before saving has to be the date
-- that gets stored, and the upcoming-renewals card reads the stored one.

begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

---------------------------------------------------------------------------
-- Renewal arithmetic
---------------------------------------------------------------------------

-- The case the anchor column exists for. Incrementing the previous date would
-- clamp January's 31st to 28 February and then leave it stuck on the 28th for
-- ever; computing from the anchor every time restores the 31st in March.
select is(app.next_renewal_on(31, 'monthly', 1, date '2026-01-31'), date '2026-02-28',
  'a month-end anchor clamps to a short February');

select is(app.next_renewal_on(31, 'monthly', 1, date '2026-02-28'), date '2026-03-31',
  'and comes back to the 31st the month after, rather than staying clamped');

select is(app.next_renewal_on(31, 'monthly', 1, date '2026-03-31'), date '2026-04-30',
  'clamping again where April is short');

select is(app.next_renewal_on(12, 'monthly', 1, date '2026-01-12'), date '2026-02-12',
  'an ordinary anchor just moves to the next month');

select is(app.next_renewal_on(1, 'monthly', 1, date '2026-12-01'), date '2027-01-01',
  'carrying past December into the next year');

select is(app.next_renewal_on(15, 'weekly', 1, date '2026-08-27'), date '2026-09-03',
  'weekly ignores the anchor day and adds seven days');

select is(app.next_renewal_on(15, 'quarterly', 1, date '2026-01-15'), date '2026-04-15',
  'quarterly moves three months');

select is(app.next_renewal_on(15, 'yearly', 1, date '2026-02-15'), date '2027-02-15',
  'yearly moves twelve');

select is(app.next_renewal_on(15, 'monthly', 3, date '2026-01-15'), date '2026-04-15',
  'an interval count multiplies the cadence');

-- 29 February exists in 2028 and not in 2027.
select is(app.next_renewal_on(29, 'yearly', 1, date '2027-02-28'), date '2028-02-29',
  'a leap day returns when the year has one');

---------------------------------------------------------------------------
-- The service catalogue
---------------------------------------------------------------------------

-- Seeded in a migration rather than seed.sql: production needs it, and
-- seed.sql only runs locally.
select cmp_ok(
  (select count(*) from public.service_catalogue)::int, '>=', 50,
  'the catalogue ships with a useful number of services'
);

select is(
  (select count(*) from public.service_catalogue where slug = 'netflix')::int, 1,
  'including the ones everybody has'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bo@test.local', '', now(), now(), now());

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- Reference data, the same for everyone, with nothing in it to leak.
select cmp_ok(
  (select count(*) from public.service_catalogue)::int, '>', 0,
  'any signed-in user can read the catalogue'
);

select throws_ok(
  $$insert into public.service_catalogue (slug, name) values ('mine', 'Mine')$$,
  '42501',
  null,
  'but nobody can add to it by hand'
);

---------------------------------------------------------------------------
-- Recording a subscription
---------------------------------------------------------------------------

select lives_ok(
  $$insert into public.subscriptions
      (household_id, created_by, name, amount_minor, currency, cadence,
       anchor_day, started_on)
    values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
            'Netflix', 1599, 'USD', 'monthly', 12, current_date - 400)$$,
  'a member can record a subscription'
);

-- Derived by the trigger, never sent by a client: the card that lists what is
-- due next reads this column, and a client that computes it can be wrong.
select is(
  (select next_renewal_on > current_date from public.subscriptions where name = 'Netflix'),
  true,
  'the next renewal is computed and lands in the future'
);

select is(
  (select extract(day from next_renewal_on)::int from public.subscriptions where name = 'Netflix'),
  12,
  'and falls on the anchor day'
);

-- A client that supplies its own is overwritten rather than trusted, exactly
-- as with the converted expense amount.
with forged as (
  insert into public.subscriptions
    (household_id, created_by, name, amount_minor, currency, cadence,
     anchor_day, started_on, next_renewal_on)
  select app.current_household_id(), '11111111-1111-4111-8111-111111111111',
         'Forged', 500, 'USD', 'monthly', 3, current_date - 40, date '1999-01-01'
  returning next_renewal_on
)
select cmp_ok(
  (select next_renewal_on from forged), '>', current_date,
  'a next renewal supplied by the client is recomputed, not trusted'
);

-- A subscription that has not started yet bills first on the day it starts.
with future as (
  insert into public.subscriptions
    (household_id, created_by, name, amount_minor, currency, cadence,
     anchor_day, started_on)
  select app.current_household_id(), '11111111-1111-4111-8111-111111111111',
         'Starts later', 900, 'USD', 'monthly', 5, current_date + 20
  returning next_renewal_on, started_on
)
select is(
  (select next_renewal_on from future),
  (select started_on from future),
  'one that has not started yet renews first on its start date'
);

select throws_ok(
  $$insert into public.subscriptions
      (household_id, created_by, name, amount_minor, currency, cadence,
       anchor_day, started_on)
    values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
            'Free', 0, 'USD', 'monthly', 1, current_date)$$,
  '23514',
  null,
  'an amount of zero is refused by the column, not just the form'
);

select throws_ok(
  $$insert into public.subscriptions
      (household_id, created_by, name, amount_minor, currency, cadence,
       anchor_day, started_on)
    values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
            'Bad anchor', 100, 'USD', 'monthly', 32, current_date)$$,
  '22023',
  null,
  'and so is an anchor day outside a month'
);

---------------------------------------------------------------------------
-- Cancelling keeps the history
---------------------------------------------------------------------------

select lives_ok(
  $$update public.subscriptions set status = 'cancelled' where name = 'Netflix'$$,
  'a subscription can be cancelled'
);

select is(
  (select count(*)::int from public.subscriptions where name = 'Netflix'),
  1,
  'and is still there afterwards, because months of charges are history'
);

-- Nothing is due from something that is no longer running.
select is(
  (select next_renewal_on from public.subscriptions where name = 'Netflix'),
  null,
  'with no next renewal, so it drops out of what is due'
);

select lives_ok(
  $$update public.subscriptions set status = 'active' where name = 'Netflix'$$,
  'reactivating is allowed'
);

select is(
  (select next_renewal_on is not null from public.subscriptions where name = 'Netflix'),
  true,
  'and the schedule comes back'
);

---------------------------------------------------------------------------
-- Row-level security
---------------------------------------------------------------------------

set local request.jwt.claims to
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

-- Bo has his own household from the signup trigger, and none of Ana's rows.
select is(
  (select count(*)::int from public.subscriptions),
  0,
  'another household sees none of them'
);

select is(
  (select count(*)::int from public.subscriptions
   where household_id = '00000000-0000-4000-8000-000000000000'),
  0,
  'and cannot reach them by naming the household either'
);

select throws_ok(
  $$insert into public.subscriptions
      (household_id, created_by, name, amount_minor, currency, cadence,
       anchor_day, started_on)
    values ('00000000-0000-4000-8000-000000000000',
            '22222222-2222-4222-8222-222222222222',
            'Smuggled', 100, 'USD', 'monthly', 1, current_date)$$,
  '42501',
  null,
  'nor write one into a household they do not belong to'
);

select * from finish();

rollback;
