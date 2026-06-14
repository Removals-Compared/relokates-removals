// PATCH = reschedule, DELETE = cancel.
//
// Reschedule updates the appointment row, updates the Google Calendar
// event in place (so the customer's existing invite shifts), and emails
// the customer a reschedule notice.
//
// Cancel marks the row status=cancelled, deletes the calendar event,
// and emails the customer a cancellation notice.
//
// SMS is sent on both actions if Twilio is configured.

import { requireAuth } from '../_session.js';
import { getAppointment, updateAppointment, getQuote } from '../_db.js';
import { createEvent, deleteEvent, buildAppointmentEvent } from '../_gcal.js';
import { sendRescheduleNotice, sendCancellationNotice } from '../_email.js';
import { sendSms, isSmsConfigured, formatUkPhone } from '../_sms.js';

function fmt(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'id required' });

  const appointment = await getAppointment(id).catch(() => null);
  if (!appointment) return res.status(404).json({ error: 'not found' });
  const quote = await getQuote(appointment.lead_id).catch(() => null);
  const customer = quote ? { name: quote.name, email: quote.email, phone: quote.phone } : null;
  const service = quote ? quote.service : null;

  if (req.method === 'PATCH') {
    const { scheduled_for, duration_minutes, address, notes } = req.body || {};
    if (!scheduled_for) return res.status(400).json({ error: 'scheduled_for required' });

    const newWhen = new Date(scheduled_for).toISOString();
    const newDuration = duration_minutes || appointment.duration_minutes;
    const newAddress = address ?? appointment.address;
    const newNotes = notes ?? appointment.notes;

    const errors = [];

    // 1. DB.
    let updated;
    try {
      updated = await updateAppointment(id, {
        scheduled_for: newWhen,
        duration_minutes: newDuration,
        address: newAddress,
        notes: newNotes,
        status: 'rescheduled',
      });
    } catch (e) {
      return res.status(500).json({ error: `supabase: ${e.message}` });
    }

    // 2. Google Calendar: delete old, create new (simpler than PATCH
    // and avoids edge cases with attendee state).
    if (appointment.gcal_event_id) {
      try { await deleteEvent(appointment.gcal_event_id); } catch (e) { errors.push({ step: 'gcal_delete', message: e.message }); }
    }
    if (customer) {
      try {
        const ev = await createEvent(buildAppointmentEvent({
          type: appointment.type, scheduledFor: newWhen, durationMinutes: newDuration,
          customer, address: newAddress, notes: newNotes,
        }));
        await updateAppointment(id, { gcal_event_id: ev.id });
        updated.gcal_event_id = ev.id;
      } catch (e) { errors.push({ step: 'gcal_create', message: e.message }); }
    }

    // 3. Email.
    if (customer && customer.email) {
      try {
        await sendRescheduleNotice({
          customer,
          oldWhen: appointment.scheduled_for,
          scheduledFor: newWhen,
          type: appointment.type,
          address: newAddress,
          notes: newNotes,
          service,
        });
      } catch (e) { errors.push({ step: 'email', message: e.message }); }
    }

    // 4. SMS.
    if (isSmsConfigured() && customer && customer.phone) {
      try {
        const phone = formatUkPhone(customer.phone);
        const label = appointment.type === 'survey' ? 'survey' : 'move';
        await sendSms({
          to: phone,
          body: `Relokates: Your ${label} has been rescheduled to ${fmt(newWhen)}. Call 07359 724844 if this doesn't work.`,
        });
      } catch (e) { errors.push({ step: 'sms', message: e.message }); }
    }

    return res.status(200).json({ ok: true, appointment: updated, errors });
  }

  if (req.method === 'DELETE') {
    const errors = [];
    // 1. Mark cancelled.
    let updated;
    try {
      updated = await updateAppointment(id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      });
    } catch (e) {
      return res.status(500).json({ error: `supabase: ${e.message}` });
    }

    // 2. GCal delete.
    if (appointment.gcal_event_id) {
      try { await deleteEvent(appointment.gcal_event_id); } catch (e) { errors.push({ step: 'gcal', message: e.message }); }
    }

    // 3. Email.
    if (customer && customer.email) {
      try {
        await sendCancellationNotice({
          customer,
          scheduledFor: appointment.scheduled_for,
          type: appointment.type,
          service,
        });
      } catch (e) { errors.push({ step: 'email', message: e.message }); }
    }

    // 4. SMS.
    if (isSmsConfigured() && customer && customer.phone) {
      try {
        const phone = formatUkPhone(customer.phone);
        const label = appointment.type === 'survey' ? 'survey' : 'move';
        await sendSms({
          to: phone,
          body: `Relokates: Your ${label} on ${fmt(appointment.scheduled_for)} has been cancelled. Call 07359 724844 to rebook.`,
        });
      } catch (e) { errors.push({ step: 'sms', message: e.message }); }
    }

    return res.status(200).json({ ok: true, appointment: updated, errors });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
