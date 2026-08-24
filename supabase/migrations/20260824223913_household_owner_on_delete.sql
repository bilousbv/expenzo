-- households.owner_id had no ON DELETE action, so deleting a user failed with a
-- foreign key violation and account deletion was impossible. That is a problem
-- we cannot ship with.
--
-- ON DELETE CASCADE would be worse than the bug: deleting one member would take
-- the household with it, destroying every other member's shared expenses.
--
-- SET NULL is the safe reading, because owner_id only records who created the
-- household. Permissions come from household_members.role, which cascades on
-- its own. A household can therefore be briefly ownerless; transferring
-- ownership and reassigning a departing member's items is M7's job.

alter table public.households
  alter column owner_id drop not null;

alter table public.households
  drop constraint households_owner_id_fkey;

alter table public.households
  add constraint households_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete set null;
