-- Proves the pgTAP harness itself runs. Schema and row-level-security tests
-- arrive in M1.2; this file exists so `supabase test db` is green from the
-- moment the development environment is set up, rather than failing with
-- NOTESTS until the first real migration lands.

begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

select ok(true, 'pgTAP harness runs');

select is(
  current_setting('server_version_num')::int >= 170000,
  true,
  'Postgres is at least 17, matching db.major_version in config.toml'
);

select * from finish();

rollback;
