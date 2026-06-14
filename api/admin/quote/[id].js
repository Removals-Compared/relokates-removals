import { requireAuth } from '../_session.js';
import { getQuote, updateQuote } from '../_db.js';

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
      const { status } = req.body || {};
      const patch = {};
      if (status) patch.status = status;
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'no fields to update' });
      const updated = await updateQuote(id, patch);
      return res.status(200).json({ quote: updated });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
