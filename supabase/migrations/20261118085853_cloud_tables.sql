-- Cloud copy of the on-device ledger (accounts, categories, transactions) for backup and sync.
--
-- SQLite on the phone stays the source of truth; these tables mirror it per user:
-- * Same columns as `src/lib/db/schema.database.ts`, plus `user_id` and `server_updated_at`.
-- * Ids are the phone's ids (UUID text made on the device); a row is identified by
--   (user_id, id), so one user's ids can never touch another user's rows.
-- * Rows are never deleted: deleting sets `deleted_at`, which syncs like any other change.
-- * Money is integer poisha (bigint); dates are `date`; timestamps are timestamptz.
-- * `server_updated_at` is set by the server on every write. Sync pulls "rows changed since
--   the last pull" by it, so the phone's clock doesn't matter. Writes can commit slightly out
--   of order, so a pull should start a little before the last value it saw (rows are upserted
--   by id, so seeing one twice is harmless).
-- * Last write wins by `updated_at` (the time of the edit on the phone): an update carrying an
--   older `updated_at` than the stored row is skipped, so a late push from a second phone
--   can't overwrite a newer edit.
-- * Row Level Security: a signed-in user reads and writes only their own rows. New tables
--   aren't exposed automatically in this project, so access is granted explicitly below.

-- Sets server_updated_at on every write and skips stale updates (see above).
create function public.sync_row_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null; -- older edit: keep the stored row
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- Accounts: bank, cash, mobile wallet, savings (DPS).
create table public.accounts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),

  name text not null,
  type text not null check (type in ('bank', 'cash', 'mobile_wallet', 'savings')),
  -- Poisha at the start of opening_date.
  opening_balance bigint not null default 0,
  opening_date date not null,
  archived boolean not null default false,
  sort_order integer not null default 0,
  -- Savings / DPS details (null for other accounts).
  installment_amount bigint,
  start_date date,
  maturity_date date,
  interest_rate double precision,

  primary key (user_id, id)
);

-- Expense categories and income sources.
create table public.categories (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),

  name text not null,
  kind text not null check (kind in ('expense', 'income_source')),
  icon text,
  color text,
  archived boolean not null default false,

  primary key (user_id, id)
);

-- Income (source -> account), expense (account -> category), transfer (account -> account).
-- from_id / to_id / parent_id have no foreign keys, as on the phone: they point at accounts
-- or categories depending on type, and synced rows may arrive in any order.
create table public.transactions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),

  date date not null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  from_id text not null,
  to_id text not null,
  -- Poisha, always positive.
  amount bigint not null check (amount > 0),
  note text not null default '',
  -- The transaction this money came from (the money tree).
  parent_id text,
  -- Income only: who paid ("Received from").
  party text,

  primary key (user_id, id),
  constraint transactions_from_to_check check (from_id <> to_id)
);

-- Pulls read "this user's rows changed since …".
create index accounts_pull_idx on public.accounts (user_id, server_updated_at);
create index categories_pull_idx on public.categories (user_id, server_updated_at);
create index transactions_pull_idx on public.transactions (user_id, server_updated_at);

create trigger accounts_sync_row_write before insert or update on public.accounts
  for each row execute function public.sync_row_write();
create trigger categories_sync_row_write before insert or update on public.categories
  for each row execute function public.sync_row_write();
create trigger transactions_sync_row_write before insert or update on public.transactions
  for each row execute function public.sync_row_write();

-- Row Level Security: own rows only. No delete policy: rows are soft-deleted.
-- `(select auth.uid())` is evaluated once per query instead of once per row.
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy "Read own accounts" on public.accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own accounts" on public.accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Change own accounts" on public.accounts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Read own categories" on public.categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own categories" on public.categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Change own categories" on public.categories
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Read own transactions" on public.transactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own transactions" on public.transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Change own transactions" on public.transactions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Data API access: signed-in users only, and no hard deletes. Signed-out (anon) gets nothing.
revoke all on table public.accounts, public.categories, public.transactions from anon, authenticated;
grant select, insert, update on table public.accounts, public.categories, public.transactions to authenticated;

-- The trigger function isn't meant to be called through the API.
revoke execute on function public.sync_row_write() from public, anon, authenticated;
