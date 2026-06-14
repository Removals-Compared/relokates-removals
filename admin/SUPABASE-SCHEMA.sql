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

-- Row Level Security: ON, with NO permissive policies.
-- Effect:
--   - service_role key (used by the Vercel admin API) bypasses RLS
--     by default, so server-side reads/writes keep working.
--   - anon key and authenticated key get 0 rows / cannot insert,
--     even if leaked. Appointment data stays server-only.
ALTER TABLE relokates_appointments ENABLE ROW LEVEL SECURITY;

-- Optional: do the same for the existing quotes table if it
-- currently has RLS off. The Vercel admin API will keep working
-- because it uses the service_role key. The public quote-submit
-- endpoint (api/quote.js) also uses the service_role key so it
-- will keep working too.
--
-- Uncomment to apply:
-- ALTER TABLE relokates_quote_request ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
--  v2 additions: 2FA, reschedule/cancel, recurring bookings
-- ────────────────────────────────────────────────────────────

-- 2FA login codes. Each successful password entry creates a row
-- with a short-lived 6-digit code SMS'd to the admin's phone.
CREATE TABLE IF NOT EXISTS relokates_login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL,           -- SHA-256 of the 6-digit code, never the plain code
  attempt_id text NOT NULL UNIQUE,   -- random opaque id put in the response cookie
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  attempts int DEFAULT 0,
  ip text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS relokates_login_codes_expires_idx
  ON relokates_login_codes (expires_at);
ALTER TABLE relokates_login_codes ENABLE ROW LEVEL SECURITY;

-- Appointments table - additions for reschedule, cancel, and
-- recurring bookings. Idempotent - safe to re-run.
ALTER TABLE relokates_appointments
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'booked'
    CHECK (status IN ('booked', 'rescheduled', 'cancelled', 'completed')),
  ADD COLUMN IF NOT EXISTS recurring_id uuid,
  ADD COLUMN IF NOT EXISTS recurring_pattern text,   -- 'weekly', 'biweekly', 'monthly'
  ADD COLUMN IF NOT EXISTS recurring_until date,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_sent boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS relokates_appointments_status_idx
  ON relokates_appointments (status);
CREATE INDEX IF NOT EXISTS relokates_appointments_recurring_idx
  ON relokates_appointments (recurring_id);
