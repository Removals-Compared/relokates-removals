import { requireAuth } from '../_session.js';
import { getQuote, updateQuote, deleteQuote } from '../_db.js';

const ALLOWED_STATUS = ['new', 'contacted', 'survey_booked', 'move_booked', 'quote_sent', 'won', 'lost'];
const EDITABLE_TEXT_FIELDS = ['name', 'phone', 'email', 'service', 'move_from', 'move_to', 'move_date', 'property', 'message'];

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
    if (req.method === 'DELETE') {
      await deleteQuote(id);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'PATCH') {
      const body = req.body || {};
      const { status, value } = body;
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
      for (const field of EDITABLE_TEXT_FIELDS) {
        if (body[field] === undefined) continue;
        const raw = body[field];
        if (raw === null || raw === '') {
          patch[field] = null;
          continue;
        }
        const s = String(raw).trim();
        if (s.length > 2000) {
          return res.status(400).json({ error: `${field} too long` });
        }
        if (field === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) {
          return res.status(400).json({ error: 'invalid email' });
        }
        patch[field] = s;
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
