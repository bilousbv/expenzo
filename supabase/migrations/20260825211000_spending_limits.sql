-- Spending limits.
--
-- One row per category, plus at most one household-wide row where category_id
-- is null. `spent / limit` on the dashboard is meaningless without these, which
-- is why they arrive alongside it rather than with the notifications.
--
-- `limit_period_state` and the breach trigger deliberately stay in M1.14: a
-- trigger that enqueues a notification needs somewhere for that notification to
-- go, and there is no dispatcher yet.

-- Weekly and yearly cost nothing to carry now and are expensive to retrofit,
-- so the column exists even though the UI offers only monthly at first.
create type public.limit_period as enum ('weekly', 'monthly', 'yearly');

create table public.spending_limits (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,

  -- Null means the household-wide limit rather than one category's.
  category_id  uuid references public.categories (id) on delete cascade,

  amount_minor bigint not null check (amount_minor > 0),
  period       public.limit_period not null default 'monthly',

  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Two partial uniques rather than one: a plain unique index treats every NULL
-- category_id as distinct, so a household could accumulate any number of
-- "overall" limits without violating it.
create unique index spending_limits_category_uq
  on public.spending_limits (household_id, category_id, period)
  where category_id is not null;

create unique index spending_limits_overall_uq
  on public.spending_limits (household_id, period)
  where category_id is null;

alter table public.spending_limits enable row level security;

-- Row-level security decides which rows a role may touch; it does not grant the
-- privilege to touch the table at all.
grant select, insert, update, delete on public.spending_limits to authenticated;

-- Everyone in the household can see what the limits are — a limit nobody can
-- read cannot influence anybody's spending.
create policy spending_limits_select on public.spending_limits
  for select to authenticated
  using (household_id = app.current_household_id());

-- Setting one is an adult decision, matching who may edit a category.
create policy spending_limits_insert on public.spending_limits
  for insert to authenticated
  with check (
    household_id = app.current_household_id()
    and created_by = (select auth.uid())
    and app.current_member_role() in ('owner', 'adult')
  );

create policy spending_limits_update on public.spending_limits
  for update to authenticated
  using (
    household_id = app.current_household_id()
    and app.current_member_role() in ('owner', 'adult')
  )
  with check (
    household_id = app.current_household_id()
    and app.current_member_role() in ('owner', 'adult')
  );

create policy spending_limits_delete on public.spending_limits
  for delete to authenticated
  using (
    household_id = app.current_household_id()
    and app.current_member_role() in ('owner', 'adult')
  );

-- Row-level security gates rows, not columns.
revoke update (household_id, created_by) on public.spending_limits from authenticated;
