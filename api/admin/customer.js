// Manually create a quote / lead from the admin area.
// Same shape as a public submission, tagged source="manual-admin".

import { requireAuthWithBranch, actorName } from './_session.js';
import { appendNote, logActivity } from './_db.js';

export default async function handler(req, res) {
  const auth = requireAuthWithBranch(req, res);
  if (!auth) return;
  const { branchSource } = auth;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const {
    name, email, phone, service,
    move_from, move_to, move_date, property, message, value,
  } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
  if (!phone && !email) return res.status(400).json({ error: 'phone or email required' });

  try {
    const payload = {
      name: name.trim(),
      email: (email || '').trim() || null,
      phone: (phone || '').trim() || null,
      service: service || null,
      move_from: move_from || null,
      move_to: move_to || null,
      move_date: move_date || null,
      property: property || null,
      message: message || null,
      // Branch-created leads carry the branch tag so they appear in (and only
      // in) that branch's scoped dashboard.
      source: branchSource || 'manual-admin',
      status: 'new',
      created_at: new Date().toISOString(),
    };
    if (value !== undefined && value !== null && value !== '') {
      const v = Number(value);
      if (!isNaN(v) && v >= 0) payload.value = v;
    }

    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/relokates_quote_request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(500).json({ error: `supabase: ${text.slice(0, 200)}` });
    }
    const rows = await r.json();
    const created = rows[0] || null;
    if (created && created.id != null) {
      const actor = actorName(req);
      try {
        await appendNote(created.id, `Added by ${actor}`);
        await logActivity({ actor, action: 'added', lead_id: created.id, lead_name: created.name, detail: 'manual entry' });
      } catch (_) { /* non-fatal */ }
    }
    return res.status(200).json({ ok: true, quote: created });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
