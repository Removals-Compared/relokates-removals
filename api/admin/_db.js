// Supabase REST wrapper for admin endpoints.
// Reuses the same SUPABASE_URL + SUPABASE_KEY env vars as api/quote.js.
//
// Defensive design: every read fetches the quote first, then tries to
// join in appointments separately. If the appointments table doesn't
// exist yet (schema not fully applied), the page still works - the
// appointment list just shows empty.

const QUOTES = 'relokates_quote_request';
const APPTS = 'relokates_appointments';
const REMINDERS = 'reminders';
const ACT = 'activity_log';

function url(path) {
  return `${process.env.SUPABASE_URL}/rest/v1/${path}`;
}
function headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
    ...extra,
  };
}

async function fetchAppointmentsByLeadIds(leadIds) {
  if (!leadIds.length) return {};
  try {
    const ids = leadIds.join(',');
    const r = await fetch(`${url(APPTS)}?lead_id=in.(${ids})&select=*`, { headers: headers() });
    if (!r.ok) return {};
    const rows = await r.json();
    const byLead = {};
    rows.forEach(a => {
      if (!byLead[a.lead_id]) byLead[a.lead_id] = [];
      byLead[a.lead_id].push(a);
    });
    return byLead;
  } catch (_) {
    return {};
  }
}

export async function listQuotes({ status, search, limit = 200 } = {}) {
  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('order', 'created_at.desc');
  params.set('limit', String(limit));
  // An explicit status filter (incl. 'deleted' for the recycle bin) wins;
  // otherwise hide soft-deleted leads from the normal lists.
  if (status && status !== 'all') params.set('status', `eq.${status}`);
  else params.set('status', 'neq.deleted');
  if (search && search.trim()) {
    // PostgREST ilike uses * as the wildcard (not %). Strip characters that
    // are significant in the or() filter so the query can't be broken.
    // URLSearchParams handles the encoding - don't pre-encode here.
    const t = search.replace(/[(),*%]/g, ' ').trim();
    if (t) params.set('or', `(name.ilike.*${t}*,email.ilike.*${t}*,phone.ilike.*${t}*)`);
  }
  const res = await fetch(`${url(QUOTES)}?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`supabase listQuotes ${res.status}`);
  const quotes = await res.json();

  // Attach appointments per lead, tolerating missing table.
  const apptsByLead = await fetchAppointmentsByLeadIds(quotes.map(q => q.id));
  quotes.forEach(q => { q.relokates_appointments = apptsByLead[q.id] || []; });
  return quotes;
}

export async function getQuote(id) {
  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('id', `eq.${id}`);
  params.set('limit', '1');
  const res = await fetch(`${url(QUOTES)}?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`supabase getQuote ${res.status}`);
  const rows = await res.json();
  const quote = rows[0] || null;
  if (!quote) return null;

  const apptsByLead = await fetchAppointmentsByLeadIds([quote.id]);
  quote.relokates_appointments = apptsByLead[quote.id] || [];
  return quote;
}

export async function updateQuote(id, patch) {
  const res = await fetch(`${url(QUOTES)}?id=eq.${id}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`supabase updateQuote ${res.status}`);
  const rows = await res.json();
  return rows[0] || null;
}

export async function appendNote(id, text) {
  const quote = await getQuote(id);
  if (!quote) throw new Error('not_found');
  const notes = Array.isArray(quote.notes) ? quote.notes : [];
  notes.push({ at: new Date().toISOString(), text });
  return updateQuote(id, { notes });
}

export async function createAppointment(row) {
  const res = await fetch(url(APPTS), {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`supabase createAppointment ${res.status}: ${msg.slice(0, 200)}`);
  }
  const rows = await res.json();
  return rows[0] || null;
}

export async function updateAppointment(id, patch) {
  const res = await fetch(`${url(APPTS)}?id=eq.${id}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`supabase updateAppointment ${res.status}`);
  const rows = await res.json();
  return rows[0] || null;
}

// Delete a quote and any related appointments. Tolerates the
// appointments table not existing.
export async function deleteQuote(id) {
  // First delete any appointments tied to this lead. If the table
  // doesn't exist or the request errors, swallow it - we still
  // want the quote deletion to proceed.
  try {
    await fetch(`${url(APPTS)}?lead_id=eq.${id}`, {
      method: 'DELETE',
      headers: headers({ Prefer: 'return=minimal' }),
    });
  } catch (_) { /* non-fatal */ }

  const res = await fetch(`${url(QUOTES)}?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers({ Prefer: 'return=minimal' }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`supabase deleteQuote ${res.status}: ${msg.slice(0, 200)}`);
  }
  return { ok: true };
}

// ── Call reminders ──────────────────────────────────────────
// Backed by the `reminders` table (see admin/SUPABASE-SCHEMA.sql). All read
// helpers swallow errors so the dashboard/lead page still load on a fresh
// schema where the table does not exist yet.

export async function createReminder(row) {
  const res = await fetch(url(REMINDERS), {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`supabase createReminder ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rows = await res.json();
  return rows[0] || null;
}

export async function updateReminder(id, patch) {
  const res = await fetch(`${url(REMINDERS)}?id=eq.${id}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`supabase updateReminder ${res.status}`);
  const rows = await res.json();
  return rows[0] || null;
}

export async function fetchReminder(id) {
  const res = await fetch(`${url(REMINDERS)}?id=eq.${id}&select=*&limit=1`, { headers: headers() });
  if (!res.ok) throw new Error(`supabase fetchReminder ${res.status}`);
  const rows = await res.json();
  return rows[0] || null;
}

export async function deleteReminder(id) {
  const res = await fetch(`${url(REMINDERS)}?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers({ Prefer: 'return=minimal' }),
  });
  if (!res.ok) throw new Error(`supabase deleteReminder ${res.status}`);
  return { ok: true };
}

