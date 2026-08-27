// Create a survey or move appointment.
// Steps (errors after step 1 do not roll back the row):
//   1. Supabase row in relokates_appointments
//   2. Google Calendar event
//   3. Customer email confirmation
//   4. Quote status auto-advance

import { requireAuth, actorName } from './_session.js';
import { getQuote, createAppointment, updateAppointment, updateQuote, fetchMovesOnDate, appendNote, logActivity } from './_db.js';
import { createEvent, buildAppointmentEvent, isGcalConfigured } from './_gcal.js';
import { sendSurveyConfirmation, sendBookingConfirmation, sendPackingConfirmation } from './_email.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { lead_id, type, scheduled_for, duration_minutes = 60, address, notes } = req.body || {};
  if (!lead_id || !type || !scheduled_for) {
    return res.status(400).json({ error: 'lead_id, type and scheduled_for required' });
  }
  if (!['survey', 'move', 'packing'].includes(type)) {
    return res.status(400).json({ error: 'type must be survey, move or packing' });
  }

  const errors = [];
  let quote;
  try {
    quote = await getQuote(lead_id);
    if (!quote) return res.status(404).json({ error: 'lead not found' });
  } catch (e) {
    return res.status(500).json({ error: `supabase: ${e.message}` });
  }
  const customer = { name: quote.name, email: quote.email, phone: quote.phone };

  let appointment;
  try {
    appointment = await createAppointment({
      lead_id, type, scheduled_for,
      duration_minutes,
      address: address || quote.move_from || null,
      notes: notes || null,
    });
  } catch (e) {
    return res.status(500).json({ error: `supabase appointment: ${e.message}` });
  }

  // Google Calendar.
  let event = null;
  if (isGcalConfigured()) {
    try {
      event = await createEvent(buildAppointmentEvent({
        type, scheduledFor: scheduled_for, durationMinutes: duration_minutes,
        customer, address: address || quote.move_from, notes,
      }));
      await updateAppointment(appointment.id, { gcal_event_id: event.id });
      appointment.gcal_event_id = event.id;
    } catch (e) {
      errors.push({ step: 'gcal', message: e.message });
    }
  }

  // Customer email.
  if (customer.email) {
    try {
      const send = type === 'survey' ? sendSurveyConfirmation : type === 'packing' ? sendPackingConfirmation : sendBookingConfirmation;
      await send({ customer, scheduledFor: scheduled_for, address: address || quote.move_from, notes });
      await updateAppointment(appointment.id, { email_sent: true });
      appointment.email_sent = true;
    } catch (e) {
      errors.push({ step: 'email', message: e.message });
    }
  }

  // Status advance - survey/move drive the pipeline; a packing day does not
  // (it is day one of a 2-day job; the separate move booking sets move_booked).
  if (type !== 'packing') {
    try {
      await updateQuote(lead_id, { status: type === 'survey' ? 'survey_booked' : 'move_booked' });
    } catch (e) {
      errors.push({ step: 'status', message: e.message });
    }
  }

  // Audit trail (best-effort).
  const actor = actorName(req);
  const typeLabel = type === 'survey' ? 'Survey' : type === 'packing' ? 'Packing day' : 'Move';
  try {
    await appendNote(lead_id, `${typeLabel} booked by ${actor} for ${scheduled_for}`);
    await logActivity({ actor, action: `booked ${type}`, lead_id, lead_name: quote.name, detail: scheduled_for });
  } catch (_) { /* non-fatal */ }

  // Booking-conflict warning: other move jobs already on that day.
  let conflicts = [];
  if (type === 'move') {
    try {
      const day = String(scheduled_for).slice(0, 10);
      const others = await fetchMovesOnDate(day, lead_id);
      const names = [];
      for (const o of others) {
        try { const q = await getQuote(o.lead_id); if (q && q.name) names.push(q.name); } catch (_) { /* skip */ }
      }
      conflicts = [...new Set(names)];
    } catch (_) { /* non-fatal */ }
  }

  return res.status(200).json({
    ok: true,
    appointment,
    event_link: event?.htmlLink || null,
    conflicts,
    errors,
  });
}
