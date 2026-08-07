-- Relokates admin area schema additions
-- Run this once in Supabase SQL editor (https://app.supabase.com -> SQL editor)
-- Idempotent: safe to re-run.
--
-- IMPORTANT: This script does NOT enable Row Level Security on
-- relokates_quote_request. Enabling RLS on that table breaks the
-- public quote form (api/quote.js) unless you also add an INSERT
-- policy for the anon key. To avoid that footgun, this script
-- explicitly leaves RLS off on the public quotes table.

-- Add admin-side fields to the existing quotes table.
ALTER TABLE relokates_quote_request
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS value numeric(10,2);

-- Backfill status on any pre-existing rows.
UPDATE relokates_quote_request SET status = 'new' WHERE status IS NULL;

-- Index for dashboard filter performance.
CREATE INDEX IF NOT EXISTS relokates_quote_request_status_idx
  ON relokates_quote_request (status);

-- Bookings + surveys.
-- Note: lead_id is intentionally NOT a foreign key reference because
-- some installations of relokates_quote_request lack a primary-key
-- constraint on id (Postgres requires the referenced column to have a
-- unique/PK constraint). The admin code handles the relation in app
-- logic so we don't need DB-level referential integrity.
CREATE TABLE IF NOT EXISTS relokates_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id bigint NOT NULL,
  type text NOT NULL CHECK (type IN ('survey', 'move')),
  scheduled_for timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  address text,
  notes text,
  gcal_event_id text,
  email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS relokates_appointments_lead_idx
  ON relokates_appointments (lead_id);

CREATE INDEX IF NOT EXISTS relokates_appointments_when_idx
  ON relokates_appointments (scheduled_for);

-- RLS ON for appointments only (admin uses service_role which bypasses).
ALTER TABLE relokates_appointments ENABLE ROW LEVEL SECURITY;

-- ── Call-back reminders ─────────────────────────────────────
-- Powers the "Call ..." chips on the dashboard and the callback box on the
-- lead page. When gcal is configured a "Call <name>" event is added so
-- Google alerts you at the chosen time.
CREATE TABLE IF NOT EXISTS reminders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       bigint NOT NULL,
  remind_on     date NOT NULL,        -- YYYY-MM-DD
  remind_time   text,                 -- HH:MM (local UK time)
  note          text,
  gcal_event_id text,                 -- the "Call ..." Google Calendar event
  sent          boolean DEFAULT false,
  sent_at       timestamptz,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminders_lead_idx ON reminders (lead_id);
CREATE INDEX IF NOT EXISTS reminders_due_idx  ON reminders (remind_on, sent);

-- Same access model as relokates_quote_request and relokates_appointments:
-- RLS is OFF. The admin API key is used server-side only (never exposed to the
-- browser), and it does NOT bypass RLS - so enabling RLS here without an INSERT
-- policy blocks the app with a 42501 "row-level security policy" error. Keep it
-- disabled to match the other admin tables.
ALTER TABLE reminders DISABLE ROW LEVEL SECURITY;

-- ── Team activity log ───────────────────────────────────────
-- Structured audit feed for the Insights page (who added/edited/deleted a lead).
-- Same access model as the other admin tables (admin key, RLS off).
CREATE TABLE IF NOT EXISTS activity_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at         timestamptz NOT NULL DEFAULT now(),
  actor      text NOT NULL DEFAULT 'unknown',
  action     text NOT NULL DEFAULT '',
  lead_id    text,
  lead_name  text DEFAULT '',
  detail     text DEFAULT ''
);
CREATE INDEX IF NOT EXISTS activity_log_at_idx ON activity_log (at DESC);
ALTER TABLE activity_log DISABLE ROW LEVEL SECURITY;
