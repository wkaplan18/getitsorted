-- Sorted — money-in (quotes & invoices) migration
--
-- Additive only. Existing bills/reminders/payees/trusted_senders tables are
-- untouched, so the money-out product keeps working while this rolls out.
--
-- IMPORTANT: this repo has shipped a schema change without running it live
-- before (the bills.unconfirmed incident, Jul 2026 — every bill save silently
-- failed for a day). Run this in the Supabase SQL editor and verify with a live
-- select before trusting any code that depends on it.

-- ---------------------------------------------------------------------------
-- 1. users — business profile + language + conversation state
-- ---------------------------------------------------------------------------

alter table users add column if not exists language text default 'en'
  check (language in ('en', 'zu', 'af'));
alter table users add column if not exists business_name text;
alter table users add column if not exists trade text;
alter table users add column if not exists logo_url text;
alter table users add column if not exists vat_number text;
alter table users add column if not exists bank_name text;
alter table users add column if not exists account_number text;
alter table users add column if not exists branch_code text;
alter table users add column if not exists onboarded_at timestamptz;

-- Multi-step WhatsApp conversations on a stateless webhook: holds
-- { step, draft, awaiting } between messages. Cleared on completion or CANCEL.
alter table users add column if not exists convo_state jsonb;

-- Per-user document numbering: QUO-0001, QUO-0002... Kept on the user rather
-- than derived from count(*) so deleting a quote never reissues a number.
alter table users add column if not exists quote_seq int default 0;

-- ---------------------------------------------------------------------------
-- 2. customers — the people he quotes (money in).
--    Deliberately separate from payees (the people he pays, money out).
-- ---------------------------------------------------------------------------

create table if not exists customers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade not null,
  name text not null,              -- original casing, for display
  normalised_name text not null,   -- lowercase, for fuzzy re-matching
  whatsapp_number text,
  email text,
  address text,
  created_at timestamptz default now(),
  unique(user_id, normalised_name)
);

create index if not exists customers_user on customers(user_id);

-- ---------------------------------------------------------------------------
-- 3. quotes — becomes an invoice in place when the job is done
-- ---------------------------------------------------------------------------

create table if not exists quotes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete set null,

  number text not null,            -- 'QUO-0007' / 'INV-0007'
  doc_type text default 'quote' check (doc_type in ('quote', 'invoice')),
  status text default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'accepted', 'paid', 'cancelled')),

  subtotal numeric(12, 2) default 0 not null,
  vat_amount numeric(12, 2) default 0 not null,
  total numeric(12, 2) default 0 not null,

  -- The public quote page is unauthenticated by design (the customer must not
  -- need an account), so this token is the ONLY thing protecting it.
  -- 128-bit url-safe random, never sequential.
  public_token text unique not null,

  paystack_reference text,
  notes text,
  raw_message text,                -- what he originally typed, for debugging misparses

  created_at timestamptz default now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz
);

create index if not exists quotes_user_status on quotes(user_id, status);
create index if not exists quotes_token on quotes(public_token);
create unique index if not exists quotes_user_number on quotes(user_id, number);

-- ---------------------------------------------------------------------------
-- 4. quote_items
-- ---------------------------------------------------------------------------

create table if not exists quote_items (
  id uuid default gen_random_uuid() primary key,
  quote_id uuid references quotes(id) on delete cascade not null,
  description text not null,
  quantity numeric(10, 2) default 1 not null,
  unit_price numeric(12, 2) default 0 not null,
  line_total numeric(12, 2) default 0 not null,
  position int default 0 not null
);

create index if not exists quote_items_quote on quote_items(quote_id, position);

-- ---------------------------------------------------------------------------
-- 5. quote_photos — proof of work, shown on the customer's page
-- ---------------------------------------------------------------------------

create table if not exists quote_photos (
  id uuid default gen_random_uuid() primary key,
  quote_id uuid references quotes(id) on delete cascade not null,
  storage_path text not null,
  caption text,
  created_at timestamptz default now()
);

create index if not exists quote_photos_quote on quote_photos(quote_id);

-- ---------------------------------------------------------------------------
-- 6. Atomic document numbering
--    Bumps and returns users.quote_seq in one statement so two quotes created
--    in the same instant can't take the same number. lib/quotes.ts falls back
--    to a read-modify-write if this function is missing, so the app still runs
--    before this is applied — but apply it.
-- ---------------------------------------------------------------------------

create or replace function next_quote_seq(p_user_id uuid)
returns int
language plpgsql
as $$
declare
  v_seq int;
begin
  update users
     set quote_seq = coalesce(quote_seq, 0) + 1
   where id = p_user_id
  returning quote_seq into v_seq;
  return v_seq;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. RLS — all access goes through the service-role client in API routes,
--    same pattern as bills/reminders. Enabled with no policies = deny by default.
-- ---------------------------------------------------------------------------

alter table customers enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table quote_photos enable row level security;

-- ---------------------------------------------------------------------------
-- 8. Verify (run these after — do not skip)
-- ---------------------------------------------------------------------------
-- select column_name from information_schema.columns
--   where table_name = 'users' and column_name in
--   ('language','business_name','trade','logo_url','convo_state','quote_seq');
-- select count(*) from customers;
-- select count(*) from quotes;
-- select count(*) from quote_items;
-- select count(*) from quote_photos;
