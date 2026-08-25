-- Income becomes a direction rather than a category.
--
-- The alternative was to treat the seeded "Income" category as meaning income,
-- and that is a trap: categories are user-editable, so renaming or archiving
-- one would silently change the budget arithmetic.
--
-- `amount_minor > 0` stays. A direction column and a signed amount are two ways
-- of saying the same thing, and carrying both invites rows where they disagree.

create type public.expense_direction as enum ('spend', 'income');

alter table public.expenses
  add column direction public.expense_direction not null default 'spend';

-- Every rollup and every limit counts spending only, so the index that serves
-- them carries the direction. Income is the rarer row, and lives outside this
-- index entirely.
create index expenses_household_spend_idx
  on public.expenses (household_id, occurred_on desc)
  where direction = 'spend' and deleted_at is null;
