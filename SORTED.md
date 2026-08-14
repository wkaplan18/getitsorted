# Sorted — Product Spec

**One line:** WhatsApp it to Sorted and it gets sorted.

Sorted is a WhatsApp-first money assistant for South African one-person
businesses and households. There is no app to install. The entire interface is
a WhatsApp conversation with the Sorted number. Everything else is server-side.

---

## 1. The two halves of one product

A one-man trade business has exactly two money problems. Sorted does both, on
the same number, in the same conversation.

| | **Money out** (live today) | **Money in** (this build) |
|---|---|---|
| What the user sends | A bill, invoice, or "pay the vet R2000 Friday" | "Quote Mrs Naidoo, 3 bedrooms at R850, materials R1200" |
| What Sorted does | Extracts payee, amount, due date, bank details | Extracts customer + line items, builds a branded PDF quote |
| What comes back | Tracked in the dashboard, reminded before due | A PDF he forwards to his customer, with a payment link |
| Tables | `bills`, `reminders`, `payees` | `quotes`, `quote_items`, `customers` |

These are not two products sharing a number. They are the two sides of one
person's cashflow. The plumber who quotes a customer on Monday is the same
plumber paying his supplier on Friday.

### Who this is for

- Informal and small trades: plumber, electrician, painter, panel beater,
  landscaper, tiler, mover, hairdresser, mechanic
- Roughly 1.9m non-VAT-registered businesses in South Africa
- Android phone, expensive data (they buy R30/1GB, ~R22–30/GB — 4–5x what a
  contract user pays), storage always full, device changes often
- The existing household bills user stays supported. Nothing about the money-out
  flow changes.

### Design consequences (non-negotiable)

1. **WhatsApp only.** No app store install, no password, no email.
   Phone number is the identity.
2. **Every reply under ~600 bytes.** Data costs them real money.
3. **Server-side state only.** The device is disposable.
4. **PDFs are links, not attachments** — he chooses when to spend the data.
5. **The bot always says what happens next.** Never a dead end.
6. **When unsure, ask.** A bot that asks is fine. A bot that silently turns a
   supplier invoice into a customer quote destroys trust permanently.

---

## 2. Language

**Input: understand everything. Output: user chooses.**

Claude already handles isiZulu, isiXhosa, Afrikaans, Sesotho and code-switched
English natively on input. No translation layer is needed for understanding —
a user can type "Quote uMam' Dlamini, 3 amakamelo R850 nga room" and it parses.

Output language is a per-user setting, because a WhatsApp reply he doesn't
fully understand is a support ticket he can't raise.

| Code | Language | Why |
|---|---|---|
| `en` | English | Default. Business lingua franca. |
| `zu` | isiZulu | **Most spoken home language in SA — 24.4%** (Census 2022), and #1 in Gauteng and KZN |
| `af` | Afrikaans | 10.6%, dominant in Western/Northern Cape trades |

Set at onboarding, changeable any time by texting `LANGUAGE`. Stored on
`users.language`.

**Rule: money, numbers, dates and names are never translated.** "R3,750" and
"Mrs Naidoo" render identically in all three. Only the surrounding sentence
changes. This keeps the numbers unambiguous and keeps the translation surface
small — see `lib/i18n.ts`, one flat key→string map per language.

---

## 3. The money-in conversation, step by step

The whole design goal: **a tradesman who has never used software must be able
to send a professional quote within 3 minutes of first contact.**

### 3.1 First contact

A brand-new number gets the English welcome, which names the `LANGUAGE`
command. The language picker is **not** forced up front, on purpose: a new user
whose first message is a forwarded invoice must have that invoice saved, and a
picker that interrupts to ask "1, 2 or 3?" would swallow it.

The picker opens automatically at the only moment it can't lose anything — the
first time someone tries to send a quote:

```
Him:    Quote for Mrs Naidoo, paint 3 bedrooms R850 each

Sorted: Hi! I'm Sorted. I help you send quotes and get paid, and I keep
        track of the bills you owe.

        First — which language should I reply in?
        1  English
        2  isiZulu
        3  Afrikaans
```

He replies `1`. His draft quote is carried through the picker and through
onboarding, so he never retypes the job. Everything after this is in his
language.

