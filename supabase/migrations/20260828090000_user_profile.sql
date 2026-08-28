-- The profile a person fills in: their name, and the currency they read in.
--
-- Names are display data, not identity. The account is still the email address
-- and nothing here is unique, so none of it is required — a magic-link account
-- has no form to type it into and keeps the name the signup trigger derived.

alter table public.profiles
  add column first_name text,
  add column last_name  text,
  -- Null means "whatever the household uses". The household's base currency is
  -- what every expense is converted into and frozen at; this changes nothing
  -- that is stored, only what this one person is shown, so two members can read
  -- one ledger in two currencies.
  add column display_currency char(3)
    check (display_currency ~ '^[A-Z]{3}$');

comment on column public.profiles.display_currency is
  'Read-time presentation only. Totals are converted from the household base '
  'currency at today''s rate, which is why the figures are marked approximate.';

---------------------------------------------------------------------------
-- Signup carries what the registration form collected
---------------------------------------------------------------------------

-- The alternative is a second write from the client once the session exists,
-- which leaves the profile half-filled every time it fails. Passing the fields
-- as user metadata keeps the whole account in one transaction.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
  meta             jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  given_name       text;
  family_name      text;
  chosen_currency  text;
  derived_name     text := split_part(new.email, '@', 1);
begin
  -- `given_name` and `family_name` are what Google returns, so a third-party
  -- signup arrives named rather than falling back to the address.
  given_name  := nullif(btrim(coalesce(meta ->> 'first_name', meta ->> 'given_name')), '');
  family_name := nullif(btrim(coalesce(meta ->> 'last_name', meta ->> 'family_name')), '');

  chosen_currency := upper(nullif(btrim(meta ->> 'base_currency'), ''));

  -- Metadata is client-supplied and reaches here unvalidated. A code that is
  -- not one falls back rather than failing the signup: an account that cannot
  -- be created is a worse outcome than a household opened in dollars.
  if chosen_currency is null or chosen_currency !~ '^[A-Z]{3}$' then
    chosen_currency := 'USD';
  end if;

  insert into public.profiles (id, display_name, first_name, last_name)
  values (new.id, derived_name, given_name, family_name);

  insert into public.households (name, owner_id, base_currency)
  values (coalesce(given_name, derived_name, 'Household'), new.id, chosen_currency::char(3))
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, new.id, 'owner');

  return new;
end
$$;

alter function app.handle_new_user() owner to postgres;

---------------------------------------------------------------------------
-- A display currency has to be one that can actually be converted into
---------------------------------------------------------------------------

-- The same rule as an expense: a currency the feed does not quote cannot be
-- converted, and storing it would leave every figure on the screen silently
-- unconverted with nothing to say so.
--
-- SECURITY DEFINER because it only reads, and because the answer must not
-- depend on which policies the writer happens to be subject to.
create or replace function app.validate_display_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  household_currency char(3);
begin
  if new.display_currency is null then
    return new;
  end if;

  if exists (select 1 from public.fx_rates where quote = new.display_currency) then
    return new;
  end if;

  -- A household's own currency converts into itself and needs no rate at all.
  -- Refusing it would lock a household out of reading its ledger in its money.
  select h.base_currency into household_currency
  from public.households h
  join public.household_members m
    on m.household_id = h.id and m.status = 'active'
  where m.user_id = new.id
  limit 1;

  if new.display_currency = household_currency then
    return new;
  end if;

  raise exception using
    errcode = '22023',
    message = format(
      'No exchange rate is published for %s, so totals cannot be shown in it',
      new.display_currency
    );
end
$$;

alter function app.validate_display_currency() owner to postgres;

create trigger profiles_validate_display_currency
  before insert or update of display_currency on public.profiles
  for each row execute function app.validate_display_currency();
