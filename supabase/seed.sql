-- Local development seed. Runs after every `supabase db reset`.
--
-- Reference data that production also needs — system categories, the service
-- catalogue — belongs in a MIGRATION, not here, or production will never get it.
-- This file is only for data that makes local development pleasant.

-- Intentionally empty until M1.5 adds a local test user and M1.9 adds sample
-- expenses. Kept in git so `supabase db reset` has a stable file to read.
