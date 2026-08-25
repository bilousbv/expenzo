-- Household invitations.
--
-- Members are never written directly by clients: household_members has no
-- INSERT policy at all, so joining has to go through accept_household_invitation.
-- These tests are what stop that door being propped open.

begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ben@test.local', '', now(), now(), now()),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cara@test.local', '', now(), now(), now());

-- Ana, owner of her own household, invites Ben.
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

create temporary table issued as
select public.create_household_invitation('ben@test.local') as first_token;

select isnt(
  (select first_token from issued), null,
  'creating an invitation returns a token'
);

select cmp_ok(
  length((select first_token from issued)), '>=', 32,
  'the token has enough entropy to be unguessable'
);

-- The token is a bearer credential: only its hash may be stored, so a database
-- leak does not hand over household access.
select is(
  (select count(*)::int from public.household_invitations
   where token_hash = (select first_token from issued)),
  0,
  'the raw token is never stored'
);

select is(
  (select count(*)::int from public.household_invitations
   where household_id = app.current_household_id() and status = 'pending'),
  1,
  'a pending invitation is recorded'
);

-- Re-inviting the same address supersedes the previous invitation rather than
-- stacking pending rows.
alter table issued add column second_token text;
update issued set second_token = public.create_household_invitation('ben@test.local');

select is(
  (select count(*)::int from public.household_invitations
   where household_id = app.current_household_id() and status = 'pending'),
  1,
  're-inviting replaces the pending invitation rather than duplicating it'
);

select isnt(
  (select second_token from issued), (select first_token from issued),
  'the replacement carries a different token'
);

-- Ben accepts, using the current link.
set local request.jwt.claims to
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

-- The superseded link must be dead, or revoking access would be impossible.
select throws_ok(
  format('select public.accept_household_invitation(%L)', (select first_token from issued)),
  null, null,
  'the superseded token no longer works'
);

select lives_ok(
  format('select public.accept_household_invitation(%L)', (select second_token from issued)),
  'the current token is accepted'
);

select is(
  (select count(*)::int from public.household_members
   where user_id = '22222222-2222-4222-8222-222222222222' and status = 'active'),
  1,
  'the joiner ends up with exactly one active membership'
);

select is(
  (select m.household_id from public.household_members m
   where m.user_id = '22222222-2222-4222-8222-222222222222' and m.status = 'active'),
  (select h.id from public.households h
   where h.owner_id = '11111111-1111-4111-8111-111111111111'),
  'and it is the inviting household'
);

select is(
  (select role::text from public.household_members
   where user_id = '22222222-2222-4222-8222-222222222222' and status = 'active'),
  'adult',
  'a joiner arrives as an adult, not an owner'
);

-- Replaying the same token must not work; one-time use is the whole point.
select throws_ok(
  format('select public.accept_household_invitation(%L)', (select second_token from issued)),
  null, null,
  'a token cannot be redeemed twice'
);

select throws_ok(
  $$select public.accept_household_invitation('not-a-real-token')$$,
  null, null,
  'an unknown token is rejected'
);

-- Expiry is enforced, not merely recorded.
set local role postgres;
update public.household_invitations
set status = 'pending', accepted_by = null, accepted_at = null,
    expires_at = now() - interval '1 day'
where token_hash = encode(extensions.digest((select second_token from issued), 'sha256'), 'hex');

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

select throws_ok(
  format('select public.accept_household_invitation(%L)', (select second_token from issued)),
  null, null,
  'an expired token is rejected'
);

-- Direct membership writes stay closed regardless of any of the above.
select throws_ok(
  $$insert into public.household_members (household_id, user_id, role)
    values (app.current_household_id(), '33333333-3333-4333-8333-333333333333', 'owner')$$,
  '42501', null,
  'a client still cannot write membership directly'
);

select * from finish();

rollback;
