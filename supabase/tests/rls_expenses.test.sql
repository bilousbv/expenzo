-- Expense visibility and write rules.
--
-- Product decisions encoded here: shared items are visible to the whole
-- household and editable by any adult; personal items belong to their creator
-- alone. Because adults can edit each other's shared items, every such change
-- is recorded in expense_audit.

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ben@test.local', '', now(), now(), now()),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cara@test.local', '', now(), now(), now());

delete from public.household_members
where user_id = '22222222-2222-4222-8222-222222222222';

insert into public.household_members (household_id, user_id, role)
select household_id, '22222222-2222-4222-8222-222222222222', 'adult'
from public.household_members
where user_id = '11111111-1111-4111-8111-111111111111';

-- Ana adds one shared and one personal expense.
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

insert into public.expenses
  (household_id, created_by, visibility, amount_minor, currency, base_amount_minor, occurred_on, merchant)
values
  (app.current_household_id(), '11111111-1111-4111-8111-111111111111', 'shared',
   1250, 'USD', 1250, current_date, 'Blue Bottle Coffee'),
  (app.current_household_id(), '11111111-1111-4111-8111-111111111111', 'personal',
   9900, 'USD', 9900, current_date, 'Private Purchase');

select is(
  (select count(*) from public.expenses)::int, 2,
  'the creator sees both their shared and personal expenses'
);

-- Ana cannot attribute an expense to Ben.
select throws_ok(
  $$insert into public.expenses
      (household_id, created_by, visibility, amount_minor, currency, base_amount_minor, occurred_on)
    values (app.current_household_id(), '22222222-2222-4222-8222-222222222222', 'shared',
            100, 'USD', 100, current_date)$$,
  '42501',
  null,
  'an expense cannot be attributed to another member'
);

-- Ben, an adult in the same household.
set local request.jwt.claims to
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.expenses)::int, 1,
  'a household member sees shared expenses but not personal ones'
);

select is(
  (select merchant from public.expenses), 'Blue Bottle Coffee',
  'the visible expense is the shared one'
);

-- Adults may edit each other's shared items. This was a deliberate product
-- choice, and it is why the audit table exists.
select lives_ok(
  $$update public.expenses set amount_minor = 1300, base_amount_minor = 1300
    where visibility = 'shared'$$,
  'an adult can edit another member''s shared expense'
);

select is(
  (select count(*)::int from public.expense_audit where action = 'update'),
  1,
  'editing another member''s expense is recorded in the audit trail'
);

select is(
  (select actor_id from public.expense_audit where action = 'update'),
  '22222222-2222-4222-8222-222222222222'::uuid,
  'the audit row names the editor, not the original creator'
);

-- The UPDATE trap: without WITH CHECK, a member passes the read test on the old
-- row and then rewrites household_id on the new one, moving it out of reach.
select throws_ok(
  $$update public.expenses
    set household_id = '00000000-0000-4000-8000-000000000099'
    where visibility = 'shared'$$,
  null,
  null,
  'an expense cannot be moved to another household'
);

select throws_ok(
  $$update public.expenses
    set created_by = '22222222-2222-4222-8222-222222222222'
    where visibility = 'shared'$$,
  null,
  null,
  'an expense cannot be reattributed to a different member'
);

-- Cara is in a different household entirely.
set local request.jwt.claims to
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

select is(
  (select count(*) from public.expenses)::int, 0,
  'another household sees nothing at all'
);

select is(
  (select count(*) from public.expenses where merchant = 'Blue Bottle Coffee')::int, 0,
  'and cannot reach a specific row by filtering for it'
);

select * from finish();

rollback;
