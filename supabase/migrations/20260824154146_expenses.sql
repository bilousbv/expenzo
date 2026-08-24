-- Expenses, their attachments, and the audit trail.

create type public.visibility as enum ('personal', 'shared');
create type public.expense_source as enum ('manual', 'receipt_scan', 'email', 'wallet', 'import');
create type public.review_status as enum ('confirmed', 'needs_review', 'rejected');

create table public.receipts (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  uploaded_by    uuid not null references auth.users (id),
  storage_path   text not null,
  content_sha256 text not null,
  content_type   text not null,
  byte_size      bigint not null check (byte_size > 0),
  created_at     timestamptz not null default now()
);

-- Content-addressed, so re-uploading the same image is a no-op rather than a
-- duplicate expense.
create unique index receipts_household_sha_uq
  on public.receipts (household_id, content_sha256);

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by   uuid not null references auth.users (id),
  visibility   public.visibility not null default 'shared',

  amount_minor bigint not null check (amount_minor > 0),
  currency     char(3) not null check (currency ~ '^[A-Z]{3}$'),

  -- Converted once at write time against the household's base currency and then
  -- frozen. Converting at read time would make last month's total move every
  -- day as rates change.
  base_amount_minor bigint not null,
  fx_rate           numeric(18, 8) not null default 1 check (fx_rate > 0),
  fx_rate_date      date,

  category_id  uuid references public.categories (id) on delete set null,
  merchant     text,
  merchant_normalized text,
  note         text,

  -- occurred_at is the instant; occurred_on is the local calendar date in the
  -- household's timezone, frozen at write time. Grouping always uses
  -- occurred_on: date_trunc over a timestamptz silently uses the server's
  -- TimeZone setting, which for PostgREST is UTC.
  occurred_at  timestamptz not null default now(),
  occurred_on  date not null,

  source        public.expense_source not null default 'manual',
  review_status public.review_status not null default 'confirmed',
  receipt_id    uuid references public.receipts (id) on delete set null,

  dedup_fingerprint text,

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- household_id leads every composite: it is the row-level-security predicate,
-- so Postgres can satisfy the policy from the index instead of filtering after.
create index expenses_household_date_idx
  on public.expenses (household_id, occurred_on desc)
  where deleted_at is null;

create index expenses_household_cat_date_idx
  on public.expenses (household_id, category_id, occurred_on desc)
  where deleted_at is null;

create index expenses_household_personal_idx
  on public.expenses (household_id, created_by, occurred_on desc)
  where visibility = 'personal' and deleted_at is null;

create unique index expenses_dedup_uq
  on public.expenses (household_id, dedup_fingerprint)
  where dedup_fingerprint is not null and deleted_at is null;

create index expenses_merchant_trgm_idx
  on public.expenses using gin (merchant_normalized extensions.gin_trgm_ops);

create table public.expense_line_items (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references public.expenses (id) on delete cascade,
  description text not null,
  quantity    numeric(12, 3),
  unit_amount_minor bigint,
  amount_minor bigint not null,
  position    int not null default 0
);

create index expense_line_items_expense_idx
  on public.expense_line_items (expense_id, position);

-- Any adult may edit another member's shared expense, so every change has to be
-- attributable. Without this, "who deleted the 400 euro expense" is
-- unanswerable.
create table public.expense_audit (
  id         bigint generated always as identity primary key,
  expense_id uuid not null,
  household_id uuid not null,
  actor_id   uuid,
  action     text not null check (action in ('update', 'delete')),
  before     jsonb,
  after      jsonb,
  occurred_at timestamptz not null default now()
);

create index expense_audit_expense_idx on public.expense_audit (expense_id, occurred_at desc);
create index expense_audit_household_idx on public.expense_audit (household_id, occurred_at desc);
