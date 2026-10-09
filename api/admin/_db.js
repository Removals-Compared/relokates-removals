// Neon Postgres data layer for admin endpoints.
// Same exported functions and row shapes as the old Supabase REST wrapper.
//
// Defensive design: every read fetches the quote first, then tries to
// join in appointments separately. If the appointments table doesn't
// exist yet (schema not fully applied), the page still works - the
// appointment list just shows empty.
import { q, insertRow, updateById } from './_sql.js';

const QUOTES = 'relokates_quote_request';
const APPTS = 'relokates_appointments';
const REMINDERS = 'reminders';
const ACT = 'activity_log';

async function fetchAppointmentsByLeadIds(leadIds) {
  if (!leadIds.length) return {};
  try {
    const rows = await q(`SELECT * FROM ${APPTS} WHERE lead_id = ANY($1::bigint[])`, [leadIds.map(Number)]);
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

export async function listQuotes({ status, search, source, limit = 200 } = {}) {
  const where = [];
  const params = [];
  // Branch dashboards only ever see leads tagged with their own source.
  if (source) { params.push(source); where.push(`source = $${params.length}`); }
  // An explicit status filter (incl. 'deleted' for the recycle bin) wins;
  // otherwise hide soft-deleted leads from the normal lists.
  if (status && status !== 'all') { params.push(status); where.push(`status = $${params.length}`); }
  else where.push(`status IS DISTINCT FROM 'deleted'`);
  if (search && search.trim()) {
    const t = search.replace(/[%_\\]/g, ' ').trim();
    if (t) {
      params.push(`%${t}%`);
      const n = params.length;
      where.push(`(name ILIKE $${n} OR email ILIKE $${n} OR phone ILIKE $${n})`);
    }
  }
  params.push(Number(limit) || 200);
  const quotes = await q(
    `SELECT * FROM ${QUOTES} WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );

  // Attach appointments per lead, tolerating missing table.
  const apptsByLead = await fetchAppointmentsByLeadIds(quotes.map(q => q.id));
  quotes.forEach(q => { q.relokates_appointments = apptsByLead[q.id] || []; });
  return quotes;
}

export async function getQuote(id) {
  const rows = await q(`SELECT * FROM ${QUOTES} WHERE id = $1 LIMIT 1`, [id]);
  const quote = rows[0] || null;
  if (!quote) return null;

  const apptsByLead = await fetchAppointmentsByLeadIds([quote.id]);
  quote.relokates_appointments = apptsByLead[quote.id] || [];
  return quote;
}

export async function updateQuote(id, patch) {
  return updateById(QUOTES, id, { ...patch, updated_at: new Date().toISOString() });
}

// Insert a lead (admin "+ Add customer"); returns the created row.
export async function createQuote(row) {
  return insertRow(QUOTES, row);
}

export async function appendNote(id, text) {
  const quote = await getQuote(id);
  if (!quote) throw new Error('not_found');
  const notes = Array.isArray(quote.notes) ? quote.notes : [];
  notes.push({ at: new Date().toISOString(), text });
  return updateQuote(id, { notes });
}

export const createAppointment = (row) => insertRow(APPTS, row);
export const updateAppointment = (id, patch) => updateById(APPTS, id, patch);

// Delete a quote and any related appointments. Tolerates the
// appointments table not existing.
export async function deleteQuote(id) {
  // First delete any appointments tied to this lead. If the table
  // doesn't exist or the request errors, swallow it - we still
  // want the quote deletion to proceed.
  try {
    await q(`DELETE FROM ${APPTS} WHERE lead_id = $1`, [id]);
  } catch (_) { /* non-fatal */ }

  await q(`DELETE FROM ${QUOTES} WHERE id = $1`, [id]);
  return { ok: true };
}

// ── Call reminders ──────────────────────────────────────────
// Backed by the `reminders` table (see admin/SCHEMA.sql). All read
// helpers swallow errors so the dashboard/lead page still load on a fresh
// schema where the table does not exist yet.

export const createReminder = (row) => insertRow(REMINDERS, row);
export const updateReminder = (id, patch) => updateById(REMINDERS, id, patch);

export async function fetchReminder(id) {
  const rows = await q(`SELECT * FROM ${REMINDERS} WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] || null;
}

export async function deleteReminder(id) {
  await q(`DELETE FROM ${REMINDERS} WHERE id = $1`, [id]);
  return { ok: true };
}

// Reminders for one or more leads (for the lead page). Tolerates a missing table.
export async function fetchRemindersByLeadIds(ids) {
  try {
    const list = (ids || []).map(i => Number(i)).filter(n => !Number.isNaN(n));
    if (!list.length) return [];
    return await q(`SELECT * FROM ${REMINDERS} WHERE lead_id = ANY($1::bigint[]) ORDER BY remind_on ASC`, [list]);
  } catch (_) {
    return [];
  }
}

// All un-sent reminders, earliest first (for the dashboard call-back chips).
// Tolerates a missing table so the dashboard still loads on a fresh schema.
export async function fetchPendingReminders() {
  try {
    return await q(`SELECT lead_id, remind_on, remind_time, note FROM ${REMINDERS} WHERE sent = false ORDER BY remind_on ASC`);
  } catch (_) {
    return [];
  }
}

// Reminders due on/before `today` (YYYY-MM-DD) that haven't been sent - for the
// daily cron backup. Tolerates a missing table.
export async function fetchDueReminders(today) {
  try {
    return await q(`SELECT * FROM ${REMINDERS} WHERE sent = false AND remind_on <= $1 ORDER BY remind_on ASC`, [today]);
  } catch (_) {
    return [];
  }
}

export async function markReminderSent(id) {
  try {
    await q(`UPDATE ${REMINDERS} SET sent = true, sent_at = $2 WHERE id = $1`, [id, new Date().toISOString()]);
  } catch (_) { /* non-fatal */ }
}

// ── Team activity log ───────────────────────────────────────
// Structured audit feed (activity_log table). Best-effort: never throws, so a
// missing table can't break the action that triggered it.
export async function logActivity({ actor, action, lead_id, lead_name, detail } = {}) {
  try {
    await q(
      `INSERT INTO ${ACT} (actor, action, lead_id, lead_name, detail) VALUES ($1, $2, $3, $4, $5)`,
      [actor || 'unknown', action || '', lead_id != null ? String(lead_id) : null, lead_name || '', detail || ''],
    );
  } catch (_) { /* non-fatal */ }
}

export async function fetchActivity(limit = 30) {
  try {
    return await q(`SELECT * FROM ${ACT} ORDER BY at DESC LIMIT $1`, [Number(limit) || 30]);
  } catch (_) {
    return [];
  }
}

// ── Recycle bin purge ───────────────────────────────────────
// Soft-deleted leads older than `days` (by updated_at), for the daily cron.
export async function fetchExpiredDeleted(days = 30) {
  try {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    return await q(`SELECT id, name FROM ${QUOTES} WHERE status = 'deleted' AND updated_at < $1`, [cutoff]);
  } catch (_) {
    return [];
  }
}

// ── Duplicate detection ─────────────────────────────────────
// Other non-deleted leads sharing this phone or email. Tolerates errors.
export async function fetchDuplicates(id, phone, email, source) {
  try {
    const params = [id];
    const or = [];
    if (phone) { params.push(String(phone).trim()); or.push(`phone = $${params.length}`); }
    if (email) { params.push(String(email).trim().toLowerCase()); or.push(`email = $${params.length}`); }
    if (!or.length) return [];
    // Branch sessions only see duplicates among their own branch's leads -
    // head-office customer names must never surface in a branch view.
    let scope = '';
    if (source) { params.push(source); scope = ` AND source = $${params.length}`; }
    return await q(
      `SELECT id, name, status, created_at FROM ${QUOTES}
       WHERE (${or.join(' OR ')}) AND id <> $1 AND status IS DISTINCT FROM 'deleted'${scope} LIMIT 5`,
      params,
    );
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
    const params = [start, end];
    let extra = '';
    if (excludeLeadId != null) { params.push(excludeLeadId); extra = ` AND lead_id <> $${params.length}`; }
    return await q(
      `SELECT lead_id, scheduled_for FROM ${APPTS} WHERE type = 'move' AND scheduled_for >= $1 AND scheduled_for < $2${extra}`,
      params,
    );
  } catch (_) {
    return [];
  }
}
