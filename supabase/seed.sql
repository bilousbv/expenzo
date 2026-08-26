-- Local development seed. Runs after every `supabase db reset`.
--
-- Reference data that production also needs — system categories, the service
-- catalogue — belongs in a MIGRATION, not here, or production will never get it.
-- This file is only for data that makes local development pleasant.

---------------------------------------------------------------------------
-- Exchange rates
---------------------------------------------------------------------------

-- In production these arrive from the European Central Bank through
-- POST /api/fx/sync. Locally there is no scheduler and no reason to reach the
-- internet during a test run, so a fortnight of plausible rates is seeded
-- instead — without them, every foreign-currency expense is refused, which
-- makes the entry form look broken rather than unsynced.
--
-- Dated relative to today so they never age out of the seven-day lookback the
-- conversion trigger allows. The figures are illustrative, not real.
insert into public.fx_rates (base, quote, as_of, rate, source)
select 'EUR', v.quote, current_date - offset_days, v.rate, 'seed'
from generate_series(0, 14) as offset_days
cross join (values
  ('EUR', 1.0),
  ('USD', 1.16),
  ('GBP', 0.86),
  ('CHF', 0.94),
  ('SEK', 11.02),
  ('PLN', 4.24),
  ('JPY', 171.35),
  ('CAD', 1.61),
  ('AUD', 1.78)
) as v(quote, rate)
on conflict do nothing;
