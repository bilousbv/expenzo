-- Extensions and the private helper schema.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext with schema extensions;

-- Helper functions live here rather than in `public`, so PostgREST never
-- exposes them as RPC endpoints.
create schema if not exists app;

revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;
