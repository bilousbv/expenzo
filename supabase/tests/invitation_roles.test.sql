-- Invitations that carry a role, and managing the people who accepted them.
--
-- The sibling file invitations.test.sql covers the token itself — entropy,
-- hashing, one-time use, expiry. This one covers who arrives as what, and what
-- an adult may afterwards do to them.

begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@roles.local', '', now(), now(), now()),
  ('bbbbbbbb-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ben@roles.local', '', now(), now(), now()),
  ('cccccccc-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cara@roles.local', '', now(), now(), now());

-- A child is a role the database knows, not a flag the client keeps.
select is(
  (select count(*)::int
   from pg_enum e join pg_type t on t.oid = e.enumtypid
   where t.typname = 'member_role' and e.enumlabel = 'child'),
  1,
  'member_role carries child'
);

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"aaaaaaaa-1111-4111-8111-111111111111","role":"authenticated"}';

-- Ana invites Ben without saying what he is, and Cara as a child.
create temporary table issued as
select public.create_household_invitation('ben@roles.local') as ben_token,
       public.create_household_invitation('cara@roles.local', 'child') as cara_token;

select is(
  (select role::text from public.household_invitations where email = 'ben@roles.local'),
  'adult',
  'an invitation that names no role invites an adult'
);

select is(
  (select role::text from public.household_invitations where email = 'cara@roles.local'),
  'child',
  'and one that does records it'
);

-- What the landing page reads before anybody has signed in.
select is(
  (select invitee_email from public.invitation_preview((select cara_token from issued))),
  'cara@roles.local',
  'the preview names the address the invitation was sent to'
);

select is(
  (select household_name from public.invitation_preview((select cara_token from issued))),
  (select name from public.households where owner_id = 'aaaaaaaa-1111-4111-8111-111111111111'),
  'and the household doing the inviting'
);

-- Which of the three landing branches to take turns on this one boolean.
select is(
  (select account_exists from public.invitation_preview((select cara_token from issued))),
  true,
  'an invitee who already has an account is reported as having one'
);

set local role postgres;
update public.household_invitations set email = 'nobody@roles.local'
where email = 'ben@roles.local';
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"aaaaaaaa-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  (select account_exists from public.invitation_preview((select ben_token from issued))),
  false,
  'and one who does not is reported as not having one'
);

select is(
  (select count(*)::int from public.invitation_preview('not-a-real-token')),
  0,
  'an unknown token previews nothing at all'
);

-- Cara joins as the child she was invited as.
set local request.jwt.claims to
  '{"sub":"cccccccc-3333-4333-8333-333333333333","role":"authenticated"}';

select lives_ok(
  format('select public.accept_household_invitation(%L)', (select cara_token from issued)),
  'a child invitation is accepted'
);

select is(
  (select role::text from public.household_members
   where user_id = 'cccccccc-3333-4333-8333-333333333333' and status = 'active'),
  'child',
  'and the joiner arrives holding that role'
);

-- A child administers nothing. This is the same pair the expense policies use
-- for editing somebody else's row.
select throws_ok(
  $$select public.create_household_invitation('dan@roles.local')$$,
  '42501', null,
  'a child cannot invite anyone'
);

select throws_ok(
  $$select public.remove_household_member('aaaaaaaa-1111-4111-8111-111111111111')$$,
  '42501', null,
  'a child cannot remove anyone'
);

-- Ana, back in charge.
set local request.jwt.claims to
  '{"sub":"aaaaaaaa-1111-4111-8111-111111111111","role":"authenticated"}';

select lives_ok(
  $$select public.set_member_role('cccccccc-3333-4333-8333-333333333333', 'adult')$$,
  'an adult can change what a member is'
);

select throws_ok(
  $$select public.set_member_role('cccccccc-3333-4333-8333-333333333333', 'owner')$$,
  '42501', null,
  'and cannot hand out the owner role'
);

-- The owner's membership is what households.owner_id points at. Removing it
-- would leave a household with rows in it and nobody able to administer them.
select throws_ok(
  $$select public.remove_household_member('aaaaaaaa-1111-4111-8111-111111111111')$$,
  '42501', null,
  'the owner cannot be removed'
);

select lives_ok(
  $$select public.remove_household_member('cccccccc-3333-4333-8333-333333333333')$$,
  'anyone else can'
);

select is(
  (select count(*)::int from public.household_members
   where user_id = 'cccccccc-3333-4333-8333-333333333333' and status = 'active'),
  0,
  'and is left with no active membership'
);

select * from finish();

rollback;
