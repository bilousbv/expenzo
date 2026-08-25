-- Joining a household.
--
-- household_members has no INSERT policy, so a client cannot write itself into
-- a household. These two functions are the only door, and both are SECURITY
-- DEFINER with a pinned search_path.
--
-- They live in `public` rather than `app` because PostgREST only exposes
-- `public`; a function in `app` is unreachable over RPC.

---------------------------------------------------------------------------
-- Issue an invitation
---------------------------------------------------------------------------

create or replace function public.create_household_invitation(invitee_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller          uuid := (select auth.uid());
  caller_household uuid := app.current_household_id();
  caller_role     public.member_role := app.current_member_role();
  raw_token       text;
begin
  if caller is null or caller_household is null then
    raise exception 'Not a member of any household' using errcode = '42501';
  end if;

  if caller_role not in ('owner', 'adult') then
    raise exception 'Only an owner or adult can invite' using errcode = '42501';
  end if;

  if invitee_email is null or position('@' in invitee_email) = 0 then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;

  -- 256 bits, URL-safe. This is a bearer credential: whoever holds it can join.
  raw_token := replace(
    replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'),
    '/', '_'
  );
  raw_token := replace(raw_token, '=', '');

  -- Re-inviting the same address supersedes the previous invitation rather
  -- than stacking up pending rows, and quietly invalidates the older token.
  update public.household_invitations
  set status = 'revoked'
  where household_id = caller_household
    and email = invitee_email::extensions.citext
    and status = 'pending';

  insert into public.household_invitations (household_id, email, invited_by, token_hash)
  values (
    caller_household,
    invitee_email::extensions.citext,
    caller,
    encode(extensions.digest(raw_token, 'sha256'), 'hex')
  );

  -- Returned once and never stored. The caller emails or shares it; the
  -- database only ever sees the hash.
  return raw_token;
end
$$;

alter function public.create_household_invitation(text) owner to postgres;
revoke execute on function public.create_household_invitation(text) from public, anon;
grant execute on function public.create_household_invitation(text) to authenticated;

---------------------------------------------------------------------------
-- Redeem an invitation
---------------------------------------------------------------------------

create or replace function public.accept_household_invitation(token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller     uuid := (select auth.uid());
  invitation public.household_invitations;
begin
  if caller is null then
    raise exception 'Must be signed in to accept an invitation' using errcode = '42501';
  end if;

  select * into invitation
  from public.household_invitations
  where token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'This invitation link is not valid' using errcode = '22023';
  end if;

  -- Status and expiry are checked separately so the message is useful.
  if invitation.status <> 'pending' then
    raise exception 'This invitation has already been used' using errcode = '22023';
  end if;

  if invitation.expires_at <= now() then
    update public.household_invitations set status = 'expired' where id = invitation.id;
    raise exception 'This invitation has expired' using errcode = '22023';
  end if;

  -- One active household per user, enforced by a unique index. Leaving the
  -- previous one is what makes joining possible at all.
  update public.household_members
  set status = 'removed'
  where user_id = caller and status = 'active';

  insert into public.household_members (household_id, user_id, role)
  values (invitation.household_id, caller, 'adult')
  on conflict (household_id, user_id)
  do update set status = 'active', role = 'adult';

  update public.household_invitations
  set status = 'accepted', accepted_by = caller, accepted_at = now()
  where id = invitation.id;

  return invitation.household_id;
end
$$;

alter function public.accept_household_invitation(text) owner to postgres;
revoke execute on function public.accept_household_invitation(text) from public, anon;
grant execute on function public.accept_household_invitation(text) to authenticated;

---------------------------------------------------------------------------
-- Leaving a household strands the invitation rows, so let owners revoke.
---------------------------------------------------------------------------

create policy household_invitations_update on public.household_invitations
  for update to authenticated
  using (
    household_id = app.current_household_id()
    and app.current_member_role() in ('owner', 'adult')
  )
  with check (
    household_id = app.current_household_id()
    and app.current_member_role() in ('owner', 'adult')
  );
