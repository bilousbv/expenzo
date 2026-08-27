-- Subscriptions, and the catalogue of services they usually come from.
--
-- Manual entry only for now. The email parsing that would fill this in by
-- itself lands in M4; the catalogue exists from the start so the "pick a
-- service" path is real rather than a placeholder, and so that parsing has
-- something to match against when it arrives.

create type public.subscription_cadence as enum (
  'weekly', 'monthly', 'quarterly', 'semiannual', 'yearly'
);

-- Cancelled rather than deleted. Months of charges are history, and history
-- that disappears takes the totals it contributed to with it.
create type public.subscription_status as enum ('active', 'cancelled');

---------------------------------------------------------------------------
-- The service catalogue
---------------------------------------------------------------------------

create table public.service_catalogue (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name          text not null,
  -- The billing domain, which is what an email parser will match on. Nullable
  -- because a few services bill from an address that is not their own.
  domain        text,
  -- A hint, not a foreign key: categories are per-household and user-editable,
  -- so the catalogue can only suggest a name to match against.
  category_hint text,
  created_at    timestamptz not null default now()
);

create index service_catalogue_domain_idx on public.service_catalogue (domain)
  where domain is not null;

alter table public.service_catalogue enable row level security;

-- Reference data: the same rows for every household, with nothing in them to
-- leak. Writes belong to whatever maintains the catalogue, never to a client.
grant select on public.service_catalogue to authenticated;
grant select, insert, update, delete on public.service_catalogue to service_role;

create policy service_catalogue_select on public.service_catalogue
  for select to authenticated
  using (true);

insert into public.service_catalogue (slug, name, domain, category_hint) values
  ('netflix',          'Netflix',            'netflix.com',        'Entertainment'),
  ('spotify',          'Spotify',            'spotify.com',        'Entertainment'),
  ('disney-plus',      'Disney+',            'disneyplus.com',     'Entertainment'),
  ('hbo-max',          'HBO Max',            'hbomax.com',         'Entertainment'),
  ('youtube-premium',  'YouTube Premium',    'youtube.com',        'Entertainment'),
  ('apple-tv',         'Apple TV+',          'apple.com',          'Entertainment'),
  ('apple-music',      'Apple Music',        'apple.com',          'Entertainment'),
  ('amazon-prime',     'Amazon Prime',       'amazon.com',         'Shopping'),
  ('megogo',           'MEGOGO',             'megogo.net',         'Entertainment'),
  ('sweet-tv',         'SWEET.TV',           'sweet.tv',           'Entertainment'),
  ('deezer',           'Deezer',             'deezer.com',         'Entertainment'),
  ('audible',          'Audible',            'audible.com',        'Entertainment'),
  ('twitch',           'Twitch',             'twitch.tv',          'Entertainment'),
  ('patreon',          'Patreon',            'patreon.com',        'Entertainment'),
  ('steam',            'Steam',              'steampowered.com',   'Entertainment'),
  ('playstation-plus', 'PlayStation Plus',   'playstation.com',    'Entertainment'),
  ('xbox-game-pass',   'Xbox Game Pass',     'xbox.com',           'Entertainment'),
  ('nintendo-online',  'Nintendo Switch Online', 'nintendo.com',   'Entertainment'),

  ('icloud',           'iCloud+',            'apple.com',          'Software'),
  ('google-one',       'Google One',         'google.com',         'Software'),
  ('dropbox',          'Dropbox',            'dropbox.com',        'Software'),
  ('microsoft-365',    'Microsoft 365',      'microsoft.com',      'Software'),
  ('adobe-cc',         'Adobe Creative Cloud', 'adobe.com',        'Software'),
  ('figma',            'Figma',              'figma.com',          'Software'),
  ('notion',           'Notion',             'notion.so',          'Software'),
  ('slack',            'Slack',              'slack.com',          'Software'),
  ('zoom',             'Zoom',               'zoom.us',            'Software'),
  ('github',           'GitHub',             'github.com',         'Software'),
  ('jetbrains',        'JetBrains',          'jetbrains.com',      'Software'),
  ('1password',        '1Password',          '1password.com',      'Software'),
  ('nordvpn',          'NordVPN',            'nordvpn.com',        'Software'),
  ('proton',           'Proton',             'proton.me',          'Software'),
  ('openai',           'ChatGPT Plus',       'openai.com',         'Software'),
  ('anthropic',        'Claude Pro',         'anthropic.com',      'Software'),
  ('canva',            'Canva',              'canva.com',          'Software'),
  ('grammarly',        'Grammarly',          'grammarly.com',      'Software'),
  ('evernote',         'Evernote',           'evernote.com',       'Software'),
  ('todoist',          'Todoist',            'todoist.com',        'Software'),

  ('kyivstar',         'Kyivstar',           'kyivstar.ua',        'Utilities'),
  ('vodafone-ua',      'Vodafone Ukraine',   'vodafone.ua',        'Utilities'),
  ('lifecell',         'lifecell',           'lifecell.ua',        'Utilities'),
  ('volia',            'Volia',              'volia.com',          'Utilities'),
  ('ukrtelecom',       'Ukrtelecom',         'ukrtelecom.ua',      'Utilities'),

  ('duolingo',         'Duolingo',           'duolingo.com',       'Education'),
  ('coursera',         'Coursera',           'coursera.org',       'Education'),
  ('udemy',            'Udemy',              'udemy.com',          'Education'),
  ('skillshare',       'Skillshare',         'skillshare.com',     'Education'),
  ('masterclass',      'MasterClass',        'masterclass.com',    'Education'),

  ('strava',           'Strava',             'strava.com',         'Health'),
  ('headspace',        'Headspace',          'headspace.com',      'Health'),
  ('calm',             'Calm',               'calm.com',           'Health'),
  ('myfitnesspal',     'MyFitnessPal',       'myfitnesspal.com',   'Health'),
  ('whoop',            'WHOOP',              'whoop.com',          'Health'),

  ('nytimes',          'The New York Times', 'nytimes.com',        'Entertainment'),
  ('economist',        'The Economist',      'economist.com',      'Entertainment'),
  ('medium',           'Medium',             'medium.com',         'Entertainment'),
  ('substack',         'Substack',           'substack.com',       'Entertainment'),
  ('uber-one',         'Uber One',           'uber.com',           'Transport'),
  ('bolt-plus',        'Bolt Plus',          'bolt.eu',            'Transport');

