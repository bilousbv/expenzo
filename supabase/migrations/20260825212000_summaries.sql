-- Aggregation for the dashboard.
--
-- These exist because the expense list is keyset-paged. Summing the rows the
-- client happens to hold gives the total of page one and labels it the total of
-- the month — which is why the screen currently says "total of the N shown"
-- rather than anything stronger.
--
-- SECURITY INVOKER, so row-level security still applies and no household can
-- read another's figures through them. That is the default, and it is stated
-- explicitly here because getting it wrong turns a convenience into a leak.
--
-- Both sum base_amount_minor, so a household with mixed currencies adds up in
-- one currency rather than adding dollars to yen.

create or replace function public.expense_summary(
  from_on date,
  to_on date,
  member uuid default null
)
returns table (direction public.expense_direction, total_minor bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.direction, sum(e.base_amount_minor)::bigint
  from public.expenses e
  where e.deleted_at is null
    and e.occurred_on between from_on and to_on
    and (member is null or e.created_by = member)
  group by e.direction
$$;

-- Spending only. Income has no category rollup to belong to, and counting it
-- here would make a salary look like the month's largest outgoing.
create or replace function public.category_summary(
  from_on date,
  to_on date,
  member uuid default null
)
returns table (category_id uuid, total_minor bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.category_id, sum(e.base_amount_minor)::bigint
  from public.expenses e
  where e.deleted_at is null
    and e.direction = 'spend'
    and e.occurred_on between from_on and to_on
    and (member is null or e.created_by = member)
  group by e.category_id
$$;

grant execute on function public.expense_summary(date, date, uuid) to authenticated;
grant execute on function public.category_summary(date, date, uuid) to authenticated;
