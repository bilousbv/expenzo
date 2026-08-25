-- Foreign exchange.
--
-- Rates come from the European Central Bank's daily reference feed: free, no
-- key, no rate limit, and EUR-based. Every non-euro pair is therefore
-- triangulated through the euro, which is exact enough for expense tracking.
-- Swapping in a commercial provider later means changing what fills this table,
-- not the table or anything that reads it.
--
-- Conversion happens once, at write time, and is frozen on the expense row.
-- Converting at read time would make last month's total move every day.

create table public.fx_rates (
  -- Always 'EUR' from the ECB feed, but stored rather than assumed so a second
  -- source with a different base does not need a schema change.
  base  char(3) not null check (base ~ '^[A-Z]{3}$'),
  quote char(3) not null check (quote ~ '^[A-Z]{3}$'),
  as_of date not null,

  -- Units of `quote` per one unit of `base`. numeric, never a float: a rate
  -- multiplied by an amount is money.
  rate  numeric(20, 10) not null check (rate > 0),

  source     text not null default 'ecb',
  fetched_at timestamptz not null default now(),

  primary key (base, quote, as_of)
);

-- The lookup is "the most recent publication on or before this date", which
-- reads a date range within one base. The primary key leads with base but puts
-- as_of last, so it cannot serve that on its own.
create index fx_rates_base_date_idx on public.fx_rates (base, as_of desc);

alter table public.fx_rates enable row level security;

-- Rates are public reference data rather than household data: everybody
-- converts with the same numbers and there is nothing in them to leak. Writes
-- belong to the sync job, which holds the service role, so no write policy
-- exists and default-deny stands.
grant select on public.fx_rates to authenticated;
grant select, insert, update, delete on public.fx_rates to service_role;

create policy fx_rates_select on public.fx_rates
  for select to authenticated
  using (true);

---------------------------------------------------------------------------
-- Money arithmetic, mirroring packages/domain/src/currency.ts and fx.ts
---------------------------------------------------------------------------

