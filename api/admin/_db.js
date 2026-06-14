// Supabase REST wrapper for admin endpoints.
// Reuses the same SUPABASE_URL + SUPABASE_KEY env vars as api/quote.js.

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

export async function listQuotes({ status, search, limit = 200 } = {}) {
  const params = new URLSearchParams();
  params.set('select', '*,relokates_appointments(*)');
  params.set('order', 'created_at.desc');
  params.set('limit', String(limit));
  if (status && status !== 'all') params.set('status', `eq.${status}`);
  if (search) {
    const q = encodeURIComponent(`%${search}%`);
    params.set('or', `(name.ilike.${q},email.ilike.${q},phone.ilike.${q})`);
  }
  const res = await fetch(`${url(QUOTES)}?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`supabase listQuotes ${res.status}`);
  return res.json();
}

export async function getQuote(id) {
  const params = new URLSearchParams();
  params.set('select', '*,relokates_appointments(*)');
  params.set('id', `eq.${id}`);
  params.set('limit', '1');
  const res = await fetch(`${url(QUOTES)}?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`supabase getQuote ${res.status}`);
  const rows = await res.json();
  return rows[0] || null;
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
