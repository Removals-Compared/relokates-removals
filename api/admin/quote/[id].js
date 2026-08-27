import crypto from 'node:crypto';
import { requireAuth, actorName } from '../_session.js';
import {
  getQuote, updateQuote, deleteQuote, appendNote, logActivity,
  fetchRemindersByLeadIds, fetchDuplicates,
} from '../_db.js';
import { sendReviewRequest } from '../_review.js';
import { sendFollowup } from '../_followup.js';

const ALLOWED_STATUS = ['new', 'accepted', 'contacted', 'survey_booked', 'move_booked', 'quote_sent', 'prospecting', 'won', 'lost'];

// Same HMAC token the public /api/accept-quote endpoint verifies.
function acceptToken(id) {
  return crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || '')
    .update('accept.' + String(id)).digest('hex').slice(0, 32);
}
const EDITABLE_TEXT_FIELDS = ['name', 'phone', 'email', 'service', 'move_from', 'move_to', 'move_date', 'property', 'message'];
const REVIEW_MARK = 'Review request emailed';

function alreadyAskedReview(quote) {
  const notes = Array.isArray(quote.notes) ? quote.notes : [];
  return notes.some(n => String(n.text || '').includes(REVIEW_MARK));
}
function priorStatusFromNotes(quote) {
  const notes = Array.isArray(quote.notes) ? quote.notes : [];
  for (let i = notes.length - 1; i >= 0; i--) {
    const m = /^Deleted by .* \(was ([a-z_]+)\)$/.exec(String(notes[i].text || ''));
    if (m) return m[1];
  }
  return 'new';
}
const stripMoney = (q, role) => { if (q && role === 'staff') delete q.value; return q; };

