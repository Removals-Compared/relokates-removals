import { setSessionCookie, clearSessionCookie, checkPassword } from './_session.js';

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD not configured' });

  const { password } = req.body || {};
  const acct = checkPassword(password);
  if (!acct) return res.status(401).json({ error: 'invalid password' });

  setSessionCookie(res, acct.role, acct.name);
  return res.status(200).json({ ok: true, role: acct.role });
}
