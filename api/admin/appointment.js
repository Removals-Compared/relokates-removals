// Create one appointment, or a series of recurring appointments.
//
// Side effects, in order, per appointment:
//   1. Supabase: insert row in relokates_appointments
//   2. Google Calendar: create event on info@relokates.co.uk's calendar
//   3. Customer email confirmation
//   4. Customer SMS confirmation (if TWILIO_* env vars set + customer.phone)
//   5. Quote status auto-advance
//
// Errors after step 1 are reported in the response `errors` array
// but do not roll back the appointment row, so the admin UI can
// flag what needs manual attention.

import crypto from 'node:crypto';
import { requireAuth } from './_session.js';
import { getQuote, createAppointment, updateAppointment, updateQuote, buildRecurringSeries } from './_db.js';
import { createEvent, buildAppointmentEvent } from './_gcal.js';
import { sendSurveyConfirmation, sendBookingConfirmation } from './_email.js';
import { sendSms, isSmsConfigured, formatUkPhone } from './_sms.js';

function fmt(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const {
    lead_id, type, scheduled_for,
    duration_minutes = 60, address, notes,
    recurring_pattern, recurring_until,
  } = req.body || {};

  if (!lead_id || !type || !scheduled_for) {
    return res.status(400).json({ error: 'lead_id, type and scheduled_for required' });
  }
  if (!['survey', 'move'].includes(type)) {
    return res.status(400).json({ error: 'type must be survey or move' });
  }
  if (recurring_pattern && !['weekly', 'biweekly', 'monthly'].includes(recurring_pattern)) {
    return res.status(400).json({ error: 'invalid recurring_pattern' });
  }

  let quote;
  try {
    quote = await getQuote(lead_id);
    if (!quote) return res.status(404).json({ error: 'lead not found' });
  } catch (e) {
    return res.status(500).json({ error: `supabase: ${e.message}` });
  }
  const customer = { name: quote.name, email: quote.email, phone: quote.phone };
  const service = quote.service;
  const resolvedAddress = address || quote.move_from || null;

  // If recurring, calculate the series; otherwise a one-element series.
  const series = recurring_pattern && recurring_until
    ? buildRecurringSeries({ startIso: scheduled_for, pattern: recurring_pattern, untilDate: recurring_until })
    : [new Date(scheduled_for).toISOString()];

  const recurringId = series.length > 1 ? crypto.randomUUID() : null;
  const appointments = [];
  const errors = [];

  for (let i = 0; i < series.length; i++) {
    const when = series[i];
    let appointment;
    try {
      appointment = await createAppointment({
        lead_id, type,
        scheduled_for: when,
        duration_minutes,
        address: resolvedAddress,
        notes: notes || null,
        status: 'booked',
        recurring_id: recurringId,
        recurring_pattern: recurringId ? recurring_pattern : null,
        recurring_until: recurringId ? recurring_until : null,
      });
    } catch (e) {
      errors.push({ step: 'supabase', when, message: e.message });
      continue;
    }

    // Google Calendar.
    let event = null;
    try {
      event = await createEvent(buildAppointmentEvent({
        type, scheduledFor: when, durationMinutes: duration_minutes,
        customer, address: resolvedAddress, notes,
      }));
      await updateAppointment(appointment.id, { gcal_event_id: event.id });
      appointment.gcal_event_id = event.id;
    } catch (e) {
      errors.push({ step: 'gcal', when, message: e.message });
    }

    // Email - only on the FIRST appointment of a recurring series,
    // or on every appointment if it's a single booking. Avoid
    // spamming the customer with a series-of-12 wall of emails.
    if (i === 0) {
      try {
        const sender = type === 'survey' ? sendSurveyConfirmation : sendBookingConfirmation;
        await sender({ customer, scheduledFor: when, address: resolvedAddress, notes, service });
        await updateAppointment(appointment.id, { email_sent: true });
        appointment.email_sent = true;
      } catch (e) {
        errors.push({ step: 'email', when, message: e.message });
      }

      // SMS to customer.
      if (isSmsConfigured() && customer.phone) {
        try {
          const phone = formatUkPhone(customer.phone);
          const label = type === 'survey' ? 'survey' : 'move';
          const seriesNote = recurringId ? ` (first of a ${recurring_pattern} series)` : '';
          await sendSms({
            to: phone,
            body: `Relokates: Your ${label} is booked for ${fmt(when)}${seriesNote}. Reply or call 07359 724844 to change.`,
          });
          await updateAppointment(appointment.id, { sms_sent: true });
          appointment.sms_sent = true;
        } catch (e) {
          errors.push({ step: 'sms', when, message: e.message });
        }
      }
    }
    appointments.push(appointment);
  }

  // Move the lead's status forward (once, regardless of series length).
  try {
    const newStatus = type === 'survey' ? 'survey_booked' : 'move_booked';
    await updateQuote(lead_id, { status: newStatus });
  } catch (e) {
    errors.push({ step: 'status', message: e.message });
  }

  return res.status(200).json({
    ok: true,
    appointments,
    recurring_id: recurringId,
    occurrences: series.length,
    errors,
  });
}