### 3.2 Onboarding (once, ~2 minutes)

Four questions, one at a time. Never more than one question per message —
a wall of questions gets ignored.

```
Sorted: What's your business called?
Him:    Sipho Plumbing
Sorted: Got it, Sipho Plumbing. What work do you do?
Him:    plumbing
Sorted: And your name?
Him:    Sipho Ndlovu
Sorted: Last thing — send me your logo as a picture if you have one.
        No logo? Just reply SKIP and I'll use your business name.
Him:    [sends image]
Sorted: Done. You're set up.

        To make a quote, just tell me who it's for and what you're charging.
        Like this:
        "Quote for Mrs Naidoo, paint 3 bedrooms R850 each, materials R1200"

        Try it now.
```

Skippable at any point with `SKIP`. Anything missing gets asked for later, at
the moment it's actually needed — never up front.

### 3.3 Making a quote (the core loop, target: 60 seconds)

```
Him:    Quote for Mrs Naidoo, 12 Oak Road. Paint 3 bedrooms R850 each,
        materials R1200

Sorted: Here's the quote:

        FOR: Mrs Naidoo, 12 Oak Road

        Paint bedrooms      3 x R850    R2,550
        Materials           1 x R1,200  R1,200
        ─────────────────────────────────────
        TOTAL                           R3,750

        Reply SEND to make the PDF, or tell me what to change.
```

He can say "change materials to 1500" or "add gate R400" in plain language.
Each change re-renders the summary above. No forms, no menus.

```
Him:    send
Sorted: Quote QUO-0007 ready 👇
        sorted.co.za/q/a8f3c2

        Forward that to Mrs Naidoo. She can view it and pay you right there.

        I'll tell you the moment she opens it or pays.
```

He forwards the link inside WhatsApp. **This is the whole magic trick:** he
looks like an established company for the price of one text message.

### 3.4 Getting paid

Customer opens the link → clean mobile page with his logo, the line items, and
a **Pay now** button (Paystack: card, EFT, Capitec Pay).

```
Sorted: 💰 Mrs Naidoo paid R3,750 for QUO-0007.
        Money's on its way to your account.
```

### 3.5 Job done → invoice

```
Him:    QUO-0007 done
Sorted: Nice one. Turned it into invoice INV-0007.
        Want to add photos of the finished work? Just send them.
```

Photos attach to the invoice and appear on the customer's page — proof of work,
which is the thing that gets a tradesman rehired and referred.

### 3.6 Month-end (the retention hook)

Fired by the existing `/api/reminders` cron on the 1st:

```
Sorted: July for Sipho Plumbing:

        Money in      R47,200  (11 jobs)
        Still owed    R8,400   (3 customers)
        Bills paid    R12,180

        Want me to chase the 3 who haven't paid?
```

He replies `YES` → polite reminders go out on his behalf.

This is the only place he has ever seen his own numbers. It is the single
strongest reason he keeps paying.

### 3.7 Commands (always available, any language)

| Command | Does |
|---|---|
| `HELP` | Short menu of what he can do |
| `QUOTES` | Last 5 quotes with status |
| `BILLS` | Bills he owes (existing) |
| `LOGIN` | Sends dashboard code (existing) |
| `LANGUAGE` | Change reply language |
| `STOP` | Pause all messages (existing) |

---

## 4. Disambiguation — the one thing that must not break

The same number receives both "a bill I owe" and "a quote I'm sending". Getting
this wrong is the worst possible failure.

The AI returns `message_type` plus a `confidence` value:

- **`new_bill`** — money he owes. Existing path, unchanged.
- **`quote_request`** — money he's charging. New path.
- **`reminder`**, **`bank_update`**, **`unknown`** — existing paths.

**When confidence is low, do not guess. Ask:**

```
Sorted: Quick check — is this a bill you need to PAY,
        or a quote you're SENDING to a customer?

        1  I need to pay it
        2  I'm sending it to a customer
```

Strong signals for `quote_request`: the words quote/quotation/estimate/price,
a named customer with "for", multiple line items, per-unit pricing, an address.
Strong signals for `new_bill`: bank details present, an account/reference
number, a due date, "I owe", a PDF invoice from a known payee.

