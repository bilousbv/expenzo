-- Foreign exchange: the rate table, and the trigger that converts every expense
-- into its household's base currency once, at write time.
--
-- The conversion is done by the database rather than the client because
-- base_amount_minor is what every household total is summed from. A client that
-- computes it can get it wrong, and a client that is lying about it cannot be
-- distinguished from one that is not.
--
-- The arithmetic here mirrors packages/domain/src/fx.ts, which asserts the same
-- cases. If the two ever disagree, the figure the user was shown before saving
-- is not the figure that was saved.

begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

---------------------------------------------------------------------------
-- Minor units, mirroring packages/domain/src/currency.ts
---------------------------------------------------------------------------

select is(app.minor_units('USD'), 2, 'most currencies subdivide into hundredths');
select is(app.minor_units('JPY'), 0, 'the yen has no minor unit at all');
select is(app.minor_units('KWD'), 3, 'the Kuwaiti dinar has three decimal places');
select is(app.minor_units('MGA'), 1, 'and the ariary has one');
select is(app.minor_units('usd'), 2, 'the code is matched case-insensitively');

---------------------------------------------------------------------------
-- Conversion arithmetic
---------------------------------------------------------------------------

-- 12.50 USD at 0.85 is 10.625 EUR, which rounds to 10.63.
select is(app.convert_minor(1250, 'USD', 'EUR', 0.85), 1063::bigint,
  'converts between two currencies that both subdivide into hundredths');

-- The trap: 1000 JPY is a thousand yen, not ten. Dividing by 100 at both ends
-- would be wrong at one end or both.
select is(app.convert_minor(1000, 'JPY', 'USD', 0.0068), 680::bigint,
  'crosses a currency with no minor unit');

select is(app.convert_minor(2000, 'USD', 'JPY', 147), 2940::bigint,
  'and one in the other direction');

select is(app.convert_minor(1000, 'USD', 'KWD', 0.306), 3060::bigint,
  'and a three-decimal currency');

-- One Chilean peso is worth about a tenth of a US cent. An expense that
-- happened must not convert to an expense of nothing.
select is(app.convert_minor(1, 'CLP', 'USD', 0.001), 1::bigint,
  'and never rounds a real amount away to zero');

-- The floor above exists to stop something becoming nothing, not to turn
-- nothing into something. Expense amounts are constrained positive, but the
-- same arithmetic converts household totals for display, and a household that
-- spent nothing must not be shown a penny.
select is(app.convert_minor(0, 'UAH', 'USD', 0.024), 0::bigint,
  'but converts nothing into nothing');

---------------------------------------------------------------------------
-- The rate table
---------------------------------------------------------------------------

-- seed.sql fills this table with a fortnight of plausible rates so local
-- development works. The assertions below are about exact figures, so they
-- start from an empty table rather than from whatever the seed happened to
-- contain. The whole file runs in a transaction that rolls back.
delete from public.fx_rates;

-- EUR quotes itself at 1 so a euro pair needs no special case anywhere.
insert into public.fx_rates (base, quote, as_of, rate) values
  ('EUR', 'EUR', current_date - 3, 1),
  ('EUR', 'USD', current_date - 3, 1.2),
  ('EUR', 'GBP', current_date - 3, 0.9),
  ('EUR', 'JPY', current_date - 3, 180),
  -- The ECB does not quote the hryvnia at all; it reaches the table from the
  -- National Bank of Ukraine feed, rebased into euro terms on the way in.
  ('EUR', 'UAH', current_date - 3, 50);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now());

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- Rates are public reference data, not household data: everybody converts with
-- the same numbers, and there is nothing in them to leak.
select is(
  (select count(*) from public.fx_rates)::int, 5,
  'any signed-in user can read the rate table'
);

-- Nobody edits rates by hand. The sync job holds the service role.
select throws_ok(
  $$insert into public.fx_rates (base, quote, as_of, rate)
    values ('EUR', 'CHF', current_date, 0.94)$$,
  '42501',
  null,
  'but cannot write to it'
);

---------------------------------------------------------------------------
-- Write-time conversion
---------------------------------------------------------------------------

-- The household's base currency is USD by default.
select lives_ok(
  $$insert into public.expenses
      (household_id, created_by, amount_minor, currency, occurred_on, merchant)
    values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
            1250, 'USD', current_date, 'Home currency')$$,
  'an expense in the household currency needs no rate at all'
);

select results_eq(
  $$select base_amount_minor, fx_rate, fx_rate_date
    from public.expenses where merchant = 'Home currency'$$,
  $$values (1250::bigint, 1::numeric, null::date)$$,
  'and is stored at a rate of one, with no rate date to record'
);

