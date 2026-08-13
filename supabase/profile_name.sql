-- Sorted — store the WhatsApp profile name
--
-- Meta sends the sender's WhatsApp display name on every inbound message, in
-- entry[].changes[].value.contacts[0].profile.name. There is no API to look a
-- name up from a number on demand, so this is the only chance to capture it —
-- and we were discarding it.
--
-- Kept separate from users.name, which is what the person TYPED when asked
-- "and your name?" during onboarding. That one is theirs to set and must never
-- be overwritten by whatever they happen to have on their WhatsApp profile.
--
-- IMPORTANT: this repo has shipped a schema change without running it live
-- before (the bills.unconfirmed incident, Jul 2026 — every bill save silently
-- failed for a day). Run this in the Supabase SQL editor and verify with a
-- live select. The code tolerates its absence, but nothing is captured until
-- it exists.

alter table users add column if not exists whatsapp_profile_name text;

-- Verify:
--   select whatsapp_number, whatsapp_profile_name, name, business_name
--   from users order by created_at desc limit 20;