// Step 1 of 2FA login: verify password, generate 6-digit code,
// SMS to ADMIN_PHONE, return an attempt_id the client uses on
// step 2.
//
// If TWILIO_ACCOUNT_SID is unset, 2FA is bypassed (the cookie is
// set immediately so the admin can still sign in - useful for
// initial setup before Twilio is configured).

import crypto from 'node:crypto';
import { setSessionCookie, clearSessionCookie } from './_session.js';
import { sendSms, isSmsConfigured, formatUkPhone } from './_sms.js';

const CODE_TTL_SECONDS = 300;  // 5 minutes

function url(path) { return `${process.env.SUPABASE_URL}/rest/v1/${path}`; }
function sbHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
    ...extra,
  };
}

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { password } = req.body || {};
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(500).json({ error: 'ADMIN_PASSWORD not configured' });

  const pHash = crypto.createHash('sha256').update(String(password || '')).digest();
  const eHash = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(pHash, eHash)) {
    return res.status(401).json({ error: 'invalid password' });
  }

  // If Twilio + ADMIN_PHONE are not configured, fall back to one-step login.
  if (!isSmsConfigured() || !process.env.ADMIN_PHONE) {
    setSessionCookie(res);
    return res.status(200).json({ ok: true, twofa: false });
  }

  // Generate 6-digit code. Use crypto.randomInt for unbiased range.
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const attemptId = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();

  // Store in Supabase.
  try {
    const sbRes = await fetch(url('relokates_login_codes'), {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        code_hash: codeHash,
        attempt_id: attemptId,
        expires_at: expiresAt,
        ip: req.headers['x-forwarded-for'] || null,
      }),
    });
    if (!sbRes.ok) {
      return res.status(500).json({ error: `supabase: ${await sbRes.text()}` });
    }
  } catch (e) {
    return res.status(500).json({ error: `supabase: ${e.message}` });
  }

  // SMS the code.
  try {
    const adminPhone = formatUkPhone(process.env.ADMIN_PHONE);
    await sendSms({
      to: adminPhone,
      body: `Relokates admin code: ${code}. Valid for 5 minutes. If you did not request this, change your admin password.`,
    });
  } catch (e) {
    return res.status(500).json({ error: `sms: ${e.message}` });
  }

  return res.status(200).json({
    ok: true,
    twofa: true,
    attempt_id: attemptId,
    expires_in: CODE_TTL_SECONDS,
  });
}
