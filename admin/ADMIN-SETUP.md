# Relokates Admin Area - Setup Guide

The admin area at `/admin` lets you view every quote, add internal
notes, book surveys and moving dates with one click, send the customer
both email and SMS confirmations, drop the appointment onto
info@relokates.co.uk's Google Calendar automatically, reschedule and
cancel with another click, and run recurring bookings. Login is
protected by a password plus a 6-digit SMS code (2FA).

Four parts to wire up - 25 minutes total. You can do part 5 (Twilio +
2FA + customer SMS) any time later; the admin still works without it,
2FA is just skipped and customer notifications are email-only.

---

## 1. Supabase (2 minutes)

Open https://app.supabase.com -> your project -> SQL editor -> New
query, paste the entire contents of `admin/SUPABASE-SCHEMA.sql`, tick
"Enable Row Level Security" when the warning appears, click **Run**.

What it does:
  - Adds `status`, `notes`, `updated_at` columns to your existing
    `relokates_quote_request` table.
  - Creates `relokates_appointments` (with status/cancellation/
    recurring fields) and `relokates_login_codes` (for 2FA).
  - Enables RLS on both new tables and indexes the common queries.

Existing quotes are unaffected. Status defaults to `new`.

---

## 2. Google Calendar OAuth (10 minutes - the only fiddly bit)

The admin booking flow creates events on info@relokates.co.uk's Google
Calendar. Google needs an OAuth client + a long-lived refresh token.

### 2a. Create OAuth credentials

  1. https://console.cloud.google.com
  2. Top bar -> select or create a project named "Relokates Admin"
  3. Left nav -> "APIs & Services" -> "Enabled APIs and services"
     -> "ENABLE APIS AND SERVICES" -> "Google Calendar API" -> Enable
  4. Left nav -> "OAuth consent screen":
       - User type: External
       - App name: "Relokates Admin"
       - User support email: info@relokates.co.uk
       - Developer email: amososho@gmail.com
       - Scopes: search and add "Google Calendar API .../auth/calendar"
       - Test users: ADD info@relokates.co.uk
       - Save
  5. Left nav -> "Credentials" -> "CREATE CREDENTIALS" -> "OAuth client ID":
       - Application type: Web application
       - Name: "Relokates Admin Web"
       - Authorized redirect URIs: `https://developers.google.com/oauthplayground`
       - Create
  6. Copy the **Client ID** and **Client secret**.

### 2b. Get a refresh token via OAuth Playground

  1. https://developers.google.com/oauthplayground
  2. Gear icon (top right) -> "Use your own OAuth credentials" -> paste
     the Client ID and Client secret -> close
  3. Left panel -> "Google Calendar API v3" ->
     `https://www.googleapis.com/auth/calendar`
  4. "Authorize APIs" -> sign in as info@relokates.co.uk -> approve
     (click "Advanced -> Go to ... (unsafe)" if the consent screen
     warns - this is normal for personal-use OAuth)
  5. "Exchange authorization code for tokens"
  6. Copy the **refresh_token** field from the JSON response (the long
     string starting `1//`)

---

## 3. Twilio + 2FA + customer SMS (10 minutes)

Used for:
  - 2FA: SMSing a 6-digit code to your phone on every login
  - Customer SMS confirmations on book, reschedule and cancel

You can skip this step initially - the admin will still work, 2FA will
be bypassed and customers will only get email. Add Twilio later.

### 3a. Create a Twilio account

  1. https://www.twilio.com/try-twilio - sign up
  2. Verify your email and phone (Twilio will text a code)
  3. After signup you land on the Console dashboard - copy:
       - **Account SID** (starts `AC...`)
       - **Auth Token** (click the eye to reveal)

### 3b. Get a UK SMS-capable phone number

  1. Console -> Phone Numbers -> Buy a Number
  2. Filter: Country = United Kingdom, Capabilities = SMS
  3. Buy any UK number (~£1/month). It will show in E.164 format like
     `+447xxxxxxxxx` - this is your `TWILIO_FROM_NUMBER`.

Note: Twilio trial accounts can only SMS pre-verified numbers. For
production use, upgrade by adding payment - £15 minimum is enough for
months of admin and customer SMS at typical removals volume.

### 3c. Your admin phone

The number Twilio will text the 2FA code to. Use E.164:
`+447477911190` is the one you gave me. Set this as `ADMIN_PHONE`.

---

## 4. Vercel env vars (3 minutes)