A user with no business profile who sends something quote-shaped gets offered
onboarding rather than being dropped.

---

## 5. Data model (additions only)

Existing tables — `users`, `bills`, `reminders`, `payees`, `trusted_senders` —
are **not modified except for new nullable columns on `users`**. The money-out
product keeps working untouched.

```
users            + language          text default 'en'   ('en'|'zu'|'af')
                 + business_name     text
                 + trade             text
                 + logo_url          text
                 + vat_number        text
                 + bank_name / account_number / branch_code   (for the PDF)
                 + convo_state       jsonb   -- multi-step conversation position
                 + onboarded_at      timestamptz

customers        id, user_id, name, normalised_name, whatsapp_number,
                 email, address, created_at
                 unique(user_id, normalised_name)

quotes           id, user_id, customer_id, number ('QUO-0007'),
                 doc_type ('quote'|'invoice'),
                 status ('draft'|'sent'|'viewed'|'accepted'|'paid'|'cancelled'),
                 subtotal, vat_amount, total,
                 public_token (url-safe, unguessable),
                 paystack_reference, notes,
                 created_at, sent_at, viewed_at, paid_at

quote_items      id, quote_id, description, quantity, unit_price,
                 line_total, position

quote_photos     id, quote_id, storage_path, caption, created_at
```

`convo_state` on `users` is what makes multi-step conversation possible on a
stateless webhook — it holds `{ step, draft_quote, awaiting }` and is cleared
on completion or by `CANCEL`.

**`public_token` must be a 128-bit random URL-safe string**, not a sequential
id. The public quote page is unauthenticated by design — the customer must not
need an account — so the token is the only thing protecting it.

---

## 6. Architecture

| Layer | Choice | Status |
|---|---|---|
| WhatsApp | Meta Cloud API, direct (no BSP) | **Live** — `lib/whatsapp.ts`, unchanged |
| Runtime | Next.js 15 on Vercel | **Live** |
| DB + storage | Supabase | **Live** |
| AI extraction | Claude Haiku, date-aware SA-timezone prompt | **Live** — extended, not replaced |
| Sessions | HMAC 30-day token | **Live** — `lib/session.ts`, unchanged |
| PDF | `@react-pdf/renderer`, server-side `renderToBuffer` | **New** — pattern lifted from QuotingHub `src/lib/pdf/` |
| Payments | Paystack one-off transactions | **New** — replaces the parked Stitch work |
| Cron | cron-job.org job 8075132, every 15 min | **Live** — extended for month-end |

### Stitch stays, for now

