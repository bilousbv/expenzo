-- Free trials, and what they do to the billing date.
--
-- A trial is not a subscription that bills today and refunds later: nothing is
-- charged until it ends, and the day it ends is the day the money starts
-- moving. That is why the trial end *is* the first renewal rather than a
-- separate date sitting beside one.

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select has_column('public', 'subscriptions', 'trial_days', 'a subscription can carry a trial length');
select has_column('public', 'subscriptions', 'trial_ends_on', 'and the day that trial runs out');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now());

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

---------------------------------------------------------------------------
-- A trial that is still running
---------------------------------------------------------------------------

insert into public.subscriptions
  (household_id, created_by, name, amount_minor, currency, cadence,
   anchor_day, started_on, trial_days)
values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
        'Trialling', 1599, 'USD', 'monthly', 12, current_date - 3, 30);

select is(
  (select trial_ends_on from public.subscriptions where name = 'Trialling'),
  current_date + 27,
  'the end of the trial is derived from the start rather than asked for twice'
);

-- The whole point of the feature: what the dashboard puts in front of somebody
-- is the day the free period runs out, not a charge that has not happened.
select is(
  (select next_renewal_on from public.subscriptions where name = 'Trialling'),
  current_date + 27,
  'and nothing bills until then, so the first charge is the day it ends'
);

---------------------------------------------------------------------------
-- A trial that has already run out
---------------------------------------------------------------------------

insert into public.subscriptions
  (household_id, created_by, name, amount_minor, currency, cadence,
   anchor_day, started_on, trial_days)
values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
        'Converted', 1000, 'USD', 'monthly',
        extract(day from current_date - 10)::int, current_date - 40, 30);

select cmp_ok(
  (select next_renewal_on from public.subscriptions where name = 'Converted'),
  '>', current_date,
  'once the trial is over the ordinary schedule takes back over'
);

-- Billing runs from the first charge, not from the day the free period began:
-- a trial that started on the 1st and ran 30 days bills on the 31st thereafter.
select is(
  (select extract(day from next_renewal_on)::int
     from public.subscriptions where name = 'Converted'),
  extract(day from current_date - 10)::int,
  'and its phase follows the end of the trial rather than the sign-up date'
);

---------------------------------------------------------------------------
-- The ordinary case is untouched
---------------------------------------------------------------------------

insert into public.subscriptions
  (household_id, created_by, name, amount_minor, currency, cadence,
   anchor_day, started_on)
values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
        'Plain', 500, 'USD', 'monthly', 12, current_date - 40);

select is(
  (select trial_ends_on from public.subscriptions where name = 'Plain'),
  null,
  'a subscription with no trial has no trial end'
);

select is(
  (select extract(day from next_renewal_on)::int from public.subscriptions where name = 'Plain'),
  12,
  'and still bills on its anchor day'
);

---------------------------------------------------------------------------
-- What a client may not do
---------------------------------------------------------------------------

-- Derived, exactly like next_renewal_on: two ways to say when the trial ends
-- is one way for them to disagree.
select throws_ok(
  $$insert into public.subscriptions
      (household_id, created_by, name, amount_minor, currency, cadence,
       anchor_day, started_on, trial_days, trial_ends_on)
    values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
            'Forged', 500, 'USD', 'monthly', 3, current_date, 14, current_date + 900)$$,
  '428C9',
  null,
  'a client cannot supply the trial end itself'
);

select throws_ok(
  $$insert into public.subscriptions
      (household_id, created_by, name, amount_minor, currency, cadence,
       anchor_day, started_on, trial_days)
    values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
            'Silly', 500, 'USD', 'monthly', 3, current_date, 0)$$,
  '23514',
  null,
  'and a trial of no days is a mistake rather than a trial'
);

-- Cancelling during a trial stops it being due, matching every other
-- cancellation: a stale date would keep it on the card for ever.
update public.subscriptions set status = 'cancelled' where name = 'Trialling';

select is(
  (select next_renewal_on from public.subscriptions where name = 'Trialling'),
  null,
  'cancelling during a trial takes it out of what is due'
);

select * from finish();

rollback;
