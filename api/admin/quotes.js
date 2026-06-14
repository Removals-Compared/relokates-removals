import { requireAuth } from './_session.js';
import { listQuotes } from './_db.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try {
    const status = req.query.status;
    const search = req.query.search;
    const rows = await listQuotes({ status, search });
    return res.status(200).json({ quotes: rows });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
