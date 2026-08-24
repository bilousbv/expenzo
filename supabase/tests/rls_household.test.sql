-- Membership visibility, and the recursion regression that motivates the whole
-- SECURITY DEFINER helper.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

-- Two users in one household, one user in another.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ben@test.local', '', now(), now(), now()),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cara@test.local', '', now(), now(), now());

-- The signup trigger gives each user a household. Ana and Ben then share one.
delete from public.household_members
where user_id = '22222222-2222-4222-8222-222222222222';

insert into public.household_members (household_id, user_id, role)
select household_id, '22222222-2222-4222-8222-222222222222', 'adult'
from public.household_members
where user_id = '11111111-1111-4111-8111-111111111111';

-- Act as Ana.
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- The regression test. A policy on household_members that reads
-- household_members raises 42P17 infinite recursion. It must not.
select lives_ok(
  'select count(*) from public.household_members',
  'selecting household_members does not recurse'
);

select is(
  (select count(*) from public.household_members)::int,
  2,
  'a member sees their whole household roster and nothing else'
);

select is(
  (select app.current_household_id()),
  (select household_id from public.household_members
   where user_id = '11111111-1111-4111-8111-111111111111'),
  'current_household_id resolves to the caller household'
);

select is(
  (select app.current_member_role())::text,
  'owner',
  'the creating user owns their household'
);

-- Clients never write membership directly; joining goes through
-- app.accept_invitation, so no INSERT policy exists and default-deny stands.
select throws_ok(
  $$insert into public.household_members (household_id, user_id, role)
    values (app.current_household_id(), '33333333-3333-4333-8333-333333333333', 'adult')$$,
  '42501',
  null,
  'a member cannot write themselves or anyone else into a household'
);

-- Act as Cara, who is in a different household.
set local request.jwt.claims to
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

select is(
  (select count(*) from public.household_members)::int,
  1,
  'an outsider sees only their own membership'
);

select isnt(
  (select app.current_household_id()),
  (select household_id from public.household_members
   where user_id = '11111111-1111-4111-8111-111111111111'),
  'an outsider resolves to a different household'
);

-- Households themselves are not enumerable.
select is(
  (select count(*) from public.households)::int,
  1,
  'a user sees only their own household row'
);

select * from finish();

rollback;
