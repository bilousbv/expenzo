-- Profile photos.
--
-- Private, not public. Everything in this app is behind authentication, and a
-- public bucket leaves an object readable by anyone who ever held its URL —
-- including someone who has since left the household. Reads go through signed
-- URLs instead, which expire.

alter table public.profiles
  add column avatar_path text;

comment on column public.profiles.avatar_path is
  'Object name in the avatars bucket, not a URL. The bucket is private, so a '
  'usable URL has to be signed at read time and cannot be stored.';

---------------------------------------------------------------------------
-- The bucket
---------------------------------------------------------------------------

-- The size limit and the type allow-list are enforced here as well as in the
-- client, because the client is the half an attacker controls. An SVG is
-- excluded deliberately: it is an image and also a document that can carry
-- script, and storage serves back what it was handed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

---------------------------------------------------------------------------
-- Who may read and write what
---------------------------------------------------------------------------

-- Every policy below is written against the first path segment, which is the
-- owner's id. That is the whole permission model, and it is why the path is
-- built in one place in packages/domain rather than assembled at call sites.

-- Reading: your own, and anyone active in your household. Expenses show who
-- spent them, so a household has to be able to see its own members' faces —
-- and nobody else's.
create policy avatars_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    -- Checked before the cast: a name that is not a uuid would raise 22P02
    -- rather than simply failing to match, and an error inside a policy is a
    -- failed request rather than an empty result.
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1
      from public.household_members m
      where m.user_id = ((storage.foldername(name))[1])::uuid
        and m.status = 'active'
        and m.household_id = app.current_household_id()
    )
  );

-- Writing: only under your own name. Without this one member could overwrite
-- another's photo, which is defacement rather than a leak but is no more
-- welcome for it.
create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Replacing a photo is an upsert, so this needs both halves: USING decides
-- which row may be replaced, WITH CHECK decides what it may be replaced with.
-- With only USING, a member could rename their object to somebody else's path.
create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Taking your photo down has to be possible, or the only way to change your
-- mind is to replace it with a different one.
create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
