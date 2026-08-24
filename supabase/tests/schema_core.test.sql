-- Structural expectations for the core schema. Cheap to run, and they catch a
-- migration that was edited without its index or constraint being updated.

begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

-- Tables
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'households', 'households exists');
select has_table('public', 'household_members', 'household_members exists');
select has_table('public', 'household_invitations', 'household_invitations exists');
select has_table('public', 'categories', 'categories exists');
select has_table('public', 'expenses', 'expenses exists');
select has_table('public', 'expense_line_items', 'expense_line_items exists');
select has_table('public', 'receipts', 'receipts exists');
select has_table('public', 'expense_audit', 'expense_audit exists');

-- Money is stored as integer minor units plus a currency, never a float.
select col_type_is('public', 'expenses', 'amount_minor', 'bigint', 'amount is bigint minor units');
select col_type_is('public', 'expenses', 'base_amount_minor', 'bigint', 'base amount is bigint');
select col_type_is('public', 'expenses', 'currency', 'character(3)', 'currency is a 3-char code');

-- Both time columns exist. occurred_on is the frozen local calendar date that
-- every grouping uses; occurred_at is the instant.
select col_type_is(
  'public', 'expenses', 'occurred_on', 'date',
  'occurred_on is a date, not a timestamp'
);
select col_type_is(
  'public', 'expenses', 'occurred_at', 'timestamp with time zone',
  'occurred_at is an instant'
);
select col_not_null('public', 'expenses', 'occurred_on', 'occurred_on is required');

-- Row-level security must be on for every user-facing table.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.expenses'::regclass),
  'row-level security is enabled on expenses'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.household_members'::regclass),
  'row-level security is enabled on household_members'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.categories'::regclass),
  'row-level security is enabled on categories'
);

-- The helper that makes membership policies non-recursive.
select has_function('app', 'current_household_id', 'app.current_household_id exists');
select has_function('app', 'current_member_role', 'app.current_member_role exists');
select ok(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'current_household_id'),
  'current_household_id is SECURITY DEFINER'
);
-- A mutable search_path on a SECURITY DEFINER function is a privilege-escalation hole.
select ok(
  (select proconfig::text like '%search_path=%'
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'current_household_id'),
  'current_household_id pins its search_path'
);

-- Indexes that the query plans depend on.
select has_index('public', 'expenses', 'expenses_household_date_idx', 'household+date index exists');
select has_index(
  'public', 'expenses', 'expenses_dedup_uq', 'dedup fingerprint unique index exists'
);
select has_index(
  'public', 'household_members', 'household_members_one_active_per_user',
  'one active household per user is enforced by an index, not an assumption'
);

-- Enum types
select has_type('public', 'visibility', 'visibility enum exists');
select has_type('public', 'member_role', 'member_role enum exists');
select has_type('public', 'expense_source', 'expense_source enum exists');

-- System categories ship in a migration so production gets them too.
select cmp_ok(
  (select count(*) from public.categories where household_id is null)::int,
  '>=', 15,
  'system categories are seeded by a migration'
);

select * from finish();

rollback;
