-- Expenses stop being personal or shared.
--
-- Every member of a household now sees every expense, and each one shows its
-- author. `created_by` stops being a privacy boundary and becomes a displayed
-- attribute and a filter.
--
-- Anything previously entered as personal becomes visible to the whole
-- household the moment this runs. That is the intended behaviour, and it is
-- why this must not reach real users without being announced first.

---------------------------------------------------------------------------
-- Policies first: they reference the column being dropped.
---------------------------------------------------------------------------

drop policy expenses_select on public.expenses;
drop policy expenses_update on public.expenses;
drop policy expenses_delete on public.expenses;

-- Everything the household owns. With no visibility clause left, Postgres can
-- satisfy this straight from the leading column of every expense index.
create policy expenses_select on public.expenses
  for select to authenticated
  using (household_id = app.current_household_id());

-- The author always; owners and adults for anyone's. Viewers stay read-only,
-- which is the whole of the role's meaning.
create policy expenses_update on public.expenses
  for update to authenticated
  using (
    household_id = app.current_household_id()
    and (
      created_by = (select auth.uid())
      or app.current_member_role() in ('owner', 'adult')
    )
  )
  with check (
    household_id = app.current_household_id()
    and (
      created_by = (select auth.uid())
      or app.current_member_role() in ('owner', 'adult')
    )
  );

create policy expenses_delete on public.expenses
  for delete to authenticated
  using (
    household_id = app.current_household_id()
    and (
      created_by = (select auth.uid())
      or app.current_member_role() in ('owner', 'adult')
    )
  );

---------------------------------------------------------------------------
-- Indexes
---------------------------------------------------------------------------

-- The personal index was partial on `visibility = 'personal'`. The author
-- filter on the dashboard wants the same columns for every row instead.
drop index public.expenses_household_personal_idx;

create index expenses_household_author_idx
  on public.expenses (household_id, created_by, occurred_on desc)
  where deleted_at is null;

---------------------------------------------------------------------------
-- The column, and then the type
---------------------------------------------------------------------------

alter table public.expenses drop column visibility;

-- Nothing else references it. Subscriptions were going to, and no longer will.
drop type public.visibility;
