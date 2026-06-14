-- Relokates admin area schema additions
-- Run this once in Supabase SQL editor (https://app.supabase.com -> SQL editor)

-- Quotes table already exists as relokates_quote_request. Add admin-side fields.
ALTER TABLE relokates_quote_request
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Index status so the dashboard filter is fast even at scale.
CREATE INDEX IF NOT EXISTS relokates_quote_request_status_idx
  ON relokates_quote_request (status);

-- Bookings + surveys. One row per appointment.
CREATE TABLE IF NOT EXISTS relokates_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id bigint REFERENCES relokates_quote_request(id) ON DELETE CASCADE,
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

-- Optional but recommended: RLS off on these tables so the service
-- role key (already in Vercel env as SUPABASE_KEY) can read/write.
-- Public anon access is NOT granted here because the admin API is
-- the only consumer.
