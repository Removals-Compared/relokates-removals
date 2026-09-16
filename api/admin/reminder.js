// Call-back reminders for a lead. POST creates one (and a "Call <name>"
// Google Calendar event so you get alerted); DELETE removes it and the event.
import { requireAuthWithBranch } from './_session.js';
import { createReminder, updateReminder, deleteReminder, fetchReminder, getQuote } from './_db.js';
import { isGcalConfigured, createReminderEvent, deleteEvent } from './_gcal.js';

export default async function handler(req, res) {
  const auth = requireAuthWithBranch(req, res);
  if (!auth) return;
  const { branchSource } = auth;
  try {
    if (req.method === 'POST') {
      const { lead_id, remind_on, remind_time, note } = req.body || {};
      if (!lead_id || !remind_on) {
        return res.status(400).json({ error: 'lead_id and remind_on are required' });
      }
      // Branch sessions may only set reminders on their own branch's leads.
      if (branchSource) {
        const owned = await getQuote(lead_id);
        if (!owned || owned.source !== branchSource) return res.status(404).json({ error: 'lead not found' });
      }
      const time = (remind_time && /^\d{2}:\d{2}$/.test(remind_time)) ? remind_time : '09:30';

      let reminder = await createReminder({
        lead_id: Number(lead_id),
        remind_on,               // YYYY-MM-DD
        remind_time: time,       // HH:MM
        note: (note || '').trim() || null,
        sent: false,
      });

      // Put a "Call <name>" event on Google Calendar; Google alerts at the
      // chosen time. Tolerate failure - the reminder is still saved.
      const errors = [];
      if (isGcalConfigured()) {
        try {
          const quote = await getQuote(lead_id);
          const eventId = await createReminderEvent({ quote, date: remind_on, time, note });
          if (eventId) reminder = await updateReminder(reminder.id, { gcal_event_id: eventId });
        } catch (e) {
          errors.push({ step: 'gcal', message: String(e.message || e) });
        }
      }
      return res.status(201).json({ reminder, errors });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id required' });
      let existing = null;
      try { existing = await fetchReminder(id); } catch (_) { /* tolerated below */ }
      // Branch sessions may only remove reminders on their own branch's leads.
      if (branchSource) {
        if (!existing) return res.status(404).json({ error: 'not found' });
        const owned = await getQuote(existing.lead_id);
        if (!owned || owned.source !== branchSource) return res.status(404).json({ error: 'not found' });
      }
      try {
        if (existing && existing.gcal_event_id) await deleteEvent(existing.gcal_event_id);
      } catch (e) {
        console.error('reminder delete gcal', e);
      }
      await deleteReminder(id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error('reminder.js', e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
