-- Spending limits, and the summary functions the dashboard reads.
--
-- A limit is household information: everyone can see it, because a limit nobody
-- can read cannot influence anybody's spending. Setting one is an adult
-- decision, matching who may edit a category.

begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ben@test.local', '', now(), now(), now()),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cara@test.local', '', now(), now(), now());

-- Ben joins Ana's household as a viewer. Cara keeps her own.
delete from public.household_members
where user_id = '22222222-2222-4222-8222-222222222222';

insert into public.household_members (household_id, user_id, role)
select household_id, '22222222-2222-4222-8222-222222222222', 'viewer'
from public.household_members
where user_id = '11111111-1111-4111-8111-111111111111';

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

---------------------------------------------------------------------------
-- Setting limits
---------------------------------------------------------------------------

select lives_ok(
  $$insert into public.spending_limits (household_id, category_id, amount_minor, created_by)
    select app.current_household_id(), id, 50000, '11111111-1111-4111-8111-111111111111'
    from public.categories where slug = 'groceries' and household_id is null$$,
  'an owner can set a category limit'
);

select lives_ok(
  $$insert into public.spending_limits (household_id, category_id, amount_minor, created_by)
    values (app.current_household_id(), null, 200000, '11111111-1111-4111-8111-111111111111')$$,
  'and a household-wide one, where the category is null'
);

-- A plain unique index treats every NULL as distinct, so without the partial
-- index a household could accumulate any number of overall limits.
select throws_ok(
  $$insert into public.spending_limits (household_id, category_id, amount_minor, created_by)
    values (app.current_household_id(), null, 300000, '11111111-1111-4111-8111-111111111111')$$,
  '23505',
  null,
  'a second household-wide limit for the same period is refused'
);

select throws_ok(
  $$insert into public.spending_limits (household_id, category_id, amount_minor, created_by)
    select app.current_household_id(), id, 60000, '11111111-1111-4111-8111-111111111111'
    from public.categories where slug = 'groceries' and household_id is null$$,
  '23505',
  null,
  'and so is a second limit for the same category'
);

select throws_ok(
  $$insert into public.spending_limits (household_id, category_id, amount_minor, created_by)
    values (app.current_household_id(), null, 0, '11111111-1111-4111-8111-111111111111')$$,
  '23514',
  null,
  'a limit of zero is not a limit'
);

select is(
  (select period from public.spending_limits where category_id is null),
  'monthly'::public.limit_period,
  'the period defaults to monthly'
);

---------------------------------------------------------------------------
-- The summaries
---------------------------------------------------------------------------

insert into public.expenses
  (household_id, created_by, amount_minor, currency, base_amount_minor, occurred_on, direction, merchant)
select app.current_household_id(), '11111111-1111-4111-8111-111111111111',
       v.amount, 'USD', v.amount, current_date, v.dir::public.expense_direction, v.merchant
from (values
  (1000, 'spend', 'Coffee'),
  (2500, 'spend', 'Lunch'),
  (500000, 'income', 'Salary')
) as v(amount, dir, merchant);

select is(
  (select total_minor from public.expense_summary(current_date, current_date) where direction = 'spend'),
  3500::bigint,
  'the summary totals spending for the period'
);

select is(
  (select total_minor from public.expense_summary(current_date, current_date) where direction = 'income'),
  500000::bigint,
  'and reports income separately rather than netting it off'
);

-- The window is inclusive at both ends, and a date outside it contributes
-- nothing. Getting this wrong shows last month's spending under this month.
select is(
  (select count(*)::int from public.expense_summary(
     current_date - 40, current_date - 30)),
  0,
  'a period with no expenses in it summarises to nothing'
);

-- Income has no category rollup to belong to; counting it would make a salary
-- look like the month's largest outgoing.
select is(
  (select sum(total_minor)::bigint from public.category_summary(current_date, current_date)),
  3500::bigint,
  'the category summary counts spending only'
);

---------------------------------------------------------------------------
-- Ben, a viewer
---------------------------------------------------------------------------

set local request.jwt.claims to
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.spending_limits)::int, 2,
  'a viewer can read the household''s limits'
);

select throws_ok(
  $$insert into public.spending_limits (household_id, category_id, amount_minor, created_by)
    values (app.current_household_id(), null, 100, '22222222-2222-4222-8222-222222222222')$$,
  '42501',
  null,
  'but cannot set one'
);

---------------------------------------------------------------------------
-- Cara, in a different household
---------------------------------------------------------------------------

set local request.jwt.claims to
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

select is(
  (select count(*) from public.spending_limits)::int, 0,
  'another household sees no limits at all'
);

-- The summary functions run as the caller, so they are bounded by the same
-- policies. A function that bypassed them would be a leak wearing a helpful
-- name.
select is(
  (select count(*)::int from public.expense_summary(current_date, current_date)),
  0,
  'and the summary functions reveal nothing across the boundary'
);

select * from finish();

rollback;
