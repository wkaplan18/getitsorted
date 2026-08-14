-- Paystack split payments: one subaccount per tradesperson, so customer money
-- settles into HIS bank account and never passes through Sorted's balance.
--
-- Run this in the Supabase SQL editor. Committing it is not running it — this
-- repo has shipped code against columns that did not exist yet before.

alter table users add column if not exists paystack_subaccount text;

-- Set when the subaccount is created, so a failed attempt can be retried
-- without hammering Paystack on every profile save.
alter table users add column if not exists paystack_subaccount_at timestamptz;

-- What the customer was actually charged, including the convenience fee. The
-- quote's own total stays what the tradesperson quoted — these are different
-- numbers and conflating them makes the books wrong.
alter table quotes add column if not exists charged_total numeric(12,2);

-- ---------------------------------------------------------------------------
-- GOING LIVE: run this when you swap PAYSTACK_SECRET_KEY from sk_test_ to
-- sk_live_.
--
-- A subaccount created under a test key does not exist under a live key. Every
-- code stored below is a test-mode object, and leaving them in place means
-- every card payment fails with an unknown-subaccount error. Clearing the
-- column makes ensureSubaccount() rebuild each one against the live key the
-- next time that tradesperson's banking is touched.
--
--   update users set paystack_subaccount = null, paystack_subaccount_at = null;
--
-- ---------------------------------------------------------------------------
-- Verify — all four should come back with one row each.
-- ---------------------------------------------------------------------------

select column_name, data_type
from information_schema.columns
where table_name = 'users'
  and column_name in ('paystack_subaccount', 'paystack_subaccount_at');

select column_name, data_type
from information_schema.columns
where table_name = 'quotes'
  and column_name = 'charged_total';