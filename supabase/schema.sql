-- Users: one row per WhatsApp number
create table if not exists users (
  id uuid default gen_random_uuid() primary key,
  whatsapp_number text unique not null,
  name text,
  otp text,
  otp_expires_at timestamptz,
  created_at timestamptz default now()
);

-- Payee memory: bank details saved per service provider, per user.
-- Auto-populated when bank details are extracted from an invoice.
-- Auto-looked-up when a reminder-only message ("pay vet R2000") has no bank details.
create table if not exists payees (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade not null,
  name text not null,           -- normalised lowercase for fuzzy matching
  display_name text not null,   -- original casing for display
  bank_name text,
  account_number text,
  branch_code text,
  default_reference text,
  updated_at timestamptz default now(),
  unique(user_id, name)
);

-- Bills: one row per invoice or reminder received
create table if not exists bills (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade not null,
  payee text not null,
  amount numeric(10, 2) not null,
  due_date date,
  bank_name text,
  account_number text,
  branch_code text,
  reference text,
  status text default 'pending' check (status in ('pending', 'paid', 'overdue')),
  stitch_payment_id text,       -- set when Stitch payment is initiated
  raw_message text,
  reminder_sent boolean default false,
  created_at timestamptz default now(),
  paid_at timestamptz
);

create index if not exists bills_user_status on bills(user_id, status);
create index if not exists bills_due_date on bills(due_date) where status = 'pending';
create index if not exists payees_user on payees(user_id);

alter table bills enable row level security;
alter table users enable row level security;
alter table payees enable row level security;
