-- The day-by-day net movement a period's balance swing is built from.
--
-- One row per day that has anything on it, income minus spending, summed from
-- base_amount_minor like every other total so a household with mixed currencies
-- still adds to one number.
--
-- Days with nothing recorded are deliberately absent rather than returned as
-- zero: the client walks the whole window anyway, and returning a row per day
-- would mean sending a year of zeroes to describe a quiet year.
--
-- SECURITY INVOKER, like the other summaries, so row-level security still
-- applies and no household can read another's figures through it.
create or replace function public.daily_net(
  from_on date,
  to_on   date,
  member  uuid default null
)
returns table (occurred_on date, net_minor bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.occurred_on,
    sum(
      case when e.direction = 'income'
        then e.base_amount_minor
        else -e.base_amount_minor
      end
    )::bigint
  from public.expenses e
  where e.deleted_at is null
    and e.occurred_on between from_on and to_on
    and (member is null or e.created_by = member)
  group by e.occurred_on
  order by e.occurred_on
$$;

grant execute on function public.daily_net(date, date, uuid) to authenticated;
