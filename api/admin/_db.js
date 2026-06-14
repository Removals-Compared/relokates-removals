// Supabase REST wrapper for admin endpoints.
// Reuses the same SUPABASE_URL + SUPABASE_KEY env vars as api/quote.js.
//
// Defensive design: every read fetches the quote first, then tries to
// join in appointments separately. If the appointments table doesn't
// exist yet (schema not fully applied), the page still works - the
// appointment list just shows empty.

const QUOTES = 'relokates_quote_request';
const APPTS = 'relokates_appointments';

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
  if (status && status !== 'all') params.set('status', `eq.${status}`);
  if (search) {
    const q = encodeURIComponent(`%${search}%`);
    params.set('or', `(name.ilike.${q},email.ilike.${q},phone.ilike.${q})`);
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
