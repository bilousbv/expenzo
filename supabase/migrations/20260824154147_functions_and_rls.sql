-- Helper functions, triggers and every row-level-security policy.

---------------------------------------------------------------------------
-- Membership helpers
---------------------------------------------------------------------------

-- A policy on household_members that reads household_members raises
-- 42P17 infinite recursion. Because row-level security is not applied to a
-- table's owner, a SECURITY DEFINER function reads the table without
-- re-entering the policy, and the leak is contained to a single uuid.
--
-- STABLE so it is evaluated once per statement rather than once per row.
-- `set search_path = ''` is mandatory: a mutable search_path on a SECURITY
-- DEFINER function is a privilege-escalation hole.
create or replace function app.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id
  from public.household_members m
  where m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1
$$;

create or replace function app.current_member_role()
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.household_members m
  where m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1
$$;

alter function app.current_household_id() owner to postgres;
alter function app.current_member_role() owner to postgres;

revoke execute on function app.current_household_id() from public;
revoke execute on function app.current_member_role() from public;
grant execute on function app.current_household_id() to authenticated, service_role;
grant execute on function app.current_member_role() to authenticated, service_role;

---------------------------------------------------------------------------
-- Merchant normalisation, mirroring packages/domain/src/dedup.ts
---------------------------------------------------------------------------

-- Supabase does not enable the unaccent extension by default, and it would be
-- STABLE rather than IMMUTABLE anyway because it depends on a dictionary.
-- Translating the accented characters that actually appear in merchant names
-- keeps this function IMMUTABLE, which the fingerprint depends on.
create or replace function app.strip_accents(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    coalesce(value, ''),
    'àáâãäåāăąçćĉċčèéêëēĕėęěìíîïĩīĭįıñńņňòóôõöøōŏőùúûüũūŭůűųýÿŷšśŝşžźżĝğġģ',
    'aaaaaaaaacccccceeeeeeeeeiiiiiiiiinnnnooooooooouuuuuuuuuuyyysssszzzgggg'
  )
$$;

alter function app.strip_accents(text) owner to postgres;

