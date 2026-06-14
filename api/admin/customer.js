// Manually create a quote / lead from the admin area.
// Same shape as a public form submission, but tagged with
// source = "manual-admin" so we can tell the two apart later.

import { requireAuth } from './_session.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const {
    name, email, phone, service,
    move_from, move_to, move_date, property, message,
  } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
  if (!phone && !email) return res.status(400).json({ error: 'phone or email required' });

  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/relokates_quote_request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        name: name.trim(),
        email: (email || '').trim() || null,
        phone: (phone || '').trim() || null,
        service: service || null,
        move_from: move_from || null,
        move_to: move_to || null,
        move_date: move_date || null,
        property: property || null,
        message: message || null,
        source: 'manual-admin',
        status: 'new',
        created_at: new Date().toISOString(),
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(500).json({ error: `supabase: ${text.slice(0, 200)}` });
    }
    const rows = await r.json();
    return res.status(200).json({ ok: true, quote: rows[0] || null });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
