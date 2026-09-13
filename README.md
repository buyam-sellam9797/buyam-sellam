# Buyam Sellam

Douala fashion & beauty marketplace — MVP scaffold.

## What exists right now

A working Next.js site with: homepage, browse/category filtering, product
pages, a demo checkout flow (mobile money UI, not yet connected to a real
provider), a seller sign-up form, a seller dashboard, and shop pages — all
running on placeholder data so every page already looks and works like a
real product.

The database structure is written and ready in `supabase/schema.sql`, but
it isn't connected to anything live yet.

## What's needed to go live

Four accounts, created by Lio (not Claude), each just a sign-up form:

1. **Domain name** — e.g. from Namecheap. ~$10-15/year.
2. **Vercel** (hosting) — free to start. vercel.com, sign up with email or GitHub.
3. **Supabase** (database) — free to start. supabase.com, sign up with email.
   Once created, run `supabase/schema.sql` in its SQL editor, then copy the
   Project URL and anon key from Settings -> API into `.env.local`
   (see `.env.example`).
4. **Campay or NotchPay** (mobile money payments) — this one requires real
   identity/business verification since it moves money. campay.net or
   notchpay.co.

Once those four exist and the keys are handed over, the remaining work
(wiring the checkout form to a real payment call, connecting pages to
live Supabase data instead of the mock catalog, deploying) is on Claude.

## Local development

```
npm install
npm run dev
```
