# Relokates Admin Area - Setup Guide

This is the one-time setup so the admin area (`/admin`) at relokates.co.uk
actually works. Three things to do, ~15 minutes total:

  1. Run a SQL script in Supabase
  2. Set up a Google Cloud OAuth client and get a refresh token
  3. Add 5 env vars in Vercel

After that, every quote submitted via the public form lands in your admin
dashboard, you can add notes, book a survey or a moving date, the
customer receives a confirmation email, and the appointment lands on
info@relokates.co.uk's Google Calendar automatically.

---

## 1. Supabase (2 minutes)

Open https://app.supabase.com -> your project -> SQL editor -> New
query, paste the entire contents of `admin/SUPABASE-SCHEMA.sql`,
click **Run**.

What it does:
  - Adds `status`, `notes`, `updated_at` columns to your existing
    `relokates_quote_request` table.
  - Creates a new `relokates_appointments` table for bookings and surveys.
  - Adds two performance indexes.

Existing quotes are unaffected. Status defaults to `new` for everything.

---

## 2. Google Calendar OAuth (10 minutes - the only fiddly bit)

The admin booking flow creates events on info@relokates.co.uk's
Google Calendar. Google needs an OAuth client + a long-lived refresh
token so Vercel can post events without you logging in every time.

### 2a. Create OAuth credentials

  1. Go to https://console.cloud.google.com
  2. Top bar -> select or create a project named "Relokates Admin"
  3. Left nav -> "APIs & Services" -> "Enabled APIs and services"
     -> "ENABLE APIS AND SERVICES" -> search "Google Calendar API"
     -> Enable
  4. Left nav -> "APIs & Services" -> "OAuth consent screen":
       - User type: External (it's fine, no verification needed for
         personal-use single-user OAuth)
       - App name: "Relokates Admin"
       - User support email: info@relokates.co.uk
       - Developer email: amososho@gmail.com
       - Scopes: search and add "Google Calendar API .../auth/calendar"
       - Test users: ADD info@relokates.co.uk
       - Save
  5. Left nav -> "APIs & Services" -> "Credentials" -> "CREATE
     CREDENTIALS" -> "OAuth client ID":
       - Application type: Web application
       - Name: "Relokates Admin Web"
       - Authorized redirect URIs: `https://developers.google.com/oauthplayground`
       - Create
  6. Copy the **Client ID** and **Client secret** that appear. You'll
     need these in step 3.

### 2b. Get a refresh token via OAuth Playground

  1. Open https://developers.google.com/oauthplayground in a new tab
  2. Click the gear icon (top right) -> tick "Use your own OAuth
     credentials" -> paste the Client ID and Client secret from step
     2a-6 -> close
  3. Left panel -> scroll to "Google Calendar API v3" -> tick
     `https://www.googleapis.com/auth/calendar`
  4. Click "Authorize APIs"
  5. Sign in as **info@relokates.co.uk** and approve
     (You may need to click "Advanced -> Go to Relokates Admin (unsafe)"
     because the OAuth consent screen is unverified - this is normal
     and safe for personal-use OAuth)
  6. Click "Exchange authorization code for tokens"
  7. Copy the **Refresh token** that appears in the response panel.
     This is the value you'll use in step 3.

The refresh token does not expire as long as you don't revoke it.

---

## 3. Vercel env vars (3 minutes)

Vercel dashboard -> your `relokates-removals` project -> Settings ->
Environment Variables -> add each of these (all environments):

| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | Pick a strong password. You'll type this to log in. |
| `ADMIN_SESSION_SECRET` | 32+ random characters. Used to sign session cookies. Generate one with: `openssl rand -hex 32` |
| `GCAL_CLIENT_ID` | The Client ID from step 2a-6 |
| `GCAL_CLIENT_SECRET` | The Client secret from step 2a-6 |
| `GCAL_REFRESH_TOKEN` | The Refresh token from step 2b-7 |

After adding, click "Redeploy" on the latest deployment so the new
env vars take effect.

---

## 4. Verify it works

  1. Visit https://www.relokates.co.uk/admin
  2. Enter the `ADMIN_PASSWORD`
  3. You should land on the dashboard listing every quote in your
     Supabase
  4. Open any quote, click "Book Survey", pick a date/time, submit
  5. Check info@relokates.co.uk's Google Calendar - the event should
     appear within seconds
  6. The customer should receive an email with the appointment details

If anything fails, the API responses include the failing component
(supabase, gcal, email) so you know where to look.

---

## What's protected

  - `/admin`, `/admin/dashboard`, `/admin/quote/*` and every
    `/api/admin/*` endpoint check for a valid signed session cookie.
  - Bad cookie or missing cookie -> 401 / redirect to login.
  - Cookies are HTTP-only, Secure, SameSite=Lax. They last 7 days.
  - robots.txt blocks search engines from indexing /admin.

---

## What's NOT covered (yet) - say the word and we add it

  - Multiple admin users with different permissions
  - 2FA
  - SMS confirmation to customer alongside email
  - Custom email templates per appointment type
  - Reschedule / cancel flow in the UI (you can still delete from
    Calendar manually for now)
  - Recurring bookings