-- Not everything divides by 100. Assuming it does understates the yen by a
-- factor of a hundred and overstates the dinar by ten.
create or replace function app.minor_units(code text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(code) in (
      'BIF','CLP','DJF','GNF','ISK','JPY','KMF','KRW','PYG','RWF','UGX','UYI',
      'VND','VUV','XAF','XOF','XPF'
    ) then 0
    when upper(code) in ('MGA','MRU') then 1
    when upper(code) in ('BHD','IQD','JOD','KWD','LYD','OMR','TND') then 3
    else 2
  end
$$;

alter function app.minor_units(text) owner to postgres;
grant execute on function app.minor_units(text) to authenticated, service_role;

-- round() on numeric rounds half away from zero, and amount_minor is
-- constrained positive, so this cannot disagree with Math.round in the domain
-- package on the boundary case.
--
-- The floor of one minor unit is deliberate: converting a small amount from a
-- weak currency into a strong one can round to nothing, and an expense that
-- happened must not become an expense of zero. It also keeps the check
-- constraint on base_amount_minor satisfiable for every real input.
create or replace function app.convert_minor(
  amount    bigint,
  from_code text,
  to_code   text,
  rate      numeric
)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select greatest(
    round(
      (amount::numeric / power(10::numeric, app.minor_units(from_code)))
      * rate
      * power(10::numeric, app.minor_units(to_code))
    )::bigint,
    1
  )
$$;

alter function app.convert_minor(bigint, text, text, numeric) owner to postgres;
grant execute on function app.convert_minor(bigint, text, text, numeric)
  to authenticated, service_role;

---------------------------------------------------------------------------
-- Rate lookup
---------------------------------------------------------------------------

-- The most recent publication on or before the date, within a week of it.
--
-- The ECB publishes nothing at weekends or on holidays, so demanding an exact
-- date match would make every Saturday unrecordable. A week is the cutoff
-- because a stale table should fail loudly rather than quietly convert last
-- month's expenses at last month's rate.
create or replace function app.fx_rate_on(from_code text, to_code text, on_date date)
returns table (rate numeric, as_of date)
language sql
stable
security definer
set search_path = ''
as $$
  with published as (
    select r.as_of
    from public.fx_rates r
    where r.base = 'EUR'
      and r.as_of <= on_date
      and r.as_of >= on_date - 7
    group by r.as_of
    order by r.as_of desc
    limit 1
  )
  select
    (
      select r.rate from public.fx_rates r
      where r.base = 'EUR' and r.quote = upper(to_code) and r.as_of = published.as_of
    )
    / nullif(
      (
        select r.rate from public.fx_rates r
        where r.base = 'EUR' and r.quote = upper(from_code) and r.as_of = published.as_of
      ),
      0
    ),
    published.as_of
  from published
$$;

alter function app.fx_rate_on(text, text, date) owner to postgres;
grant execute on function app.fx_rate_on(text, text, date) to authenticated, service_role;

---------------------------------------------------------------------------
-- Write-time conversion
---------------------------------------------------------------------------

-- The trigger below owns this column, so clients no longer supply it and the
-- generated Insert type should not demand it. A default of zero could only
-- survive if the trigger were dropped, which the check constraint then catches
-- loudly rather than storing a household total that quietly excludes the row.
alter table public.expenses
  alter column base_amount_minor set default 0,
  add constraint expenses_base_amount_positive check (base_amount_minor > 0);

-- SECURITY DEFINER so the household's base currency is readable regardless of
-- the caller's policies. It reads one column by primary key, for a household
-- the caller has just named in the row being written, so there is nothing here
-- they did not already supply.
create or replace function app.set_expense_base_amount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_code  char(3);
  found_rate numeric;
  found_date date;
begin
  -- An edit that does not touch the money keeps the figure it was written
  -- with. Re-deriving on every update would undo the freeze, and would make a
  -- soft delete of an old expense fail once its rate had aged out of the table.
  if tg_op = 'UPDATE'
     and new.amount_minor is not distinct from old.amount_minor
     and new.currency    is not distinct from old.currency
     and new.occurred_on is not distinct from old.occurred_on
     and new.household_id is not distinct from old.household_id then
    new.base_amount_minor := old.base_amount_minor;
    new.fx_rate           := old.fx_rate;
    new.fx_rate_date      := old.fx_rate_date;
    return new;
  end if;

  select h.base_currency into base_code
  from public.households h
  where h.id = new.household_id;

  if base_code is null then
    raise exception 'household % has no base currency', new.household_id
      using errcode = '22023';
  end if;

  if new.currency = base_code then
    new.base_amount_minor := new.amount_minor;
    new.fx_rate           := 1;
    -- No rate was consulted, so there is no rate date to record.
    new.fx_rate_date      := null;
    return new;
  end if;

  select f.rate, f.as_of into found_rate, found_date
  from app.fx_rate_on(new.currency, base_code, new.occurred_on) f;

  -- Refusing is the only honest option. Recording it at a rate of one would put
  -- a silently wrong figure into every total the household ever reads.
  if found_rate is null then
    raise exception
      'no exchange rate from % to % on or shortly before %',
      new.currency, base_code, new.occurred_on
      using errcode = '22023';
  end if;

  new.base_amount_minor := app.convert_minor(new.amount_minor, new.currency, base_code, found_rate);
  new.fx_rate           := found_rate;
  new.fx_rate_date      := found_date;

  return new;
end
$$;

alter function app.set_expense_base_amount() owner to postgres;

-- Before the derived-columns trigger, alphabetically, which is also the order
-- Postgres fires them in. They are independent, but the ordering being stated
-- costs nothing.
create trigger expenses_set_base_amount
  before insert or update on public.expenses
  for each row execute function app.set_expense_base_amount();

---------------------------------------------------------------------------
-- The base currency is frozen once there is anything to re-derive
---------------------------------------------------------------------------

-- Changing it means re-deriving base_amount_minor for every historical row at
-- the rate of the day each one happened. That needs rates going back that far,
-- silently rewrites past totals and limit history, and is not something a
-- household does twice. Setting it at signup, while the ledger is empty, stays
-- allowed.
create or replace function app.pin_household_base_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.base_currency is distinct from old.base_currency
     and exists (select 1 from public.expenses e where e.household_id = old.id) then
    raise exception 'base_currency cannot change once the household has expenses'
      using errcode = '42501';
  end if;

  return new;
end
$$;

alter function app.pin_household_base_currency() owner to postgres;

create trigger households_pin_base_currency
  before update on public.households
  for each row execute function app.pin_household_base_currency();
