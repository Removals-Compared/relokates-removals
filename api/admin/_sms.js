// Twilio SMS helper. Uses Twilio's REST API directly so we don't
// need the heavy twilio npm package on every cold start.
//
// Env vars required:
//   TWILIO_ACCOUNT_SID   - Twilio account SID (starts AC...)
//   TWILIO_AUTH_TOKEN    - Twilio auth token
//   TWILIO_FROM_NUMBER   - Your Twilio SMS-capable number, E.164 format
//   ADMIN_PHONE          - The admin's mobile, E.164 format, for 2FA codes

const BASE = 'https://api.twilio.com/2010-04-01';

function smsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

export async function sendSms({ to, body }) {
  if (!smsConfigured()) {
    throw new Error('sms_not_configured');
  }
  if (!to || !body) throw new Error('to and body required');

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  const params = new URLSearchParams({ To: to, From: from, Body: body });

  const res = await fetch(`${BASE}/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`twilio ${res.status}: ${msg.slice(0, 200)}`);
  }
  return res.json();
}

export function isSmsConfigured() {
  return smsConfigured();
}

// Format a UK number to E.164 (+44...). Accepts a string in any
// common form: "07477 911190", "07477911190", "+447477911190".
export function formatUkPhone(raw) {
  if (!raw) return null;
  let n = String(raw).replace(/[^0-9+]/g, '');
  if (n.startsWith('+')) return n;
  if (n.startsWith('00')) return '+' + n.slice(2);
  if (n.startsWith('44')) return '+' + n;
  if (n.startsWith('0')) return '+44' + n.slice(1);
  return '+44' + n;
}
