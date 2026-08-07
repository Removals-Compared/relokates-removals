import { requireAuth, actorName } from './_session.js';
import { listQuotes, fetchPendingReminders } from './_db.js';

export default async function handler(req, res) {
  const role = requireAuth(req, res);
  if (!role) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try {
    const status = req.query.status;
    const search = req.query.search;

    // Staff never see the recycle bin.
    if (status === 'deleted' && role === 'staff') {
      return res.status(200).json({ quotes: [], role, display_name: actorName(req) });
    }

    const rows = await listQuotes({ status, search });

    // Attach the earliest pending reminder to each lead for the callback chip.
    const pending = await fetchPendingReminders();
    const map = {};
    for (const p of pending) { if (!map[p.lead_id]) map[p.lead_id] = p; }
    rows.forEach((q) => { if (map[q.id]) q.reminder = map[q.id]; });

    // Staff never see money.
    if (role === 'staff') rows.forEach((q) => { delete q.value; });

    return res.status(200).json({
      quotes: rows,
      role,
      staff_name: req._staffName || undefined,
      display_name: actorName(req),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
