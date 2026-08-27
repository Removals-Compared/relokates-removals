// Minimal Google Calendar client. Uses OAuth refresh token + fetch
// directly - no googleapis dep so Vercel cold start is fast.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3';
const CAL_ID = 'primary';

let cachedToken = null;

function gcalConfigured() {
  return Boolean(process.env.GCAL_CLIENT_ID && process.env.GCAL_CLIENT_SECRET && process.env.GCAL_REFRESH_TOKEN);
}
export function isGcalConfigured() { return gcalConfigured(); }

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }
  if (!gcalConfigured()) throw new Error('gcal_not_configured');
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
  if (!res.ok) throw new Error(`gcal token refresh ${res.status}: ${await res.text()}`);
  const data = await res.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };
  return cachedToken.accessToken;
}

export async function createEvent(event) {
  const token = await getAccessToken();
  const res = await fetch(`${CAL_BASE}/calendars/${encodeURIComponent(CAL_ID)}/events?sendUpdates=all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`gcal createEvent ${res.status}: ${await res.text()}`);
  return res.json();
}

export function buildAppointmentEvent({ type, scheduledFor, durationMinutes = 60, customer, address, notes }) {
  const start = new Date(scheduledFor);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const label = type === 'survey' ? 'Survey' : type === 'packing' ? 'Packing' : 'Move';
  const summary = `${label} - ${customer.name}`;
  const description = [
    type === 'survey' ? 'Pre-move survey with Relokates Removals.' : type === 'packing' ? 'Packing day with Relokates Removals.' : 'Moving day with Relokates Removals.',
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

function plus30(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const total = (h * 60 + m + 30) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Creates a "Call <name>" event so Google alerts you at the chosen time.
// Returns the event id (used to delete the event later). Throws if gcal
// is not configured - callers treat that as non-fatal.
export async function createReminderEvent({ quote, date, time, note }) {
  const token = await getAccessToken();
  const name = (quote && quote.name) || 'Customer';
  const desc = [];
  if (quote) {
    if (quote.phone) desc.push(`Phone: ${quote.phone}`);
    if (quote.email) desc.push(`Email: ${quote.email}`);
    if (quote.service) desc.push(`Service: ${quote.service}`);
  }
  if (note) desc.push(`Note: ${note}`);
  const body = {
    summary: `Call ${name}`,
    description: desc.join('\n'),
    start: { dateTime: `${date}T${time}:00`, timeZone: 'Europe/London' },
    end:   { dateTime: `${date}T${plus30(time)}:00`, timeZone: 'Europe/London' },
    reminders: { useDefault: false, overrides: [
      { method: 'popup', minutes: 0 },
      { method: 'email', minutes: 0 },
    ] },
  };
  const res = await fetch(`${CAL_BASE}/calendars/${encodeURIComponent(CAL_ID)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`gcal createReminderEvent ${res.status}: ${await res.text()}`);
  return (await res.json()).id;
}

export async function deleteEvent(eventId) {
  if (!eventId) return true;
  const token = await getAccessToken();
  const res = await fetch(`${CAL_BASE}/calendars/${encodeURIComponent(CAL_ID)}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    throw new Error(`gcal deleteEvent ${res.status}: ${await res.text()}`);
  }
  return true;
}
