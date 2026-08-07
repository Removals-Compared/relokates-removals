// Shared session/auth helpers for /api/admin/* endpoints.
// HMAC-signed cookies - no JWT library needed.
//
// Roles: "admin" (full access) or "staff" (no money shown). Staff cookies also
// carry the staff member's name so each login is personal and audit entries can
// be attributed. Older two-part cookies (issued before roles existed) still
// verify as admin, so existing sessions keep working.
import crypto from 'node:crypto';

const COOKIE = 'rlk_admin';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function sign(value) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
const b64u = (s) => Buffer.from(String(s), 'utf8').toString('base64url');
const unb64u = (s) => { try { return Buffer.from(String(s), 'base64url').toString('utf8'); } catch { return ''; } };

// role: "admin" | "staff". name only used for staff.
export function setSessionCookie(res, role = 'admin', name = '') {
  if (!process.env.ADMIN_SESSION_SECRET) throw new Error('ADMIN_SESSION_SECRET not set');
  const ts = Date.now();
  const value = role === 'staff' && name
    ? `${ts}.staff.${b64u(name)}.${sign(ts + '.staff.' + b64u(name))}`
    : `${ts}.${role}.${sign(ts + '.' + role)}`;
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function readCookie(req) {
  const raw = req.headers.cookie || '';
  const found = raw.split(/;\s*/).map(p => p.split('=')).find(p => p[0] === COOKIE);
  return found ? decodeURIComponent(found[1] || '') : '';
}

// Returns the role string ("admin" | "staff") or false. Stashes the staff
// member's name on req._staffName for personalised responses/audit.
export function verifySession(req) {
  if (!process.env.ADMIN_SESSION_SECRET) return false;
  const raw = readCookie(req);
  if (!raw) return false;
  const parts = raw.split('.');
  if (parts.length === 4) {
    const [ts, role, nameB64, mac] = parts;
    if (role !== 'staff') return false;
    if (!safeEqual(mac, sign(ts + '.staff.' + nameB64))) return false;
    if ((Date.now() - Number(ts)) / 1000 > MAX_AGE) return false;
    req._staffName = unb64u(nameB64);
    return 'staff';
  }
  if (parts.length === 3) {
    const [ts, role, mac] = parts;
    if (!['admin', 'staff'].includes(role)) return false;
    if (!safeEqual(mac, sign(ts + '.' + role))) return false;
    if ((Date.now() - Number(ts)) / 1000 > MAX_AGE) return false;
    return role;
  }
  if (parts.length === 2) {
    const [ts, mac] = parts;
    if (!safeEqual(mac, sign(ts))) return false;
    if ((Date.now() - Number(ts)) / 1000 > MAX_AGE) return false;
    return 'admin';
  }
  return false;
}

export function isAuthenticated(req) {
  return verifySession(req) !== false;
}

// Truthy return is the role string, so existing
// `if (!requireAuth(req, res)) return;` call sites keep working.
export function requireAuth(req, res) {
  const role = verifySession(req);
  if (!role) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return role;
}

// Admin display name (used as the actor for audit + the identity chip).
export function adminName() {
  return process.env.ADMIN_NAME || 'Amos Osho';
}

// Who is acting: staff member's name, else the admin name.
export function actorName(req) {
  return req._staffName || adminName();
}

// Staff accounts from STAFF_ACCOUNTS: "Name:password;Name:password".
// Single STAFF_PASS (+ STAFF_NAME) still works as a fallback.
function staffAccounts() {
  const out = [];
  (process.env.STAFF_ACCOUNTS || '').split(';').forEach((pair) => {
    const i = pair.indexOf(':');
    if (i > 0) out.push({ name: pair.slice(0, i).trim(), pass: pair.slice(i + 1) });
  });
  if (process.env.STAFF_PASS) out.push({ name: process.env.STAFF_NAME || 'Staff', pass: process.env.STAFF_PASS });
  return out;
}

// Which account does this password belong to? { role, name } or false.
export function checkPassword(input) {
  const admin = process.env.ADMIN_PASSWORD || '';
  if (admin && safeEqual(input || '', admin)) return { role: 'admin', name: '' };
  for (const a of staffAccounts()) {
    if (a.pass && safeEqual(input || '', a.pass)) return { role: 'staff', name: a.name };
  }
  return false;
}