-- EUR to USD at 1.2: 20.00 EUR is 24.00 USD.
select lives_ok(
  $$insert into public.expenses
      (household_id, created_by, amount_minor, currency, occurred_on, merchant)
    values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
            2000, 'EUR', current_date, 'Foreign currency')$$,
  'an expense in another currency is accepted'
);

select results_eq(
  $$select amount_minor, currency, base_amount_minor
    from public.expenses where merchant = 'Foreign currency'$$,
  $$values (2000::bigint, 'EUR'::char(3), 2400::bigint)$$,
  'and keeps its own amount while converting into the household total'
);

-- The ECB publishes nothing at weekends or on holidays, so an expense dated
-- today has to be converted at the most recent rate on file. Demanding an exact
-- date match would make every Saturday unrecordable.
select is(
  (select fx_rate_date from public.expenses where merchant = 'Foreign currency'),
  current_date - 3,
  'converted at the most recent rate on or before the date it happened'
);

-- A client that computes its own base amount can get it wrong, and one that is
-- lying cannot be told from one that is not. The trigger has the last word.
-- An INSERT is not a table expression, so the write has to happen in a
-- data-modifying CTE for its result to be assertable.
with forged as (
  insert into public.expenses
    (household_id, created_by, amount_minor, currency, base_amount_minor,
     fx_rate, occurred_on, merchant)
  select app.current_household_id(), '11111111-1111-4111-8111-111111111111',
         2000, 'EUR', 1, 999, current_date, 'Forged'
  returning base_amount_minor, fx_rate
)
select is(
  (select base_amount_minor from forged),
  2400::bigint,
  'a base amount supplied by the client is recomputed, not trusted'
);

-- Refusing is the only honest option: recording it at a rate of one would put a
-- silently wrong figure into every total the household ever reads.
select throws_ok(
  $$insert into public.expenses
      (household_id, created_by, amount_minor, currency, occurred_on, merchant)
    values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
            2000, 'CLP', current_date, 'Unquoted')$$,
  '22023',
  null,
  'a currency the feed does not carry is refused rather than guessed at'
);

-- Stale rates are worse than no rates, because nobody can see they are stale.
select throws_ok(
  $$insert into public.expenses
      (household_id, created_by, amount_minor, currency, occurred_on, merchant)
    values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
            2000, 'EUR', current_date + 40, 'Too far ahead')$$,
  '22023',
  null,
  'and so is a date with no rate within a week of it'
);

-- The summaries add base_amount_minor, which is the whole reason it exists:
-- 12.50 USD and 20.00 EUR come to 36.50 USD, not to an error about mixed
-- currencies.
select is(
  (select total_minor from public.expense_summary(current_date, current_date)
   where direction = 'spend'),
  6050::bigint,
  'a household with mixed currencies still adds up to one number'
);

---------------------------------------------------------------------------
-- The hryvnia
---------------------------------------------------------------------------

-- Stored EUR-based like everything else, so it converts by the same path as
-- any other currency rather than needing one of its own.
select is(
  (select rate from public.fx_rates where quote = 'UAH' and as_of = current_date - 3),
  50::numeric,
  'the hryvnia is quoted against the euro like every other currency'
);

-- 500.00 UAH at 50 UAH per EUR is 10.00 EUR, which at 1.2 is 12.00 USD.
select lives_ok(
  $$insert into public.expenses
      (household_id, created_by, amount_minor, currency, occurred_on, merchant)
    values (app.current_household_id(), '11111111-1111-4111-8111-111111111111',
            50000, 'UAH', current_date, 'Hryvnia')$$,
  'an expense in hryvnia is accepted'
);

select is(
  (select base_amount_minor from public.expenses where merchant = 'Hryvnia'),
  1200::bigint,
  'and triangulates through the euro into the household currency'
);

---------------------------------------------------------------------------
-- The base currency is frozen once there is anything to re-derive
---------------------------------------------------------------------------

-- Changing it would mean re-deriving every historical row at the rate of the
-- day it happened, which needs rates going back that far and silently rewrites
-- past totals and limit history.
select throws_ok(
  $$update public.households set base_currency = 'EUR'
    where id = app.current_household_id()$$,
  '42501',
  null,
  'the base currency cannot change once the household has expenses'
);

delete from public.expenses where household_id = app.current_household_id();

-- Setting it while the ledger is still empty is exactly what signup does.
select lives_ok(
  $$update public.households set base_currency = 'EUR'
    where id = app.current_household_id()$$,
  'but may be set while there is nothing to re-derive'
);

select * from finish();

rollback;
