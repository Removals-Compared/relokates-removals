// Minimal Google Calendar client using OAuth refresh token + fetch.
// No googleapis dep needed - keeps Vercel bundle small and cold-start fast.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3';
const CAL_ID = 'primary';  // info@relokates.co.uk's primary calendar

let cachedToken = null;  // { accessToken, expiresAt }

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }
  const params = new URLSearchParams({
    client_id: process.env.GCAL_CLIENT_ID,
    client_secret: process.env.GCAL_CLIENT_SECRET,
    refresh_token: process.env.GCAL_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error(`gcal token refresh ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };
  return cachedToken.accessToken;
}

/**
 * Create a calendar event.
 * @param {Object} event - Standard Google Calendar event payload.
 *   Minimum required: summary, start, end. See:
 *   https://developers.google.com/calendar/api/v3/reference/events/insert
 * @returns {Object} The created event including .id and .htmlLink
 */
export async function createEvent(event) {
  const token = await getAccessToken();
  const res = await fetch(`${CAL_BASE}/calendars/${encodeURIComponent(CAL_ID)}/events?sendUpdates=all`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    throw new Error(`gcal createEvent ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function deleteEvent(eventId) {
  const token = await getAccessToken();
  const res = await fetch(`${CAL_BASE}/calendars/${encodeURIComponent(CAL_ID)}/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 410) {
    throw new Error(`gcal deleteEvent ${res.status}`);
  }
}

/**
 * Convenience helper: build a calendar event for an appointment
 * with the customer added as an attendee so they get a calendar invite.
 */
export function buildAppointmentEvent({ type, scheduledFor, durationMinutes = 60, customer, address, notes }) {
  const start = new Date(scheduledFor);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const isSurvey = type === 'survey';
  const summary = isSurvey
    ? `Survey - ${customer.name}`
    : `Move - ${customer.name}`;
  const description = [
    isSurvey
      ? 'Pre-move survey with Relokates Removals.'
      : 'Moving day with Relokates Removals.',
    '',
    `Customer: ${customer.name}`,
    `Phone:    ${customer.phone || ''}`,
    `Email:    ${customer.email || ''}`,
    address ? `Address:  ${address}` : '',
    notes ? `\nNotes:\n${notes}` : '',
    '',
    'Booked via the Relokates admin area.',
  ].filter(Boolean).join('\n');
  return {
    summary,
    description,
    location: address || undefined,
    start: { dateTime: start.toISOString(), timeZone: 'Europe/London' },
    end:   { dateTime: end.toISOString(),   timeZone: 'Europe/London' },
    attendees: customer.email ? [{ email: customer.email, displayName: customer.name }] : undefined,
    reminders: { useDefault: true },
  };
}
