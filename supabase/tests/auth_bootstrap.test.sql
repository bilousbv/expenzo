-- Signing up must produce exactly one profile, one household and one owner
-- membership, in a single transaction. If any part of this drifts, a new user
-- lands with no household and every query they make returns nothing.

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now());

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  1,
  'signing up creates exactly one profile'
);

select is(
  (select display_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'ana',
  'the display name defaults to the local part of the email'
);

select is(
  (select timezone from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'UTC',
  'the profile starts on UTC until the client reports a real zone'
);

select is(
  (select count(*)::int from public.households
   where owner_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'signing up creates exactly one household'
);

select is(
  (select count(*)::int from public.household_members
   where user_id = '11111111-1111-4111-8111-111111111111' and status = 'active'),
  1,
  'signing up creates exactly one active membership'
);

select is(
  (select role::text from public.household_members
   where user_id = '11111111-1111-4111-8111-111111111111'),
  'owner',
  'the new user owns the household they were given'
);

select is(
  (select m.household_id from public.household_members m
   where m.user_id = '11111111-1111-4111-8111-111111111111'),
  (select h.id from public.households h
   where h.owner_id = '11111111-1111-4111-8111-111111111111'),
  'the membership points at the household that was just created'
);

select is(
  (select base_currency from public.households
   where owner_id = '11111111-1111-4111-8111-111111111111'),
  'USD'::char(3),
  'the household starts in USD'
);

-- Deleting the user must not leave a dangling profile behind.
delete from auth.users where id = '11111111-1111-4111-8111-111111111111';

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  0,
  'deleting the user cascades to their profile'
);

select * from finish();

rollback;