-- Both sides must agree, or the same purchase fingerprints differently
-- depending on which one computed it.
create or replace function app.normalize_merchant(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      trim(
        regexp_replace(
          -- 6. anything left that is not a letter or digit becomes a separator
          regexp_replace(
            -- 5. legal suffixes
            regexp_replace(
              -- 4. store and terminal numbers
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    -- 3. apostrophes close up rather than splitting
                    replace(
                      -- 2. processor prefixes: everything up to and including a *
                      regexp_replace(
                        lower(app.strip_accents(raw)),
                        '^[^*]*\*\s*', ''
                      ),
                      '''', ''
                    ),
                    '#\s*\d+', ' ', 'g'
                  ),
                  '\mstore\s*\d+\M', ' ', 'g'
                ),
                '\m\d{3,}\M', ' ', 'g'
              ),
              '[,\s]+(corporation|limited|l\.l\.c|llc|inc|ltd|gmbh|s\.?a\.?|p\.?l\.?c|corp|b\.?v|n\.?v|a\.?g|srl|pty|co)\.?\s*$',
              ''
            ),
            '[^a-z0-9]+', ' ', 'g'
          ),
          '\s+', ' ', 'g'
        )
      ),
      ''
    ),
    ''
  )
$$;

alter function app.normalize_merchant(text) owner to postgres;
grant execute on function app.normalize_merchant(text) to authenticated, service_role;

---------------------------------------------------------------------------
-- Signup: every new user gets a profile and their own household
---------------------------------------------------------------------------

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));

  insert into public.households (name, owner_id)
  values (coalesce(split_part(new.email, '@', 1), 'Household'), new.id)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, new.id, 'owner');

  return new;
end
$$;

alter function app.handle_new_user() owner to postgres;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

---------------------------------------------------------------------------
-- Expense triggers
---------------------------------------------------------------------------

create or replace function app.set_expense_derived_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.merchant_normalized := app.normalize_merchant(new.merchant);

  if new.source = 'manual' then
    -- A person can legitimately buy the same coffee twice in one day, so
    -- manual entries are never hard-blocked.
    new.dedup_fingerprint := null;
  else
    new.dedup_fingerprint := encode(
      extensions.digest(
        coalesce(new.merchant_normalized, '') || '|' ||
        new.amount_minor::text || '|' ||
        new.currency || '|' ||
        to_char(new.occurred_on, 'YYYY-MM-DD') || '|' ||
        new.source::text,
        'sha256'
      ),
      'hex'
    );
  end if;

  new.updated_at := now();
  return new;
end
$$;

alter function app.set_expense_derived_columns() owner to postgres;

create trigger expenses_set_derived
  before insert or update on public.expenses
  for each row execute function app.set_expense_derived_columns();

-- WITH CHECK cannot compare NEW to OLD, so the immutable columns are pinned
-- here as well as in the policy.
create or replace function app.pin_immutable_expense_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'household_id is immutable' using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable' using errcode = '42501';
  end if;
  return new;
end
$$;

alter function app.pin_immutable_expense_columns() owner to postgres;

create trigger expenses_pin_immutable
  before update on public.expenses
  for each row execute function app.pin_immutable_expense_columns();

create or replace function app.record_expense_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    insert into public.expense_audit (expense_id, household_id, actor_id, action, before, after)
    values (old.id, old.household_id, (select auth.uid()), 'update', to_jsonb(old), to_jsonb(new));
    return new;
  end if;

  insert into public.expense_audit (expense_id, household_id, actor_id, action, before, after)
  values (old.id, old.household_id, (select auth.uid()), 'delete', to_jsonb(old), null);
  return old;
end
$$;

alter function app.record_expense_audit() owner to postgres;

create trigger expenses_audit
  after update or delete on public.expenses
  for each row execute function app.record_expense_audit();

---------------------------------------------------------------------------
-- Row-level security
---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_line_items enable row level security;
alter table public.receipts enable row level security;
alter table public.expense_audit enable row level security;

-- Row-level security decides which rows a role may touch; it does not grant the
-- privilege to touch the table at all. Supabase no longer auto-exposes new
-- tables to the Data API roles, so every grant is explicit.
grant select, update on public.profiles to authenticated;
grant select, update on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, insert, update on public.household_invitations to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.expense_line_items to authenticated;
grant select, insert on public.receipts to authenticated;
grant select on public.expense_audit to authenticated;

-- Profiles: your own, plus anyone sharing your household.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.household_members m
      where m.user_id = public.profiles.id
        and m.status = 'active'
        and m.household_id = app.current_household_id()
    )
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Households: only your own.
create policy households_select on public.households
  for select to authenticated
  using (id = app.current_household_id());

create policy households_update on public.households
  for update to authenticated
  using (id = app.current_household_id() and app.current_member_role() = 'owner')
  with check (id = app.current_household_id() and app.current_member_role() = 'owner');

-- Membership: your own row, plus your household's roster. No write policies
-- exist at all, so joining must go through app.accept_invitation.
create policy household_members_select on public.household_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or household_id = app.current_household_id()
  );

-- Invitations are visible to the household that issued them.
create policy household_invitations_select on public.household_invitations
  for select to authenticated
  using (household_id = app.current_household_id());

create policy household_invitations_insert on public.household_invitations
  for insert to authenticated
  with check (
    household_id = app.current_household_id()
    and invited_by = (select auth.uid())
    and app.current_member_role() in ('owner', 'adult')
  );

-- Categories: system ones are readable by everyone; custom ones belong to a
-- household and may be managed by its adults.
create policy categories_select on public.categories
  for select to authenticated
  using (household_id is null or household_id = app.current_household_id());

create policy categories_write on public.categories
  for all to authenticated
  using (
    household_id = app.current_household_id()
    and app.current_member_role() in ('owner', 'adult')
  )
  with check (
    household_id = app.current_household_id()
    and app.current_member_role() in ('owner', 'adult')
  );

-- Expenses. Shared items are visible household-wide and editable by any adult;
-- personal items belong to their creator alone.
create policy expenses_select on public.expenses
  for select to authenticated
  using (
    household_id = app.current_household_id()
    and (visibility = 'shared' or created_by = (select auth.uid()))
  );

create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (
    household_id = app.current_household_id()
    and created_by = (select auth.uid())
  );

create policy expenses_update on public.expenses
  for update to authenticated
  using (
    household_id = app.current_household_id()
    and (
      created_by = (select auth.uid())
      or (visibility = 'shared' and app.current_member_role() in ('owner', 'adult'))
    )
  )
  with check (
    household_id = app.current_household_id()
    and (
      created_by = (select auth.uid())
      or (visibility = 'shared' and app.current_member_role() in ('owner', 'adult'))
    )
  );

create policy expenses_delete on public.expenses
  for delete to authenticated
  using (
    household_id = app.current_household_id()
    and (
      created_by = (select auth.uid())
      or (visibility = 'shared' and app.current_member_role() in ('owner', 'adult'))
    )
  );

-- Row-level security gates rows, not columns.
revoke update (household_id, created_by, dedup_fingerprint, merchant_normalized)
  on public.expenses from authenticated;

create policy expense_line_items_all on public.expense_line_items
  for all to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = public.expense_line_items.expense_id
        and e.household_id = app.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = public.expense_line_items.expense_id
        and e.household_id = app.current_household_id()
    )
  );

create policy receipts_select on public.receipts
  for select to authenticated
  using (household_id = app.current_household_id());

create policy receipts_insert on public.receipts
  for insert to authenticated
  with check (
    household_id = app.current_household_id()
    and uploaded_by = (select auth.uid())
  );

-- The audit trail is readable by the household and writable only by the
-- trigger, which runs as definer.
create policy expense_audit_select on public.expense_audit
  for select to authenticated
  using (household_id = app.current_household_id());
