-- Categories come in two kinds, and a subscription is filed against a
-- different taxonomy from an expense.
--
-- "Streaming" and "Cloud storage" are not answers to "what did we spend money
-- on last month" — they are answers to "what do we pay for every month", and
-- mixing them into one list made both harder to read.

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select has_column('public', 'categories', 'kind', 'categories carry a kind');

-- Everything that existed before this column did was an expense category, and
-- an unqualified insert still means one.
select col_default_is('public', 'categories', 'kind', 'expense',
  'and default to the expense taxonomy');

select is(
  (select count(*) from public.categories
    where kind = 'subscription' and household_id is null)::int > 0,
  true,
  'the subscription taxonomy is seeded in a migration, so production gets it'
);

select is(
  (select count(*) from public.categories
    where kind = 'subscription' and slug = 'streaming' and household_id is null)::int,
  1,
  'including the one nearly every household has'
);

-- Expense categories are untouched by the split: an existing household's
-- pickers and rollups have to keep working exactly as they did.
select cmp_ok(
  (select count(*) from public.categories
    where kind = 'expense' and household_id is null)::int, '>=', 19,
  'and the expense taxonomy still has everything it had before'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now());

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select lives_ok(
  $$insert into public.categories (household_id, slug, name, kind)
    values (app.current_household_id(), 'coffee', 'Coffee', 'expense')$$,
  'a household can add a category of its own to either taxonomy'
);

-- The two taxonomies are separate lists, so the same word can legitimately
-- appear in both: a household that pays for a gym membership and also buys
-- gym gear wants "Fitness" in each.
select lives_ok(
  $$insert into public.categories (household_id, slug, name, kind)
    values (app.current_household_id(), 'coffee', 'Coffee', 'subscription')$$,
  'and the same slug in the other kind is not a collision'
);

select throws_ok(
  $$insert into public.categories (household_id, slug, name, kind)
    values (app.current_household_id(), 'coffee', 'Coffee again', 'expense')$$,
  '23505',
  null,
  'while the same slug in the same kind still is'
);

select is(
  (select kind::text from public.categories
    where household_id = app.current_household_id() and slug = 'coffee' and kind = 'expense'),
  'expense',
  'and the kind is stored rather than inferred at read time'
);

select * from finish();

rollback;
