// Franchise branch dashboard API.
// A branch session (e.g. Birmingham) can ONLY list and update leads whose
// source matches its own branch tag - it never sees head-office data. A
// head-office admin session may also read a branch's view (?branch=slug).
import { requireBranchAuth } from './_session.js';
import { listQuotes, getQuote, updateQuote, appendNote, logActivity } from './_db.js';

const ALLOWED_STATUS = ['new', 'contacted', 'quote_sent', 'survey_booked', 'move_booked', 'won', 'lost'];

const branchSource = (slug) => `relokates.co.uk/${slug}`;
const pretty = (slug) => slug.charAt(0).toUpperCase() + slug.slice(1);

export default async function handler(req, res) {
  const branch = requireBranchAuth(req, res);
  if (!branch) return;
  const source = branchSource(branch);
  const actor = `${pretty(branch)} branch`;

  try {
    if (req.method === 'GET') {
      const rows = await listQuotes({
        status: req.query.status,
        search: req.query.search,
        source,
      });
      // Belt and braces: never return a row that isn't this branch's.
      const quotes = rows.filter((q) => q.source === source);
      return res.status(200).json({ quotes, branch, display_name: `${pretty(branch)} (Richard Jones)` });
    }

    if (req.method === 'PATCH') {
      const { id, status } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      if (!ALLOWED_STATUS.includes(status)) return res.status(400).json({ error: 'invalid status' });

      // The lead must belong to this branch before any write happens.
      const quote = await getQuote(id);
      if (!quote || quote.source !== source) return res.status(404).json({ error: 'not found' });

      const updated = await updateQuote(id, { status });
      await appendNote(id, `Status changed to ${status} by ${actor}`);
      await logActivity({ actor, action: 'changed status', lead_id: id, lead_name: quote.name, detail: `to ${status}` });
      return res.status(200).json({ quote: updated });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
