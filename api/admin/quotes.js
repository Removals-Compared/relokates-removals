import { requireAuth, actorName, verifySession } from './_session.js';
import { listQuotes, fetchPendingReminders, getQuote, updateQuote, appendNote, logActivity } from './_db.js';

// ── Franchise branch flow ────────────────────────────────────────────────
// Branch sessions (e.g. Birmingham) share this function (Hobby plan caps the
// project at 12 serverless functions) but run a fully separate, scoped flow:
// they can ONLY list and update leads whose source matches their own branch
// tag, and never reach the head-office flow below.
const BRANCH_ALLOWED_STATUS = ['new', 'contacted', 'quote_sent', 'survey_booked', 'move_booked', 'won', 'lost'];
const branchSource = (slug) => `relokates.co.uk/${slug}`;
const prettyBranch = (slug) => slug.charAt(0).toUpperCase() + slug.slice(1);

async function branchHandler(req, res, branch) {
  const source = branchSource(branch);
  const actor = `${prettyBranch(branch)} branch`;
  try {
    if (req.method === 'GET') {
      const rows = await listQuotes({ status: req.query.status, search: req.query.search, source });
      // Belt and braces: never return a row that isn't this branch's.
      const quotes = rows.filter((q) => q.source === source);
      return res.status(200).json({ quotes, branch, display_name: `${prettyBranch(branch)} (Richard Jones)` });
    }
    if (req.method === 'PATCH') {
      const { id, status } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      if (!BRANCH_ALLOWED_STATUS.includes(status)) return res.status(400).json({ error: 'invalid status' });
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

// ── Head-office flow ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Branch sessions divert to their scoped flow before requireAuth (which
  // rejects the branch role everywhere else).
  if (verifySession(req) === 'branch' && req._branchName) {
    return branchHandler(req, res, req._branchName);
  }

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
