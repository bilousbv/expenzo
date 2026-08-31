-- Same-day expenses order by when they were written, not by a random uuid.
--
-- The expense list is keyset-paged on (occurred_on desc, id desc), and
-- `occurred_on` is a date — so everything entered today ties on it and the id
-- decides. `id` is `gen_random_uuid()`. Past a full page of same-day rows,
-- whether the expense somebody had just added appeared at all was settled by a
-- coin toss on its uuid: a household with 25 expenses on one day could add a
-- 26th and simply not see it.
--
-- `created_at` is monotonic, so the row written last sorts first, which is what
-- anyone reading a list of today's spending expects. The id stays as the final
-- term because two rows can share a timestamp — the subscription charges posted
-- by one call all do — and a keyset cursor needs a total order or it can loop
-- or skip.
--
-- Recreated under the same name rather than added alongside. The old index is a
-- strict prefix of this one, so nothing it served is lost, and leaving both
-- would mean paying for two copies of the same leading columns on every write.

drop index public.expenses_household_date_idx;

create index expenses_household_date_idx
  on public.expenses (household_id, occurred_on desc, created_at desc, id desc)
  where deleted_at is null;