export default async function handler(req, res) {
  const role = requireAuth(req, res);
  if (!role) return;
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  const actor = actorName(req);

  try {
    if (req.method === 'GET') {
      const quote = await getQuote(id);
      if (!quote) return res.status(404).json({ error: 'not found' });
      const reminders = await fetchRemindersByLeadIds([id]);
      const duplicates = await fetchDuplicates(id, quote.phone, quote.email);
      return res.status(200).json({
        quote: stripMoney(quote, role), reminders, duplicates,
        role, staff_name: req._staffName || undefined, display_name: actor,
        accept_token: role === 'staff' ? undefined : acceptToken(id),
      });
    }

    if (req.method === 'DELETE') {
      if (role === 'staff') return res.status(403).json({ error: 'staff cannot delete leads' });
      const quote = await getQuote(id);
      if (!quote) return res.status(404).json({ error: 'not found' });

      if (req.query.permanent) {
        await deleteQuote(id);
        await logActivity({ actor, action: 'deleted forever', lead_id: id, lead_name: quote.name, detail: '' });
        return res.status(200).json({ ok: true });
      }
      // Soft delete: move to the recycle bin, remembering the prior status.
      const was = quote.status || 'new';
      await updateQuote(id, { status: 'deleted' });
      await appendNote(id, `Deleted by ${actor} (was ${was})`);
      await logActivity({ actor, action: 'deleted', lead_id: id, lead_name: quote.name, detail: `was ${was}` });
      return res.status(200).json({ ok: true, recycled: true });
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};

      // Add a free-text internal note (folded in from the old /note endpoint).
      if (typeof body.add_note === 'string') {
        const text = body.add_note.trim();
        if (!text) return res.status(400).json({ error: 'text required' });
        const updated = await appendNote(id, text);
        return res.status(200).json({ quote: stripMoney(updated, role) });
      }

      // Restore from the recycle bin.
      if (body.restore === true) {
        if (role === 'staff') return res.status(403).json({ error: 'staff cannot restore leads' });
        const quote = await getQuote(id);
        if (!quote) return res.status(404).json({ error: 'not found' });
        const back = priorStatusFromNotes(quote);
        const updated = await updateQuote(id, { status: ALLOWED_STATUS.includes(back) ? back : 'new' });
        await appendNote(id, `Restored by ${actor}`);
        await logActivity({ actor, action: 'restored', lead_id: id, lead_name: quote.name, detail: '' });
        return res.status(200).json({ quote: stripMoney(updated, role) });
      }

      // Gentle quote follow-up email (staff allowed - no price content).
      if (body.send_followup === true) {
        const quote = await getQuote(id);
        if (!quote) return res.status(404).json({ error: 'not found' });
        if (!quote.email) return res.status(400).json({ error: 'no email on this lead' });
        try {
          await sendFollowup(quote);
          await appendNote(id, `Follow-up emailed to ${quote.email} by ${actor}`);
          await logActivity({ actor, action: 'sent follow-up', lead_id: id, lead_name: quote.name, detail: '' });
          return res.status(200).json({ followup: 'sent' });
        } catch (e) {
          return res.status(502).json({ error: 'follow-up email failed: ' + e.message });
        }
      }

      // Manual review-request resend.
      if (body.resend_review === true) {
        const quote = await getQuote(id);
        if (!quote) return res.status(404).json({ error: 'not found' });
        if (!quote.email) return res.status(400).json({ error: 'no customer email on file' });
        try {
          await sendReviewRequest(quote);
          await appendNote(id, `${REVIEW_MARK} to ${quote.email}`);
          await logActivity({ actor, action: 'sent review request', lead_id: id, lead_name: quote.name, detail: '' });
          return res.status(200).json({ review_request: 'sent' });
        } catch (e) {
          return res.status(502).json({ error: 'review email failed: ' + e.message });
        }
      }

      // Regular field/status/value update.
      const { status, value } = body;
      const patch = {};
      const prior = await getQuote(id);
      if (!prior) return res.status(404).json({ error: 'not found' });

      if (status !== undefined) {
        if (!ALLOWED_STATUS.includes(status)) return res.status(400).json({ error: 'invalid status' });
        patch.status = status;
      }
      // Staff never set money.
      if (value !== undefined && role !== 'staff') {
        const n = value === null || value === '' ? null : Number(value);
        if (n !== null && (isNaN(n) || n < 0)) return res.status(400).json({ error: 'invalid value' });
        patch.value = n;
      }
      const textChanged = [];
      for (const field of EDITABLE_TEXT_FIELDS) {
        if (body[field] === undefined) continue;
        const raw = body[field];
        if (raw === null || raw === '') { patch[field] = null; textChanged.push(field); continue; }
        const s = String(raw).trim();
        if (s.length > 2000) return res.status(400).json({ error: `${field} too long` });
        if (field === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return res.status(400).json({ error: 'invalid email' });
        patch[field] = s;
        textChanged.push(field);
      }
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'no fields to update' });

      const updated = await updateQuote(id, patch);

      // Audit trail (best-effort, attributed to the actor).
      if (patch.status !== undefined && patch.status !== prior.status) {
        await appendNote(id, `Status changed to ${patch.status} by ${actor}`);
        await logActivity({ actor, action: 'changed status', lead_id: id, lead_name: prior.name, detail: `to ${patch.status}` });
      }
      if (textChanged.length || patch.value !== undefined) {
        await appendNote(id, `Details updated by ${actor}`);
        await logActivity({ actor, action: 'updated details', lead_id: id, lead_name: prior.name, detail: textChanged.join(', ') });
      }

      // Auto-ask for a review when a job is marked completed (opt-in per request).
      let review_request = null;
      if (body.send_review === true && patch.status === 'won' && prior.status !== 'won'
          && prior.email && !alreadyAskedReview(prior)) {
        try {
          await sendReviewRequest(prior);
          await appendNote(id, `${REVIEW_MARK} to ${prior.email}`);
          await logActivity({ actor, action: 'sent review request', lead_id: id, lead_name: prior.name, detail: 'auto on completion' });
          review_request = 'sent';
        } catch (_) { review_request = 'failed'; }
      }

      return res.status(200).json({ quote: stripMoney(updated, role), review_request });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
