import { requireAuth } from './_session.js';
import { listQuotes, fetchPendingReminders } from './_db.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try {
    const status = req.query.status;
    const search = req.query.search;
    const rows = await listQuotes({ status, search });
    // Attach the earliest pending reminder to each lead for the callback chip.
    const pending = await fetchPendingReminders();
    const map = {};
    for (const p of pending) { if (!map[p.lead_id]) map[p.lead_id] = p; }
    rows.forEach((q) => { if (map[q.id]) q.reminder = map[q.id]; });
    return res.status(200).json({ quotes: rows });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
