-- Every Paystack reference ever minted for a quote, not just the newest.
--
-- Each attempt at paying created a fresh reference and overwrote the last one,
-- and the webhook could only match the newest. A customer who clicked Pay
-- twice and then paid the FIRST link handed over real money that the webhook
-- could not attribute: quote left unpaid, no notification, tradesperson
-- chasing someone who had already paid.
--
-- Run this in the Supabase SQL editor. Committing it is not running it.

alter table quotes add column if not exists paystack_references text[] default '{}';

-- Backfill so quotes with a payment already in flight stay matchable.
update quotes
set paystack_references = array[paystack_reference]
where paystack_reference is not null
  and (paystack_references is null or paystack_references = '{}');

-- The webhook looks a quote up by "does this array contain the reference",
-- which without an index is a sequential scan of every quote in the table.
create index if not exists quotes_paystack_references_idx
  on quotes using gin (paystack_references);

-- ---------------------------------------------------------------------------
-- Verify — expect one row, and a count of already-migrated quotes.
-- ---------------------------------------------------------------------------

select column_name, data_type
from information_schema.columns
where table_name = 'quotes' and column_name = 'paystack_references';

select count(*) as quotes_with_references
from quotes
where paystack_references <> '{}';