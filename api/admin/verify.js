// Step 2 of 2FA login: verify the 6-digit code, set the session cookie.

import crypto from 'node:crypto';
import { setSessionCookie } from './_session.js';

const MAX_ATTEMPTS = 5;

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { attempt_id, code } = req.body || {};
  if (!attempt_id || !code) return res.status(400).json({ error: 'attempt_id and code required' });

  // Fetch the row.
  let row;
  try {
    const r = await fetch(
      `${url('relokates_login_codes')}?attempt_id=eq.${encodeURIComponent(attempt_id)}&select=*&limit=1`,
      { headers: sbHeaders() },
    );
    if (!r.ok) return res.status(500).json({ error: 'lookup failed' });
    const rows = await r.json();
    row = rows[0];
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  if (!row) return res.status(404).json({ error: 'invalid code' });

  // Validate.
  if (row.used) return res.status(401).json({ error: 'code already used' });
  if (row.attempts >= MAX_ATTEMPTS) return res.status(401).json({ error: 'too many attempts' });
  if (new Date(row.expires_at) < new Date()) return res.status(401).json({ error: 'code expired' });

  const submitted = String(code).replace(/[^0-9]/g, '');
  const subHash = crypto.createHash('sha256').update(submitted).digest('hex');
  const stored = Buffer.from(row.code_hash, 'hex');
  const provided = Buffer.from(subHash, 'hex');
  const matches = stored.length === provided.length && crypto.timingSafeEqual(stored, provided);

  // Always bump attempts so brute-force is throttled.
  try {
    await fetch(`${url('relokates_login_codes')}?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(matches ? { used: true } : { attempts: (row.attempts || 0) + 1 }),
    });
  } catch (_) { /* non-fatal */ }

  if (!matches) return res.status(401).json({ error: 'invalid code' });

  setSessionCookie(res);
  return res.status(200).json({ ok: true });
}