Vercel dashboard -> your `relokates-removals` project -> Settings ->
Environment Variables. Add each in all three environments:

### Always required

| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | Pick a strong password. You type this to log in. |
| `ADMIN_SESSION_SECRET` | 32+ random hex chars. Generate with `openssl rand -hex 32`. |
| `GCAL_CLIENT_ID` | From step 2a-6 |
| `GCAL_CLIENT_SECRET` | From step 2a-6 |
| `GCAL_REFRESH_TOKEN` | From step 2b-6 |

### Required for 2FA + customer SMS

Skip this group if you're not setting up Twilio yet. Admin still works
without them, just no SMS anywhere.

| Name | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | From Twilio Console (starts `AC`) |
| `TWILIO_AUTH_TOKEN` | From Twilio Console |
| `TWILIO_FROM_NUMBER` | Your UK Twilio number in `+44...` form |
| `ADMIN_PHONE` | Your mobile number in `+44...` form (e.g. `+447477911190`) |

After adding, click **Redeploy** on the latest deployment so the new
env vars take effect.

---

## 5. Verify

  1. Visit https://www.relokates.co.uk/admin
  2. Enter the `ADMIN_PASSWORD`
  3. If Twilio is configured: enter the 6-digit code SMS'd to your
     phone. If Twilio isn't configured: you go straight in.
  4. You land on the dashboard listing every quote in Supabase.
  5. Open any quote, click "Book Survey", pick a date/time, submit.
  6. Within seconds:
       - Calendar event lands on info@relokates.co.uk's primary calendar
       - Customer email arrives at the quote's email address
       - Customer SMS arrives at the quote's phone (if Twilio configured)
  7. Click "Reschedule" on the appointment, pick a new time:
       - Old calendar event is removed, new one created
       - Customer gets a reschedule email + SMS
  8. Click "Cancel" on the appointment:
       - Calendar event removed, appointment marked cancelled
       - Customer gets a cancellation email + SMS

If anything fails, the API response includes the failing component
(`supabase`, `gcal`, `email`, `sms`) so you know where to look.

---

## What's protected

  - `/admin`, `/admin/dashboard`, `/admin/quote/*`, and every
    `/api/admin/*` endpoint check for a valid signed session cookie.
  - Bad cookie or missing cookie -> 401 / redirect to login.
  - 2FA codes are SHA-256 hashed in the DB, single-use, expire after
    5 minutes, max 5 attempts.
  - Cookies are HTTP-only, Secure, SameSite=Lax. They last 7 days.
  - Login attempts are constant-time-compared on password AND code.
  - robots.txt blocks search engines from indexing `/admin`.

---

## What each feature looks like in the UI

### 2FA (new)

`/admin` shows a password field. Submit it and the page swaps to a
6-digit code field, with the code sent to `ADMIN_PHONE` via Twilio.
Code expires in 5 minutes. "Use a different password" returns to
step 1.

### Customer SMS (new)

Sent in addition to the existing email on:
  - First booking (book survey / book move)
  - Reschedule (new time included)
  - Cancellation
SMS is only attempted if Twilio is configured AND the customer has a
phone number on file. Status shown on each appointment card.

### Per-service email templates (new)

Confirmation emails now include a service-specific "what happens on
the day" paragraph - different content for House Removal, Office
Removal, Packing, Storage, Luxury, House Clearance, International
Dubai, International Other, and Man and Van.

### Reschedule / cancel (new)

Each booked appointment shows two buttons:
  - **Reschedule** -> modal opens with the current time pre-filled.
    Pick a new time, submit. Calendar event is recreated, customer
    gets reschedule email + SMS, status -> `rescheduled`.
  - **Cancel** -> confirms, then deletes the calendar event, marks
    status -> `cancelled`, customer gets cancellation email + SMS.
    Cancelled appointments are shown struck-through but kept for
    audit.

### Recurring bookings (new)

Both survey and move forms have a "Make this recurring" checkbox.
Tick it to reveal "Repeat" (weekly / every 2 weeks / monthly) and
"Until" (end date). Submission creates N appointments and N calendar
events, but only emails/texts the customer about the FIRST one - the
rest are calendar entries for your scheduling.

---

## What's NOT in scope (yet)

  - Multiple admin users with different permissions
  - SMS reply handling (customers replying STOP, RESCHEDULE etc.)
  - Customer self-service reschedule via a magic-link
  - Push notifications to a mobile app
  - Audit log of admin actions

Say the word for any of them.
