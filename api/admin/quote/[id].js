import { requireAuth } from '../_session.js';
import { getQuote, updateQuote } from '../_db.js';

const ALLOWED_STATUS = ['new', 'contacted', 'survey_booked', 'move_booked', 'won', 'lost'];

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  try {
    if (req.method === 'GET') {
      const quote = await getQuote(id);
      if (!quote) return res.status(404).json({ error: 'not found' });
      return res.status(200).json({ quote });
    }
    if (req.method === 'PATCH') {
      const { status, value } = req.body || {};
      const patch = {};
      if (status !== undefined) {
        if (!ALLOWED_STATUS.includes(status)) {
          return res.status(400).json({ error: 'invalid status' });
        }
        patch.status = status;
      }
      if (value !== undefined) {
        const n = value === null || value === '' ? null : Number(value);
        if (n !== null && (isNaN(n) || n < 0)) {
          return res.status(400).json({ error: 'invalid value' });
        }
        patch.value = n;
      }
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'no fields to update' });
      const updated = await updateQuote(id, patch);
      return res.status(200).json({ quote: updated });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
