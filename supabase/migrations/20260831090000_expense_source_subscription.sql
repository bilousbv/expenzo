-- Where an expense came from, when it came from a subscription.
--
-- Alone in its own migration because Postgres refuses to *use* an enum value
-- in the same transaction that added it, and the next migration inserts rows
-- carrying this one. Splitting them is the whole reason this file exists.
--
-- Calling a posted charge 'manual' was the alternative and is a lie with
-- consequences: `app.set_expense_derived_columns` gives manual entries a null
-- dedup fingerprint precisely because a person can buy the same coffee twice
-- in a day, and a subscription charge is the opposite of that.

alter type public.expense_source add value if not exists 'subscription';
