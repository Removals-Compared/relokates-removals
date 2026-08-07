import { requireAuth } from './_session.js';
import { fetchActivity } from './_db.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const activity = await fetchActivity(limit);
  return res.status(200).json({ activity });
}
