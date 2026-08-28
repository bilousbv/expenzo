-- The profile a person actually fills in: their name, and the currency they
-- want their own figures shown in.
--
-- The household keeps one base currency, which every expense is converted into
-- and frozen at. The display currency is per member and changes nothing that is
-- stored — it is read-time presentation, so two people can read the same ledger
-- in two currencies.

begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

select has_column('public', 'profiles', 'first_name', 'a profile carries a first name');
select has_column('public', 'profiles', 'last_name', 'and a last name');
select has_column('public', 'profiles', 'display_currency',
  'and the currency its owner reads totals in');

---------------------------------------------------------------------------
-- Signup carries what the form collected
---------------------------------------------------------------------------

-- The registration form has the only moment anyone is reliably willing to type
-- their name, so it passes it as user metadata and the trigger reads it here.
-- A second round trip after signup would leave the profile half-filled whenever
-- it failed.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at, raw_user_meta_data)
values ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now(),
        '{"first_name":"Ana","last_name":"Petrenko","base_currency":"UAH"}'::jsonb);

select is(
  (select first_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'Ana',
  'the first name given at signup reaches the profile'
);

select is(
  (select last_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'Petrenko',
  'and so does the last name'
);

-- Chosen at signup because it cannot be changed once anything is recorded:
-- every historical row would need re-deriving at the rate of the day it
-- happened.
select is(
  (select base_currency from public.households
   where owner_id = '11111111-1111-4111-8111-111111111111'),
  'UAH'::char(3),
  'the household opens in the currency the form asked for'
);

select is(
  (select display_currency from public.profiles
   where id = '11111111-1111-4111-8111-111111111111'),
  null::char(3),
  'and nobody starts with a display currency, which means "the household one"'
);

---------------------------------------------------------------------------
-- Signing in with a magic link asks for none of that
---------------------------------------------------------------------------

-- There is no form on that path at all, so the fallbacks have to keep working
-- rather than leaving the account nameless.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ben@test.local', '', now(), now(), now());

select is(
  (select display_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'ben',
  'a profile with no metadata still gets the local part of the address'
);

select is(
  (select first_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  null::text,
  'and no invented first name'
);

select is(
  (select base_currency from public.households
   where owner_id = '22222222-2222-4222-8222-222222222222'),
  'USD'::char(3),
  'and the household keeps the default currency'
);

---------------------------------------------------------------------------
-- Choosing a display currency
---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select lives_ok(
  $$update public.profiles set first_name = 'Anna', display_currency = 'USD'
    where id = '11111111-1111-4111-8111-111111111111'$$,
  'a member may edit their own profile'
);

select is(
  (select display_currency from public.profiles
   where id = '11111111-1111-4111-8111-111111111111'),
  'USD'::char(3),
  'and the currency they picked is what is stored'
);

-- Same rule as an expense: a currency the feed does not quote cannot be
-- converted, and storing it would leave every figure on the screen unconverted
-- with no way to tell.
select throws_ok(
  $$update public.profiles set display_currency = 'CLP'
    where id = '11111111-1111-4111-8111-111111111111'$$,
  '22023',
  null,
  'a currency the rate feed does not quote is refused'
);

-- Except when it is the household's own currency, which converts into itself
-- and needs no rate at all. Refusing it would lock a household out of reading
-- its own ledger in its own money.
select lives_ok(
  $$update public.households set base_currency = 'CLP'
    where id = app.current_household_id()$$,
  'a household with no expenses may still set its currency'
);

select lives_ok(
  $$update public.profiles set display_currency = 'CLP'
    where id = '11111111-1111-4111-8111-111111111111'$$,
  'and that currency is then a legitimate thing to read totals in'
);

select lives_ok(
  $$update public.profiles set display_currency = null
    where id = '11111111-1111-4111-8111-111111111111'$$,
  'clearing it back to the household currency is always allowed'
);

---------------------------------------------------------------------------
-- Somebody else's profile
---------------------------------------------------------------------------

-- The update policy is scoped to your own row, and RLS filters rather than
-- raising, so the proof is that nothing changed rather than that it complained.
update public.profiles set first_name = 'Renamed'
where id = '22222222-2222-4222-8222-222222222222';

reset role;

select is(
  (select first_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  null::text,
  'and cannot rename anyone else'
);

select * from finish();

rollback;
