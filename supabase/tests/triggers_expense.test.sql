-- Deduplication fingerprints and the audit trail.

begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ana@test.local', '', now(), now(), now());

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- A person can legitimately buy the same coffee twice in one day, so manual
-- entries are never fingerprinted and never hard-blocked.
insert into public.expenses
  (household_id, created_by, source, amount_minor, currency, base_amount_minor, occurred_on, merchant)
values
  (app.current_household_id(), '11111111-1111-4111-8111-111111111111', 'manual',
   350, 'USD', 350, current_date, 'Blue Bottle Coffee');

select lives_ok(
  $$insert into public.expenses
      (household_id, created_by, source, amount_minor, currency, base_amount_minor, occurred_on, merchant)
    values (app.current_household_id(), '11111111-1111-4111-8111-111111111111', 'manual',
            350, 'USD', 350, current_date, 'Blue Bottle Coffee')$$,
  'the same manual expense can be entered twice'
);

select is(
  (select count(*) from public.expenses where dedup_fingerprint is not null)::int,
  0,
  'manual expenses carry no fingerprint'
);

-- Anything machine-created is fingerprinted, so a redelivered webhook or a
-- retried request cannot produce a duplicate.
insert into public.expenses
  (household_id, created_by, source, amount_minor, currency, base_amount_minor, occurred_on, merchant)
values
  (app.current_household_id(), '11111111-1111-4111-8111-111111111111', 'email',
   1250, 'USD', 1250, current_date, 'Tesco Stores 3456');

select isnt(
  (select dedup_fingerprint from public.expenses where source = 'email'),
  null,
  'an email-sourced expense is fingerprinted'
);

select throws_ok(
  $$insert into public.expenses
      (household_id, created_by, source, amount_minor, currency, base_amount_minor, occurred_on, merchant)
    values (app.current_household_id(), '11111111-1111-4111-8111-111111111111', 'email',
            1250, 'USD', 1250, current_date, 'Tesco Stores 3456')$$,
  '23505',
  null,
  'the same email-sourced expense cannot be inserted twice'
);

-- Merchant normalisation mirrors the TypeScript implementation, so the same
-- purchase fingerprints identically whichever side computes it.
select is(
  app.normalize_merchant('SQ *BLUE BOTTLE COFFE #221'),
  'blue bottle coffe',
  'SQL merchant normalisation strips processor prefixes and store numbers'
);

select is(
  app.normalize_merchant('Acme Widgets Inc.'),
  'acme widgets',
  'SQL merchant normalisation strips legal suffixes'
);

-- Deleting is recorded too, since any adult can delete a shared item.
delete from public.expenses where source = 'email';

select is(
  (select count(*) from public.expense_audit where action = 'delete')::int,
  1,
  'deleting an expense is recorded in the audit trail'
);

select * from finish();

rollback;
