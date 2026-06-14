# Relokates Admin Area - Setup Guide

The admin area at `/admin` lets you view every quote (from the public
form OR manually added), set the job value, add notes, mark won or
lost, book surveys and moving dates with one click. Bookings land on
info@relokates.co.uk's Google Calendar and email the customer
automatically.

Three things to do once - about 15 minutes total.

## 1. Supabase (2 minutes)

Open https://app.supabase.com -> SQL editor -> paste the contents
of `admin/SUPABASE-SCHEMA.sql` -> click **Run**.

What it does:
  - Adds `status`, `notes`, `updated_at`, `value` columns to your
    existing `relokates_quote_request` table.
  - Backfills existing rows with `status = 'new'`.
  - Creates `relokates_appointments` table for bookings + surveys.
  - Enables Row Level Security ONLY on the new appointments table.

**Important:** the script does NOT enable RLS on
`relokates_quote_request`. Do not enable it manually either - if you
do, the public quote form (api/quote.js) will start silently failing
to save leads. The admin still works regardless because it uses the
service-role key, but RLS on the public table would block the
anon-key write that the form does.

## 2. Google Calendar OAuth (10 minutes)

The admin booking flow creates events on info@relokates.co.uk's
Google Calendar. Skip this step if you don't want calendar integration
for now - bookings will still save and email the customer, just
without a calendar event.

### 2a. Create OAuth credentials

  1. https://console.cloud.google.com
  2. Select or create a project named "Relokates Admin"
  3. APIs & Services -> Enabled APIs -> ENABLE Google Calendar API
  4. APIs & Services -> OAuth consent screen:
       - External, App name "Relokates Admin"
       - User support email: info@relokates.co.uk
       - Scopes: add `https://www.googleapis.com/auth/calendar`
       - Test users: add info@relokates.co.uk
       - Save
  5. APIs & Services -> Credentials -> CREATE CREDENTIALS ->
     OAuth client ID:
       - Web application, name "Relokates Admin Web"
       - Authorized redirect URI: `https://developers.google.com/oauthplayground`
       - Create
  6. Copy the Client ID and Client secret.

### 2b. Get a refresh token via OAuth Playground

  1. https://developers.google.com/oauthplayground
  2. Gear icon -> "Use your own OAuth credentials" -> paste IDs
  3. Left panel -> Google Calendar API v3 -> select `auth/calendar`
  4. Authorize APIs -> sign in as info@relokates.co.uk -> approve
  5. Exchange authorization code for tokens
  6. Copy the `refresh_token` (starts `1//`)

## 3. Vercel env vars (3 minutes)

Vercel -> your `relokates-removals` project -> Settings ->
Environment Variables. Add for all environments:

| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | Pick a strong password - this is what you type to log in |
| `ADMIN_SESSION_SECRET` | 32+ random hex chars. Generate with `openssl rand -hex 32` |
| `GCAL_CLIENT_ID` | From step 2a-6 (skip if no calendar) |
| `GCAL_CLIENT_SECRET` | From step 2a-6 (skip if no calendar) |
| `GCAL_REFRESH_TOKEN` | From step 2b-6 (skip if no calendar) |

Redeploy in Vercel so the new env vars take effect.

## 4. Verify

  1. Visit https://www.relokates.co.uk/admin
  2. Enter the `ADMIN_PASSWORD`
  3. You land on the dashboard - any quote in Supabase shows up
  4. Click "+ Add customer" to test manual entry
  5. Click any row -> opens the quote detail page
  6. Try: set a value, add a note, mark contacted, book a survey
  7. The calendar event lands on info@relokates.co.uk's calendar,
     the customer gets an email

If anything fails, the API responses include the failing step
(`supabase`, `gcal`, `email`) so you know where to look.

## What's protected

  - `/admin/*` and `/api/admin/*` check for a signed session cookie
  - Cookies are HTTP-only, Secure, SameSite=Lax, 7-day expiry
  - Constant-time password comparison
  - robots.txt blocks crawlers from /admin

## Status pipeline

| Status | When it gets set |
|---|---|
| `new` | Default on every new quote (public form or manual add) |
| `contacted` | You click "Mark contacted" on the detail page |
| `survey_booked` | You book a survey appointment |
| `move_booked` | You book a moving-day appointment |
| `won` | You click "Mark won" - successful conversion |
| `lost` | You click "Mark lost" - did not convert |

The dashboard filter dropdown lets you isolate any of these
statuses. The "All" view shows everything regardless.
