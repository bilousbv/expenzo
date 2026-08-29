-- The day-by-day net a balance swing is built from.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'zoe@test.local', '', now(), now(), now());

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

insert into public.expenses
  (household_id, created_by, amount_minor, currency, occurred_on, direction, merchant)
values
  (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
   100000, 'USD', date '2026-03-01', 'income', 'Salary'),
  (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
   40000, 'USD', date '2026-03-01', 'spend', 'Rent'),
  (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
   25000, 'USD', date '2026-03-05', 'spend', 'Food');

-- Income minus spending, so a day holding both nets to one figure rather than
-- appearing twice with opposite signs.
select is(
  (select net_minor from public.daily_net(date '2026-03-01', date '2026-03-31')
   where occurred_on = date '2026-03-01'),
  60000::bigint,
  'a day with income and spending nets to one figure'
);

select is(
  (select net_minor from public.daily_net(date '2026-03-01', date '2026-03-31')
   where occurred_on = date '2026-03-05'),
  (-25000)::bigint,
  'and a day of pure spending is negative'
);

-- Absent rather than zero. The client walks the window itself, and a row per
-- empty day would mean sending a year of zeroes to describe a quiet year.
select is(
  (select count(*)::int from public.daily_net(date '2026-03-01', date '2026-03-31')),
  2,
  'days with nothing on them are left out rather than returned as zero'
);

select is(
  (select count(*)::int from public.daily_net(date '2026-04-01', date '2026-04-30')),
  0,
  'and a period with nothing in it returns nothing at all'
);

-- The author filter, the same one the dashboard passes.
select is(
  (select count(*)::int from public.daily_net(
     date '2026-03-01', date '2026-03-31', '22222222-2222-4222-8222-222222222222')),
  0,
  'narrowing to another member returns none of this one''s days'
);

---------------------------------------------------------------------------
-- Another household must not appear in it
---------------------------------------------------------------------------

-- SECURITY INVOKER, so row-level security still applies inside the function.
-- A definer here would hand every household's figures to anyone who called it.
set local request.jwt.claims to
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.daily_net(date '2026-03-01', date '2026-03-31')),
  0,
  'and a different household sees none of it'
);

select * from finish();

rollback;