The original plan here was to delete `lib/stitch.ts`. It wasn't, deliberately:
Stitch is wired into the money-out flow (`/api/pay`, `bills.stitch_payment_id`,
the dashboard's "pay this bill" button). Ripping it out would change the working
half of the product to serve the new half, which is not worth the risk.

Paystack is added **alongside** it and used only for money-in. If Stitch never
resumes, migrating bill payments onto Paystack later is a small, separate job.

Note this leaves the parked security issue open: `/pay/success` still marks
bills paid without verifying with Stitch server-side. The new money-in path does
not have that flaw — `/q/[token]/paid` calls `verifyTransaction()` before
marking anything, and the signed webhook is the authoritative record.

### Meta Business Verification — not required for this build

Verification is **not** done, and does not need to be. It gates
Authentication-category templates (already routed around via the user-initiated
`LOGIN` flow) and raises the messaging tier above ~250 business-initiated
conversations per 24h. Every notification here — quote viewed, payment
received, month-end summary — is **Utility category**, which works unverified.

Revisit when sustained outbound exceeds ~200 conversations/day.

### New WhatsApp templates needed (Utility category)

Business-initiated messages outside the 24h window need approved templates:

| Template | Params | Fires when |
|---|---|---|
| `quote_viewed` | customer, quote no. | Customer opens the quote link |
| `quote_paid` | customer, amount, quote no. | Paystack webhook confirms payment |
| `month_summary` | month, money in, outstanding | 1st of month — **not built** |

Param order is the order the code passes them, not a description — `quote_paid`
reads `{{1}} paid {{2}} for {{3}}`. An earlier version of this table had the
first two the wrong way round; Meta does not error on a mis-ordered template, it
just sends nonsense, so check the body text against the call site in
`lib/quoteView.ts` rather than against this table.

Existing approved templates are untouched.

---

## 7. Environment variables

New:

```
PAYSTACK_SECRET_KEY          # Paystack dashboard → Settings → API Keys
NEXT_PUBLIC_APP_URL          # already exists — must be the live domain, or
                             # every quote link Sorted sends will be broken
```

Nothing removed. `STITCH_*` stays for the money-out flow.

A Supabase **storage bucket named `logos`** is also required, public-read, or
onboarding silently keeps every quote logo-less.

---

## 8. What was built

All of it. Type-check and production build both pass.

| File | Status |
|---|---|
| `supabase/quotes.sql` | new — migration + `next_quote_seq()` |
| `lib/i18n.ts` | new — en/zu/af reply strings |
| `lib/quotes.ts` | new — totals, numbering, drafts, WhatsApp rendering |
| `lib/convo.ts` | new — language pick, onboarding, quote confirm/edit loop |
| `lib/paystack.ts` | new — payment links, verify, HMAC webhook |
| `lib/quoteView.ts` | new — shared loader, `markViewed`, `markPaid` |
| `lib/pdf/QuotePDF.tsx` | new — branded A4 quote/invoice |
| `lib/claude.ts` | extended — `quote_request`, line items, confidence, `applyQuoteEdit` |
| `lib/supabase.ts` | extended — `User` type gains the business profile |
| `app/api/webhook/route.ts` | extended — quote branch, convo routing, `QUOTES`/`LANGUAGE` |
| `app/api/quotes/route.ts` | new — dashboard list + profile PATCH |
| `app/api/quotes/[token]/pdf` | new |
| `app/api/quotes/[token]/pay` | new |
| `app/api/paystack/webhook` | new |
| `app/q/[token]/page.tsx` | new — public customer-facing quote |
| `app/q/[token]/paid/page.tsx` | new — verified payment return |
| `app/app/page.tsx` | extended — Quotes tab + business profile card |

Bills, reminders, trusted senders and the Stitch bill-payment flow are
untouched.

### Before this works in production

1. **Run `supabase/quotes.sql`** in the Supabase SQL editor, then run the
   verify queries at the bottom of it. Do not skip this — see §9.
2. **Create a public Supabase storage bucket named `logos`.**
3. **Set `PAYSTACK_SECRET_KEY`** in Vercel, and point the Paystack webhook at
   `https://<domain>/api/paystack/webhook`.
4. **Confirm `NEXT_PUBLIC_APP_URL`** is the live domain — every quote link
   Sorted sends is built from it.
5. **Submit three Utility templates**: `quote_viewed`, `quote_paid`,
   `month_summary`. Until approved, those notifications fail silently and are
   logged; nothing else breaks.
6. **Have a native isiZulu speaker read `lib/i18n.ts`** before real users see it.

### Not built yet

The month-end summary (§3.6) and the job-done → invoice conversion (§3.5) are
specced but not implemented — both need the cron in `/api/reminders` extended,
which is a separate change to a job that currently only handles bills.

---

## 9. Known risks

- **Migration drift.** This repo has shipped a schema change without running it
  live before — the `unconfirmed` column broke every bill save for a day, and
  the webhook reported "✅ saved" the whole time because insert errors weren't
  checked. **Every migration in this build must be run in Supabase and verified
  with a live `select` before the code that depends on it is trusted.**
- **AI mis-parsing amounts.** A wrong line item on a customer-facing quote is a
  commercial injury, not a bug. Mitigation: the full quote is always shown for
  confirmation before a PDF exists, and `SEND` is an explicit second step.
- **Bill/quote confusion.** Mitigated by the explicit ask in §4.
- **Distribution is unproven.** The wholesaler-partnership channel (a supplier
  handing Sorted to their trade customers) is the assumption most likely to be
  wrong and the cheapest to test. It is a phone call, not a build.

---

## 10. Out of scope for v1

Recurring quotes · multi-user businesses · stock/inventory · timesheets ·
credit notes · accounting export · Sage/Xero sync · voice-note quoting
(transcription exists as a graceful "can't read yet" reply; wire it in v2
once text quoting is proven).
