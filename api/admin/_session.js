// Shared session/auth helpers for /api/admin/* endpoints.
// Uses HMAC-signed cookies - no JWT library needed.
import crypto from 'node:crypto';

const COOKIE = 'rlk_admin';
const MAX_AGE = 60 * 60 * 24 * 7;  // 7 days

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function setSessionCookie(res) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET not set');
  const issued = Date.now().toString();
  const sig = sign(issued, secret);
  const cookie = `${COOKIE}=${issued}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
  res.setHeader('Set-Cookie', cookie);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function isAuthenticated(req) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const raw = req.headers.cookie || '';
  const pairs = raw.split(/;\s*/).map(p => p.split('='));
  const found = pairs.find(p => p[0] === COOKIE);
  if (!found) return false;
  const [issuedStr, providedSig] = (found[1] || '').split('.');
  if (!issuedStr || !providedSig) return false;
  const expectedSig = sign(issuedStr, secret);
  // Constant-time comparison so we don't leak timing info.
  if (expectedSig.length !== providedSig.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(providedSig))) return false;
  // Expiry check (defence-in-depth on top of cookie Max-Age).
  const ageSeconds = (Date.now() - Number(issuedStr)) / 1000;
  if (ageSeconds > MAX_AGE) return false;
  return true;
}

export function requireAuth(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}
