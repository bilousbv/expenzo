-- Expense visibility and write rules.
--
-- Product decision encoded here: every member of a household sees every
-- expense, and each one is attributed to its author. There is no personal/
-- shared split any more — `created_by` is information, not a permission.
--
-- Write rights are narrower than read rights: the author may always edit their
-- own, owners and adults may edit anyone's, and viewers may edit nothing.
-- Because adults can edit each other's expenses, every such change is recorded
-- in expense_audit.

begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ben@test.local', '', now(), now(), now()),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cara@test.local', '', now(), now(), now()),
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dev@test.local', '', now(), now(), now());

-- Ben joins Ana's household as an adult, Dev as a viewer. Cara keeps her own.
delete from public.household_members
where user_id in ('22222222-2222-4222-8222-222222222222',
                  '44444444-4444-4444-8444-444444444444');

insert into public.household_members (household_id, user_id, role)
select household_id, '22222222-2222-4222-8222-222222222222', 'adult'
from public.household_members
where user_id = '11111111-1111-4111-8111-111111111111';

insert into public.household_members (household_id, user_id, role)
select household_id, '44444444-4444-4444-8444-444444444444', 'viewer'
from public.household_members
where user_id = '11111111-1111-4111-8111-111111111111';

---------------------------------------------------------------------------
-- The column is gone, not merely unused
---------------------------------------------------------------------------

select hasnt_column(
  'public', 'expenses', 'visibility',
  'expenses no longer carries a visibility column'
);

select ok(
  not exists (select 1 from pg_type where typname = 'visibility'),
  'and the enum backing it has been dropped'
);

---------------------------------------------------------------------------
-- Ana, the owner, records two expenses
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

insert into public.expenses
  (household_id, created_by, amount_minor, currency, base_amount_minor, occurred_on, merchant)
values
  (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
   1250, 'USD', 1250, current_date, 'Blue Bottle Coffee'),
  (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
   9900, 'USD', 9900, current_date, 'Bookshop');

select is(
  (select count(*) from public.expenses)::int, 2,
  'the author sees both of their own expenses'
);

-- Attribution is still enforced on insert: an expense cannot be filed under
-- somebody else's name, which is what makes the author label trustworthy.
select throws_ok(
  $$insert into public.expenses
      (household_id, created_by, amount_minor, currency, base_amount_minor, occurred_on)
    values (app.current_household_id(), '22222222-2222-4222-8222-222222222222',
            100, 'USD', 100, current_date)$$,
  '42501',
  null,
  'an expense cannot be attributed to another member'
);

---------------------------------------------------------------------------
-- Ben, an adult in the same household
---------------------------------------------------------------------------

set local request.jwt.claims to
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

-- Documents the resulting behaviour rather than proving the change: with the
-- column gone there is no way to write a row this could miss. The two
-- assertions at the top are what actually bite — run against the previous
-- schema they fail and these do not, because `visibility` defaulted to
-- 'shared' and a test cannot create a personal row any more.
select is(
  (select count(*) from public.expenses)::int, 2,
  'another member sees every expense in the household, not a subset'
);

select is(
  (select count(distinct created_by) from public.expenses)::int, 1,
  'and every one of them is attributed to the member who entered it'
);

select lives_ok(
  $$update public.expenses set amount_minor = 1300, base_amount_minor = 1300
    where merchant = 'Blue Bottle Coffee'$$,
  'an adult can edit another member''s expense'
);

select is(
  (select actor_id from public.expense_audit where action = 'update'),
  '22222222-2222-4222-8222-222222222222'::uuid,
  'the audit row names the editor, not the original author'
);

-- The UPDATE trap: without WITH CHECK, a member passes the read test on the old
-- row and then rewrites household_id on the new one, moving it out of reach.
select throws_ok(
  $$update public.expenses
    set household_id = '00000000-0000-4000-8000-000000000099'
    where merchant = 'Bookshop'$$,
  null,
  null,
  'an expense cannot be moved to another household'
);

select throws_ok(
  $$update public.expenses
    set created_by = '22222222-2222-4222-8222-222222222222'
    where merchant = 'Bookshop'$$,
  null,
  null,
  'an expense cannot be reattributed to a different member'
);

---------------------------------------------------------------------------
-- Dev, a viewer in the same household
---------------------------------------------------------------------------

set local request.jwt.claims to
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';

select is(
  (select count(*) from public.expenses)::int, 2,
  'a viewer reads every expense too'
);

-- Read access is now household-wide, so the viewer role only means anything if
-- writes are still refused. A policy that matches no row updates none rather
-- than raising, so the assertion has to count what the statement touched.
with touched as (
  update public.expenses set amount_minor = 1 where merchant = 'Bookshop' returning 1
)
select is(
  (select count(*)::int from touched), 0,
  'a viewer cannot edit an expense'
);

---------------------------------------------------------------------------
-- Cara, in a different household
---------------------------------------------------------------------------

set local request.jwt.claims to
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

select is(
  (select count(*) from public.expenses)::int, 0,
  'another household still sees nothing at all'
);

select * from finish();

rollback;
