import { requireAuth } from './_session.js';
import { appendNote } from './_db.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { lead_id, text } = req.body || {};
  if (!lead_id) return res.status(400).json({ error: 'lead_id required' });
  if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
  try {
    const quote = await appendNote(lead_id, text.trim());
    return res.status(200).json({ quote });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
