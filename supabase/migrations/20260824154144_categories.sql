-- Categories. A null household_id marks a system category available to everyone.

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  slug         text not null,
  name         text not null,
  icon         text,
  color        text,
  parent_id    uuid references public.categories (id) on delete set null,
  is_system    boolean not null generated always as (household_id is null) stored,
  sort_order   int not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);

create unique index categories_system_slug_uq
  on public.categories (slug)
  where household_id is null;

create unique index categories_household_slug_uq
  on public.categories (household_id, slug)
  where household_id is not null;

create index categories_household_idx
  on public.categories (household_id, sort_order)
  where archived_at is null;

-- Seeded in a migration rather than seed.sql, because production needs these
-- too and seed.sql only runs locally.
insert into public.categories (slug, name, icon, color, sort_order)
values
  ('groceries', 'Groceries', 'shopping-cart', '#337dff', 10),
  ('dining', 'Dining out', 'utensils', '#f97316', 20),
  ('transport', 'Transport', 'bus', '#0ea5e9', 30),
  ('fuel', 'Fuel', 'fuel', '#64748b', 40),
  ('housing', 'Housing', 'home', '#8b5cf6', 50),
  ('utilities', 'Utilities', 'plug', '#14b8a6', 60),
  ('health', 'Health', 'heart-pulse', '#ef4444', 70),
  ('insurance', 'Insurance', 'shield', '#6366f1', 80),
  ('entertainment', 'Entertainment', 'clapperboard', '#ec4899', 90),
  ('subscriptions', 'Subscriptions', 'repeat', '#1d5df5', 100),
  ('shopping', 'Shopping', 'shopping-bag', '#a855f7', 110),
  ('travel', 'Travel', 'plane', '#06b6d4', 120),
  ('education', 'Education', 'graduation-cap', '#22c55e', 130),
  ('kids', 'Kids', 'baby', '#f59e0b', 140),
  ('pets', 'Pets', 'paw-print', '#84cc16', 150),
  ('fees', 'Fees and charges', 'receipt', '#78716c', 160),
  ('income', 'Income', 'trending-up', '#16a34a', 170),
  ('transfer', 'Transfer', 'arrow-left-right', '#94a3b8', 180),
  ('uncategorized', 'Uncategorised', 'circle-help', '#9ca3af', 999);
