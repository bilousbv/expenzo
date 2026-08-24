-- Profiles, households and membership.

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  -- IANA zone. Drives reminder send times, so it is per person.
  timezone   text not null default 'UTC',
  locale     text not null default 'en-US',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  -- Every total is reported in this currency. Expenses in another currency are
  -- converted once at write time and frozen.
  base_currency  char(3) not null default 'USD' check (base_currency ~ '^[A-Z]{3}$'),
  -- Month boundaries for spending limits and calendar grouping.
  timezone       text not null default 'UTC',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  owner_id       uuid not null references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create type public.member_role as enum ('owner', 'adult', 'viewer');
create type public.member_status as enum ('active', 'removed');

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.member_role not null default 'adult',
  status       public.member_status not null default 'active',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- "One household per user" is enforced, not merely assumed.
create unique index household_members_one_active_per_user
  on public.household_members (user_id)
  where status = 'active';

create index household_members_household_idx
  on public.household_members (household_id)
  where status = 'active';

create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

create table public.household_invitations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email        extensions.citext not null,
  invited_by   uuid not null references auth.users (id),
  -- Only the hash is stored. The token itself exists in the invitation email
  -- and nowhere else, so a database leak does not hand over household access.
  token_hash   text not null unique,
  status       public.invitation_status not null default 'pending',
  expires_at   timestamptz not null default now() + interval '14 days',
  accepted_by  uuid references auth.users (id),
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

create unique index household_invitations_pending_uq
  on public.household_invitations (household_id, email)
  where status = 'pending';
