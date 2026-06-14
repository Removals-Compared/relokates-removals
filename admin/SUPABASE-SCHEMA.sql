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