---------------------------------------------------------------------------
-- Renewal arithmetic
---------------------------------------------------------------------------

/**
 * The renewal one interval after `from_date`.
 *
 * Mirrors nextRenewalOn in packages/domain/src/renewal.ts, and must keep
 * agreeing with it: the date shown before saving has to be the date stored.
 *
 * Always computed from the anchor day rather than by incrementing the previous
 * date. That is the entire reason `anchor_day` is its own column: a
 * subscription anchored on the 31st goes 31 Jan, 28 Feb, 31 Mar. Incrementing
 * the previous date clamps February to the 28th and then leaves it stuck on
 * the 28th for ever.
 */
create or replace function app.next_renewal_on(
  anchor_day     int,
  cadence        public.subscription_cadence,
  interval_count int,
  from_date      date
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  months_ahead int;
  first_of_target date;
  days_available int;
begin
  if anchor_day is null or anchor_day < 1 or anchor_day > 31 then
    raise exception 'anchor day must be between 1 and 31, received %', anchor_day
      using errcode = '22023';
  end if;

  if interval_count is null or interval_count < 1 then
    raise exception 'interval count must be at least 1, received %', interval_count
      using errcode = '22023';
  end if;

  -- A weekly subscription has no day of the month to anchor to.
  if cadence = 'weekly' then
    return from_date + (7 * interval_count);
  end if;

  months_ahead := interval_count * case cadence
    when 'monthly'    then 1
    when 'quarterly'  then 3
    when 'semiannual' then 6
    when 'yearly'     then 12
  end;

  -- Cast to `timestamp` rather than letting `date` widen to `timestamptz`:
  -- date_trunc is IMMUTABLE for the former and only STABLE for the latter,
  -- because a time zone can change underneath it. Without the cast this
  -- function is marked IMMUTABLE while containing a STABLE expression, which
  -- `supabase db lint` flags and which would licence Postgres to fold a wrong
  -- constant if this were ever used in an index.
  first_of_target := (date_trunc('month', from_date::timestamp)
                      + make_interval(months => months_ahead))::date;

  -- Clamp to the target month rather than rolling over into the next one:
  -- a 31st anchor in a 30-day month bills on the 30th, not the 1st.
  days_available := extract(day from
    (first_of_target + interval '1 month' - interval '1 day'))::int;

  return first_of_target + (least(anchor_day, days_available) - 1);
end
$$;

/**
 * When a subscription next bills, given where it is in its life.
 *
 * Walks forward from the start date rather than adding one interval to today,
 * because the phase matters: a quarterly subscription started in January bills
 * in April, not three months from whenever this is asked.
 */
create or replace function app.subscription_next_renewal(
  started_on     date,
  anchor_day     int,
  cadence        public.subscription_cadence,
  interval_count int,
  after_date     date
)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  cursor_date date := started_on;
  guard int := 0;
begin
  -- One that has not started yet bills first on the day it starts.
  while cursor_date <= after_date loop
    cursor_date := app.next_renewal_on(anchor_day, cadence, interval_count, cursor_date);

    -- Every cadence advances at least seven days, so this cannot be reached by
    -- an ordinary subscription however old. It is here so a future cadence
    -- that failed to advance would raise rather than spin.
    guard := guard + 1;
    if guard > 5000 then
      raise exception 'renewal schedule failed to advance past %', after_date
        using errcode = '22023';
    end if;
  end loop;

  return cursor_date;
end
$$;

---------------------------------------------------------------------------
-- Subscriptions
---------------------------------------------------------------------------

create table public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  created_by     uuid not null references auth.users (id),

  -- Where it came from, when it came from the catalogue. Null for anything
  -- typed in by hand, which is most of them until the parsing lands.
  service_id     uuid references public.service_catalogue (id) on delete set null,
  name           text not null check (length(btrim(name)) between 1 and 120),

  amount_minor   bigint not null check (amount_minor > 0),
  currency       char(3) not null check (currency ~ '^[A-Z]{3}$'),

  cadence        public.subscription_cadence not null,
  interval_count int not null default 1 check (interval_count >= 1),
  -- 31 is legitimate even though most months lack it: this is an anchor, not a
  -- date, and app.next_renewal_on clamps it per month.
  anchor_day     int not null check (anchor_day between 1 and 31),

  started_on     date not null,
  -- Written by the trigger below, never by a client. Null while cancelled.
  next_renewal_on date,

  category_id    uuid references public.categories (id) on delete set null,
  status         public.subscription_status not null default 'active',
  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

-- household_id leads, because it is the row-level-security predicate and
-- Postgres can then satisfy the policy from the index rather than filtering
-- afterwards.
create index subscriptions_household_idx
  on public.subscriptions (household_id, next_renewal_on)
  where deleted_at is null and status = 'active';

create index subscriptions_household_all_idx
  on public.subscriptions (household_id, name)
  where deleted_at is null;

alter table public.subscriptions enable row level security;

grant select, insert, update, delete on public.subscriptions to authenticated;

-- Every member sees every subscription, matching expenses: the household pays
-- for these together.
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (household_id = app.current_household_id());

create policy subscriptions_insert on public.subscriptions
  for insert to authenticated
  with check (
    household_id = app.current_household_id()
    and created_by = (select auth.uid())
    and app.current_member_role() in ('owner', 'adult')
  );

create policy subscriptions_update on public.subscriptions
  for update to authenticated
  using (
    household_id = app.current_household_id()
    and app.current_member_role() in ('owner', 'adult')
  )
  with check (
    household_id = app.current_household_id()
    and app.current_member_role() in ('owner', 'adult')
  );

create policy subscriptions_delete on public.subscriptions
  for delete to authenticated
  using (
    household_id = app.current_household_id()
    and app.current_member_role() in ('owner', 'adult')
  );

-- Row-level security gates rows, not columns. Without this a member could move
-- a subscription into another household on update, which WITH CHECK alone
-- cannot prevent because it cannot compare NEW to OLD.
revoke update (household_id, created_by) on public.subscriptions from authenticated;

/**
 * Keeps `next_renewal_on` derived rather than supplied.
 *
 * The upcoming-renewals card reads this column and the notification
 * materialiser will too, so a client that computes it wrongly — or lies about
 * it — would put a subscription in front of somebody on the wrong day.
 */
create or replace function app.set_subscription_next_renewal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nothing is due from something that is not running, and a stale date would
  -- keep it in the upcoming list for ever.
  if new.status <> 'active' or new.deleted_at is not null then
    new.next_renewal_on := null;
    return new;
  end if;

  new.next_renewal_on := app.subscription_next_renewal(
    new.started_on, new.anchor_day, new.cadence, new.interval_count, current_date
  );

  return new;
end
$$;

create trigger subscriptions_set_next_renewal
  before insert or update on public.subscriptions
  for each row execute function app.set_subscription_next_renewal();