// Reminders for one or more leads (for the lead page). Tolerates a missing table.
export async function fetchRemindersByLeadIds(ids) {
  try {
    const list = (ids || []).map(i => Number(i)).filter(n => !Number.isNaN(n)).join(',');
    if (!list) return [];
    const res = await fetch(`${url(REMINDERS)}?lead_id=in.(${list})&select=*&order=remind_on.asc`, { headers: headers() });
    if (!res.ok) return [];
    return res.json();
  } catch (_) {
    return [];
  }
}

// All un-sent reminders, earliest first (for the dashboard call-back chips).
// Tolerates a missing table so the dashboard still loads on a fresh schema.
export async function fetchPendingReminders() {
  try {
    const res = await fetch(`${url(REMINDERS)}?sent=eq.false&select=lead_id,remind_on,remind_time,note&order=remind_on.asc`, { headers: headers() });
    if (!res.ok) return [];
    return res.json();
  } catch (_) {
    return [];
  }
}

// Reminders due on/before `today` (YYYY-MM-DD) that haven't been sent - for the
// daily cron backup. Tolerates a missing table.
export async function fetchDueReminders(today) {
  try {
    const res = await fetch(`${url(REMINDERS)}?sent=eq.false&remind_on=lte.${today}&select=*&order=remind_on.asc`, { headers: headers() });
    if (!res.ok) return [];
    return res.json();
  } catch (_) {
    return [];
  }
}

export async function markReminderSent(id) {
  try {
    await fetch(`${url(REMINDERS)}?id=eq.${id}`, {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ sent: true, sent_at: new Date().toISOString() }),
    });
  } catch (_) { /* non-fatal */ }
}

// ── Team activity log ───────────────────────────────────────
// Structured audit feed (activity_log table). Best-effort: never throws, so a
// missing table can't break the action that triggered it.
export async function logActivity({ actor, action, lead_id, lead_name, detail } = {}) {
  try {
    await fetch(url(ACT), {
      method: 'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        actor: actor || 'unknown',
        action: action || '',
        lead_id: lead_id != null ? String(lead_id) : null,
        lead_name: lead_name || '',
        detail: detail || '',
      }),
    });
  } catch (_) { /* non-fatal */ }
}

export async function fetchActivity(limit = 30) {
  try {
    const res = await fetch(`${url(ACT)}?select=*&order=at.desc&limit=${limit}`, { headers: headers() });
    if (!res.ok) return [];
    return res.json();
  } catch (_) {
    return [];
  }
}

// ── Recycle bin purge ───────────────────────────────────────
// Soft-deleted leads older than `days` (by updated_at), for the daily cron.
export async function fetchExpiredDeleted(days = 30) {
  try {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const res = await fetch(`${url(QUOTES)}?status=eq.deleted&updated_at=lt.${cutoff}&select=id,name`, { headers: headers() });
    if (!res.ok) return [];
    return res.json();
  } catch (_) {
    return [];
  }
}

// ── Duplicate detection ─────────────────────────────────────
// Other non-deleted leads sharing this phone or email. Tolerates errors.
export async function fetchDuplicates(id, phone, email) {
  try {
    const or = [];
    if (phone) or.push(`phone.eq.${encodeURIComponent(String(phone).trim())}`);
    if (email) or.push(`email.eq.${encodeURIComponent(String(email).trim().toLowerCase())}`);
    if (!or.length) return [];
    const res = await fetch(
      `${url(QUOTES)}?or=(${or.join(',')})&id=neq.${id}&status=neq.deleted&select=id,name,status,created_at&limit=5`,
      { headers: headers() });
    if (!res.ok) return [];
    return res.json();
  } catch (_) {
    return [];
  }
}

// ── Booking-conflict detection ──────────────────────────────
// Move appointments on the same calendar day as dayISO (YYYY-MM-DD),
// excluding the given lead. Tolerates a missing appointments table.
export async function fetchMovesOnDate(dayISO, excludeLeadId) {
  try {
    if (!dayISO) return [];
    const start = new Date(dayISO + 'T00:00:00.000Z').toISOString();
    const end = new Date(new Date(dayISO + 'T00:00:00.000Z').getTime() + 86400000).toISOString();
    let q = `${url(APPTS)}?type=eq.move&scheduled_for=gte.${start}&scheduled_for=lt.${end}&select=lead_id,scheduled_for`;
    if (excludeLeadId != null) q += `&lead_id=neq.${excludeLeadId}`;
    const res = await fetch(q, { headers: headers() });
    if (!res.ok) return [];
    return res.json();
  } catch (_) {
    return [];
  }
}
