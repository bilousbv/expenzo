-- Converting nothing gives nothing.
--
-- app.convert_minor floors its result at one minor unit so that a small amount
-- in a weak currency cannot round away to an expense of nothing. Zero is not a
-- small amount, and the floor was turning it into a penny.
--
-- It never showed up on an expense, whose amount is constrained positive. It
-- showed up the moment the same arithmetic was used to convert a household
-- total for display: a household that had spent nothing was told it had spent
-- 0.01. Mirrors the same guard in convertMinor in packages/domain.
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
  select case
    when amount = 0 then 0::bigint
    else greatest(
      round(
        (amount::numeric / power(10::numeric, app.minor_units(from_code)))
        * rate
        * power(10::numeric, app.minor_units(to_code))
      )::bigint,
      1
    )
  end
$$;

alter function app.convert_minor(bigint, text, text, numeric) owner to postgres;
grant execute on function app.convert_minor(bigint, text, text, numeric)
  to authenticated, service_role;
