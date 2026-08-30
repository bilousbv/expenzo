-- Invitations that carry a role, and managing the people who accepted them.
--
-- Three things change. An invitation now says what the invitee arrives as. The
-- link is previewable before signing in, so the landing page can tell an
-- existing account from a new one. And an adult can change a member's role or
-- remove them — except the owner, who is what `households.owner_id` points at.

---------------------------------------------------------------------------
-- What an invitation offers
---------------------------------------------------------------------------

alter table public.household_invitations
  add column role public.member_role not null default 'adult'
    -- Not an allow-list of the roles we happen to offer today: a household has
    -- exactly one owner and it is recorded on the household row, so that is the
    -- only value this column can never hold.
    check (role <> 'owner');

comment on column public.household_invitations.role is
  'What the invitee joins as. Read by accept_household_invitation; never chosen by the joiner.';

drop function if exists public.create_household_invitation(text);

create or replace function public.create_household_invitation(
  invitee_email text,
  invitee_role public.member_role default 'adult'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller           uuid := (select auth.uid());
  caller_household uuid := app.current_household_id();
  caller_role      public.member_role := app.current_member_role();
  raw_token        text;
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

  if invitee_role = 'owner' then
    raise exception 'A household has exactly one owner' using errcode = '42501';
  end if;

  -- 256 bits, URL-safe. This is a bearer credential: whoever holds it can join.
  raw_token := replace(
    replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'),
    '/', '_'
  );
  raw_token := replace(raw_token, '=', '');

  -- Re-inviting the same address supersedes the previous invitation rather
  -- than stacking up pending rows, and quietly invalidates the older token.
  -- Which is also how a role is corrected: invite again, saying the other one.
  update public.household_invitations
  set status = 'revoked'
  where household_id = caller_household
    and email = invitee_email::extensions.citext
    and status = 'pending';

  insert into public.household_invitations
    (household_id, email, invited_by, token_hash, role)
  values (
    caller_household,
    invitee_email::extensions.citext,
    caller,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    invitee_role
  );

  -- Returned once and never stored. The send-invitation function puts it in an
  -- email; the database only ever sees the hash.
  return raw_token;
end
$$;

alter function public.create_household_invitation(text, public.member_role) owner to postgres;
revoke execute on function public.create_household_invitation(text, public.member_role)
  from public, anon;
grant execute on function public.create_household_invitation(text, public.member_role)
  to authenticated;

---------------------------------------------------------------------------
-- Redeeming one, as whatever it offered
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

  -- The role comes off the invitation, never off the request: the joiner is
  -- the one party to this who must not get to choose.
  insert into public.household_members (household_id, user_id, role)
  values (invitation.household_id, caller, invitation.role)
  on conflict (household_id, user_id)
  do update set status = 'active', role = invitation.role;

  update public.household_invitations
  set status = 'accepted', accepted_by = caller, accepted_at = now()
  where id = invitation.id;

  return invitation.household_id;
end
$$;

---------------------------------------------------------------------------
-- What the landing page can see before anybody has signed in
---------------------------------------------------------------------------

-- Executable by `anon`, because the whole point is the visitor who has not
-- signed in yet: the page has to decide between showing a sign-in form and a
-- registration form, and that turns on whether the address already has an
-- account. Nothing is disclosed that the holder of the link does not already
-- have — the token is the bearer credential, and an unknown or spent one
-- returns no rows rather than a hint about which.
create or replace function public.invitation_preview(token text)
returns table (household_name text, invitee_email text, invitee_role text, account_exists boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select h.name,
         i.email::text,
         i.role::text,
         exists (
           select 1 from auth.users u
           where lower(u.email) = lower(i.email::text)
         )
  from public.household_invitations i
  join public.households h on h.id = i.household_id
  where i.token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
    and i.status = 'pending'
    and i.expires_at > now();
$$;

alter function public.invitation_preview(text) owner to postgres;
revoke execute on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;

---------------------------------------------------------------------------
-- Managing the people who accepted
---------------------------------------------------------------------------

-- Both of these are SECURITY DEFINER for the same reason the join door is:
-- household_members has no client-writable policy at all, so every change to
-- it goes through a function that can state its own rules.

create or replace function public.set_member_role(
  member uuid,
  new_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := app.current_household_id();
  owner     uuid;
begin
  if household is null or app.current_member_role() not in ('owner', 'adult') then
    raise exception 'Only an owner or adult can change a role' using errcode = '42501';
  end if;

  if new_role = 'owner' then
    raise exception 'A household has exactly one owner' using errcode = '42501';
  end if;

  select h.owner_id into owner from public.households h where h.id = household;

  if member = owner then
    raise exception 'The household owner keeps their role' using errcode = '42501';
  end if;

  update public.household_members
  set role = new_role
  where household_id = household and user_id = member and status = 'active';

  if not found then
    raise exception 'Not a member of this household' using errcode = '22023';
  end if;
end
$$;

alter function public.set_member_role(uuid, public.member_role) owner to postgres;
revoke execute on function public.set_member_role(uuid, public.member_role) from public, anon;
grant execute on function public.set_member_role(uuid, public.member_role) to authenticated;

create or replace function public.remove_household_member(member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := app.current_household_id();
  owner     uuid;
begin
  if household is null or app.current_member_role() not in ('owner', 'adult') then
    raise exception 'Only an owner or adult can remove a member' using errcode = '42501';
  end if;

  select h.owner_id into owner from public.households h where h.id = household;

  -- The owner's membership is what households.owner_id points at. Removing it
  -- would leave a household with rows in it and nobody able to administer them.
  if member = owner then
    raise exception 'The household owner cannot be removed' using errcode = '42501';
  end if;

  -- Removed rather than deleted: every expense they entered still carries
  -- created_by, and the roster has to be able to name whoever spent the money.
  update public.household_members
  set status = 'removed'
  where household_id = household and user_id = member and status = 'active';

  if not found then
    raise exception 'Not a member of this household' using errcode = '22023';
  end if;

  -- Any invitation still outstanding for them stops being redeemable, or
  -- removing someone would last only until they reopened their email.
  update public.household_invitations
  set status = 'revoked'
  where household_id = household
    and status = 'pending'
    and lower(email::text) = (
      select lower(u.email) from auth.users u where u.id = member
    );
end
$$;

alter function public.remove_household_member(uuid) owner to postgres;
revoke execute on function public.remove_household_member(uuid) from public, anon;
grant execute on function public.remove_household_member(uuid) to authenticated;
