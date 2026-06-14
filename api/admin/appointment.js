// Create a survey or move appointment.
// Side effects in order:
//   1. Supabase: insert row in relokates_appointments
//   2. Google Calendar: create event on info@relokates.co.uk's calendar
//   3. Customer email: send confirmation via Nodemailer/Gmail
//
// If any step after the Supabase insert fails, we still return 200 with
// the failing components named in `errors` so the admin UI can flag
// what needs manual attention.

import { requireAuth } from './_session.js';
import { getQuote, createAppointment, updateAppointment, updateQuote } from './_db.js';
import { createEvent, buildAppointmentEvent } from './_gcal.js';
import { sendSurveyConfirmation, sendBookingConfirmation } from './_email.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const {
    lead_id, type, scheduled_for,
    duration_minutes = 60, address, notes,
  } = req.body || {};

  if (!lead_id || !type || !scheduled_for) {
    return res.status(400).json({ error: 'lead_id, type and scheduled_for required' });
  }
  if (!['survey', 'move'].includes(type)) {
    return res.status(400).json({ error: 'type must be survey or move' });
  }

  const errors = [];
  let appointment = null;
  let event = null;

  // 1. Load the quote so we have customer details.
  let quote;
  try {
    quote = await getQuote(lead_id);
    if (!quote) return res.status(404).json({ error: 'lead not found' });
  } catch (e) {
    return res.status(500).json({ error: `supabase: ${e.message}` });
  }
  const customer = {
    name: quote.name,
    email: quote.email,
    phone: quote.phone,
  };

  // 2. Insert appointment row first - source of truth.
  try {
    appointment = await createAppointment({
      lead_id,
      type,
      scheduled_for,
      duration_minutes,
      address: address || quote.move_from || null,
      notes: notes || null,
    });
  } catch (e) {
    return res.status(500).json({ error: `supabase appointment: ${e.message}` });
  }

  // 3. Google Calendar event.
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

  // 4. Customer confirmation email.
  try {
    const sender = type === 'survey' ? sendSurveyConfirmation : sendBookingConfirmation;
    await sender({ customer, scheduledFor: scheduled_for, address: address || quote.move_from, notes });
    await updateAppointment(appointment.id, { email_sent: true });
    appointment.email_sent = true;
  } catch (e) {
    errors.push({ step: 'email', message: e.message });
  }

  // 5. Move the lead's status forward.
  try {
    const newStatus = type === 'survey' ? 'survey_booked' : 'move_booked';
    await updateQuote(lead_id, { status: newStatus });
  } catch (e) {
    errors.push({ step: 'status', message: e.message });
  }

  return res.status(200).json({
    ok: true,
    appointment,
    event_link: event?.htmlLink || null,
    errors,
  });
}
