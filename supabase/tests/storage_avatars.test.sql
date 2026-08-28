-- The avatars bucket, and who may read and write what in it.
--
-- Private, not public. Everything in this app is behind authentication, and a
-- public bucket would leave a photo readable by anyone holding the URL forever
-- — including after the person left the household. Reads go through signed
-- URLs, which expire.
--
-- The owner's id is the first path segment, and every policy here is written
-- against that segment. Nothing else about the layout is load-bearing.

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

---------------------------------------------------------------------------
-- The bucket
---------------------------------------------------------------------------

select is(
  (select public from storage.buckets where id = 'avatars'),
  false,
  'the avatars bucket is private'
);

select is(
  (select file_size_limit from storage.buckets where id = 'avatars'),
  (2 * 1024 * 1024)::bigint,
  'and will not take a file larger than two megabytes'
);

-- An SVG is an image and also a document that can carry script. The bucket
-- serves what it is handed, so the allow-list is where that gets refused.
select ok(
  (select allowed_mime_types from storage.buckets where id = 'avatars')
    @> array['image/jpeg', 'image/png', 'image/webp'],
  'and takes the three ordinary photo formats'
);

select ok(
  not (
    (select allowed_mime_types from storage.buckets where id = 'avatars')
      && array['image/svg+xml']
  ),
  'but not an SVG, which is a script container as much as an image'
);

---------------------------------------------------------------------------
-- Two people in one household, and a stranger in another
---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ben@test.local', '', now(), now(), now()),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'zoe@test.local', '', now(), now(), now());

-- Ben joins Ana's household. Each signup made its own, so his is dropped and
-- he is added to hers, which is what accepting an invitation does.
delete from public.household_members where user_id = '22222222-2222-4222-8222-222222222222';

insert into public.household_members (household_id, user_id, role)
select m.household_id, '22222222-2222-4222-8222-222222222222', 'adult'
from public.household_members m
where m.user_id = '11111111-1111-4111-8111-111111111111';

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

---------------------------------------------------------------------------
-- Writing
---------------------------------------------------------------------------

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('avatars', '11111111-1111-4111-8111-111111111111/avatar',
            '11111111-1111-4111-8111-111111111111')$$,
  'a member may upload their own photo'
);

-- The prefix is the whole permission model. Without this, one member could
-- overwrite another's photo, which is defacement rather than a data leak but
-- is no more welcome for it.
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('avatars', '22222222-2222-4222-8222-222222222222/avatar',
            '11111111-1111-4111-8111-111111111111')$$,
  '42501',
  null,
  'but not one under somebody else''s name'
);

---------------------------------------------------------------------------
-- Reading
---------------------------------------------------------------------------

reset role;

insert into storage.objects (bucket_id, name, owner)
values
  ('avatars', '22222222-2222-4222-8222-222222222222/avatar',
   '22222222-2222-4222-8222-222222222222'),
  ('avatars', '33333333-3333-4333-8333-333333333333/avatar',
   '33333333-3333-4333-8333-333333333333');

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- Expenses show who spent them, so a household has to be able to see its own
-- members' faces.
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'avatars'
     and name = '22222222-2222-4222-8222-222222222222/avatar'),
  1,
  'a member can see the photo of someone in their household'
);

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'avatars'
     and name = '33333333-3333-4333-8333-333333333333/avatar'),
  0,
  'and nothing belonging to anyone outside it'
);

---------------------------------------------------------------------------
-- Removing
---------------------------------------------------------------------------

-- Asserted as policy rather than as behaviour: storage carries a trigger that
-- refuses any direct DELETE on its tables and tells you to use the Storage API,
-- so a test cannot reach this policy the way the reads above are reached. What
-- is checked here is that the rule exists and is written against the owner
-- segment, which is the part that could silently go missing.
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'avatars_delete' and cmd = 'DELETE'),
  1,
  'removing a photo is governed by a policy of its own'
);

select ok(
  (select qual from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'avatars_delete') like '%auth.uid%',
  'and that policy is scoped to the person who uploaded it'
);

---------------------------------------------------------------------------
-- The profile column that points at it
---------------------------------------------------------------------------

select has_column('public', 'profiles', 'avatar_path',
  'a profile records where its photo is kept');

select * from finish();

rollback;
