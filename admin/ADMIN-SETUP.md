# Relokates Admin Area - Setup Guide

The admin area at `/admin` lets you view every quote (from the public
form OR manually added), set the job value, add notes, mark won or
lost, book surveys and moving dates with one click. Bookings land on
info@relokates.co.uk's Google Calendar and email the customer
automatically.

Three things to do once - about 15 minutes total.

## 1. Database (Neon, 2 minutes)

Create a Neon database (https://console.neon.tech), open its SQL editor,
paste the contents of `admin/SCHEMA.sql` and click **Run**. Copy the pooled
connection string; it becomes the `DATABASE_URL` env var in step 3.

What it does:
  - Creates the `relokates_quote_request` table (with `status`, `notes`,
    `updated_at`, `value`, `costs`) and the appointments, reminders and
    activity tables.
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
| `DATABASE_URL` | Neon pooled connection string from step 1 |
| `ADMIN_PASSWORD` | Pick a strong password - this is what you type to log in |
| `ADMIN_SESSION_SECRET` | 32+ random hex chars. Generate with `openssl rand -hex 32` |
| `GCAL_CLIENT_ID` | From step 2a-6 (skip if no calendar) |
| `GCAL_CLIENT_SECRET` | From step 2a-6 (skip if no calendar) |
| `GCAL_REFRESH_TOKEN` | From step 2b-6 (skip if no calendar) |

Redeploy in Vercel so the new env vars take effect.

## 4. Verify

  1. Visit https://www.relokates.co.uk/admin
  2. Enter the `ADMIN_PASSWORD`
  3. You land on the dashboard - any quote in the database shows up
  4. Click "+ Add customer" to test manual entry
  5. Click any row -> opens the quote detail page
  6. Try: set a value, add a note, mark contacted, book a survey
  7. The calendar event lands on info@relokates.co.uk's calendar,
     the customer gets an email

If anything fails, the API responses include the failing step
(`database`, `gcal`, `email`) so you know where to look.

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

## Franchise branch dashboards (added Sep 2026)

Each franchise branch gets its own walled-off dashboard:

- **Birmingham**: `/admin/birmingham` — owner Richard Jones.
  - Password comes from the `BIRMINGHAM_ADMIN_PASSWORD` env var (set in Vercel for production, preview and development).
  - Branch logins use the shared `/api/admin/login` endpoint but receive a `branch` role cookie. That cookie is **rejected with 403 by every head-office endpoint** — a branch can only call `/api/admin/quotes` (which serves them a separate scoped flow that filters leads to `source = relokates.co.uk/birmingham` and re-checks ownership before any status update).
  - Head-office admin sessions can also view a branch's list in the main dashboard as normal, and continue to see branch leads in the main dashboard.
- **Lead tagging**: the quote form on `/removals-birmingham` sets `branch: "birmingham"`, which `/api/quote` whitelists and stores as `source = relokates.co.uk/birmingham` (no schema change needed). Branch notification email: `BIRMINGHAM_NOTIFY_EMAIL` is set in Vercel (production, preview, development) to birmingham@relokates.co.uk, so Birmingham lead alerts go there (falls back to info@relokates.co.uk if the env var is ever removed). Customer auto-replies for Birmingham leads show the branch phone (07947 229838).
- **Adding another branch**: add the slug to `BRANCH_SLUGS` in `api/admin/_session.js` and `BRANCHES` in `api/quote.js`, set `<SLUG>_ADMIN_PASSWORD`, copy `admin/birmingham.html`, and set `window.RELOKATES_BRANCH` on the branch's page.

## Birmingham has its own database (Oct 2026)

Birmingham branch data lives in its **own Neon project** (`relokates-birmingham`, id `dry-lab-98332460`), connection via the `BIRMINGHAM_DATABASE_URL` env var (set in Vercel prod/preview/dev). Branch sessions, the Birmingham page's quote form and branch accept-quote links read/write ONLY that database; head-office sessions only touch the head-office database, and the main dashboard no longer shows Birmingham leads (owner's choice, Oct 2026). A branch login with no database configured gets an error - it never falls back to the head-office DB. The daily reminders cron runs one pass per database; Birmingham reminder emails go to BIRMINGHAM_NOTIFY_EMAIL. Nightly pg_dump backups cover the new DB via ~/neon-backups/config/projects.conf.
