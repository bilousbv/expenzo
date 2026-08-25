-- Category visibility and write rules.
--
-- Categories are the one table with two kinds of row in it: system categories
-- (household_id is null) that everybody reads and nobody edits, and custom ones
-- belonging to a single household. The policy has to serve both, and getting it
-- wrong in either direction is quiet — a leak looks like a longer picker, and an
-- over-restriction looks like an empty one.

begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ben@test.local', '', now(), now(), now()),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cara@test.local', '', now(), now(), now());

-- Ben joins Ana's household as a viewer; Cara keeps her own.
delete from public.household_members
where user_id = '22222222-2222-4222-8222-222222222222';

insert into public.household_members (household_id, user_id, role)
select household_id, '22222222-2222-4222-8222-222222222222', 'viewer'
from public.household_members
where user_id = '11111111-1111-4111-8111-111111111111';

---------------------------------------------------------------------------
-- Ana, the owner
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  (select count(*) from public.categories where household_id is null)::int,
  (select count(*) from public.categories where is_system)::int,
  'is_system is generated from household_id and cannot disagree with it'
);

select cmp_ok(
  (select count(*) from public.categories where is_system)::int, '>=', 15,
  'the seeded system taxonomy is readable by an ordinary member'
);

select lives_ok(
  $$insert into public.categories (household_id, slug, name, color)
    values (app.current_household_id(), 'coffee', 'Coffee', '#337dff')$$,
  'an owner can add a category to their own household'
);

-- The unique index is partial: one per household for custom rows, one globally
-- for system rows.
select throws_ok(
  $$insert into public.categories (household_id, slug, name)
    values (app.current_household_id(), 'coffee', 'Coffee again')$$,
  '23505',
  null,
  'the same slug cannot be used twice in one household'
);

-- Only a household can be named, and only the caller's own. Without WITH CHECK
-- on the write policy this would plant a category in a stranger's picker.
select throws_ok(
  $$insert into public.categories (household_id, slug, name)
    values ('00000000-0000-4000-8000-000000000099', 'stray', 'Stray')$$,
  '42501',
  null,
  'a category cannot be created in another household'
);

-- A system category has a null household_id, which no member's
-- current_household_id() can equal, so the write policy excludes it.
select throws_ok(
  $$insert into public.categories (slug, name) values ('invented', 'Invented')$$,
  '42501',
  null,
  'a member cannot create a system category'
);

-- A policy that excludes a row makes UPDATE and DELETE match nothing rather
-- than raise, so the assertion has to count the rows the statement touched.
-- The write has to sit in a data-modifying CTE: an UPDATE is not a table
-- expression and cannot be put in a subquery.
with touched as (
  update public.categories set name = 'Food shopping'
  where slug = 'groceries' and household_id is null
  returning 1
)
select is(
  (select count(*)::int from touched), 0,
  'a system category cannot be renamed'
);

with removed as (
  delete from public.categories where slug = 'groceries' and household_id is null
  returning 1
)
select is(
  (select count(*)::int from removed), 0,
  'a system category cannot be deleted'
);

---------------------------------------------------------------------------
-- Ben, a viewer in the same household
---------------------------------------------------------------------------

set local request.jwt.claims to
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.categories where slug = 'coffee')::int, 1,
  'a viewer reads the household''s custom categories'
);

-- Viewers are read-only by design. The write policy names the roles rather than
-- excluding 'viewer', so a role added later is denied until it is listed.
with touched as (
  update public.categories set name = 'Espresso' where slug = 'coffee' returning 1
)
select is(
  (select count(*)::int from touched), 0,
  'a viewer cannot rename a category'
);

---------------------------------------------------------------------------
-- Cara, in a different household
---------------------------------------------------------------------------

set local request.jwt.claims to
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

select is(
  (select count(*) from public.categories where slug = 'coffee')::int, 0,
  'another household cannot see a custom category'
);

-- The same slug in two households is not a conflict: the unique index is
-- per household, which is what makes the taxonomy customisable at all.
select lives_ok(
  $$insert into public.categories (household_id, slug, name)
    values (app.current_household_id(), 'coffee', 'Coffee')$$,
  'the same slug is free in a different household'
);

select * from finish();

rollback;
