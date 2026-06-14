// Per-service email templates for admin-triggered customer notifications.
// Reuses the same Gmail / Nodemailer setup as api/quote.js.

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
});

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
}

function shellHtml(body) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#1A3C6E;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#A8C5BC;margin:0;font-size:18px">Relokates Removals</h2>
      </div>
      <div style="background:#F4F8F6;padding:24px;border:1px solid #c8ddd8;border-top:none;border-radius:0 0 8px 8px;color:#1A3C6E">
        ${body}
        <hr style="border:none;border-top:1px solid #c8ddd8;margin:24px 0">
        <p style="font-size:13px;color:#556070;margin:0">Need to change or cancel? Call 07359 724844 or reply to this email.</p>
        <p style="font-size:13px;color:#556070;margin:8px 0 0">Relokates Removals - Company No. 13441775 - info@relokates.co.uk</p>
      </div>
    </div>
  `;
}

// Per-service blurbs - what the customer specifically gets on the day.
const SERVICE_BLURBS = {
  'House Removal': 'Our crew will arrive with protective wrapping for furniture, blankets for fragile items, and the equipment needed to navigate any access constraints. We will disassemble and reassemble furniture as part of the service.',
  'Office Removal': 'Our team will arrive with crates and trolleys appropriate for office contents, IT-safe packing materials, and the experience to coordinate the move with minimal business disruption.',
  'International Removal - Dubai': 'A specialist crew handles the UK collection. The shipping process to Dubai is then coordinated by our partner UAE office. We will walk through the customs documentation with you on the day.',
  'International Removal - Other': 'A specialist international crew handles the UK collection. Customs paperwork and shipping coordination will be confirmed during the survey.',
  'Packing Service': 'Our trained packers will arrive with double-walled boxes, bubble wrap, wardrobe boxes and specialist materials for fragile items. Items packed by our team are covered by our goods-in-transit insurance.',
  'Man and Van': 'A single van and trained operative will arrive at the agreed time. Loading, securing and unloading are all included.',
  'Secure Storage': 'Items collected on the day will be inventoried, sealed and stored in our secure facility. You will receive a stored-items list within 24 hours.',
  'Luxury Removals': 'A specialist crew will handle fine art, antiques and high-value items with custom crating where required. Goods-in-transit insurance is uprated accordingly.',
  'House Clearance': 'Our team will sort, remove and responsibly dispose of items in line with the brief we agreed at survey. Recycling and donation routes used where possible.',
};

function blurbFor(service) {
  return SERVICE_BLURBS[service] || 'Our trained crew will arrive on the day with everything needed to complete your move smoothly.';
}

export async function sendSurveyConfirmation({ customer, scheduledFor, address, notes, service }) {
  const when = formatDateTime(scheduledFor);
  const body = `
    <p style="font-size:15px">Hello ${customer.name},</p>
    <p style="font-size:15px;line-height:1.7">Your <strong>pre-move survey</strong> with Relokates Removals is confirmed for <strong style="color:#B8932A">${when}</strong>.</p>
    ${service ? `<p style="font-size:14px;line-height:1.7"><strong>Service discussed:</strong> ${service}</p>` : ''}
    ${address ? `<p style="font-size:14px;line-height:1.7"><strong>Survey address:</strong><br>${address}</p>` : ''}
    ${notes ? `<p style="font-size:14px;line-height:1.7"><strong>Notes:</strong><br>${notes}</p>` : ''}
    <p style="font-size:14px;line-height:1.7">The survey usually takes 30-45 minutes. We will walk through every room with you, confirm access details and finalise a fixed-price quote for your ${service ? service.toLowerCase() : 'move'}.</p>
    <p style="font-size:14px;line-height:1.7">You will also receive a calendar invite from info@relokates.co.uk - accept it to add the appointment to your calendar.</p>
  `;
  return transporter.sendMail({
    from: 'Relokates Removals <info@relokates.co.uk>',
    to: customer.email,
    subject: `Survey confirmed - ${when} - Relokates Removals`,
    html: shellHtml(body),
  });
}

export async function sendBookingConfirmation({ customer, scheduledFor, address, notes, service }) {
  const when = formatDateTime(scheduledFor);
  const body = `
    <p style="font-size:15px">Hello ${customer.name},</p>
    <p style="font-size:15px;line-height:1.7">Your <strong>${service ? service.toLowerCase() : 'moving date'}</strong> with Relokates Removals is booked for <strong style="color:#B8932A">${when}</strong>.</p>
    ${address ? `<p style="font-size:14px;line-height:1.7"><strong>Collection address:</strong><br>${address}</p>` : ''}
    ${notes ? `<p style="font-size:14px;line-height:1.7"><strong>Notes:</strong><br>${notes}</p>` : ''}
    <p style="font-size:14px;line-height:1.7"><strong>What happens on the day:</strong> ${blurbFor(service)}</p>
    <p style="font-size:14px;line-height:1.7">We will be in touch the week before with the arrival window and your crew's contact details. If anything changes, call us on 07359 724844 - we are flexible.</p>
    <p style="font-size:14px;line-height:1.7">You will also receive a calendar invite from info@relokates.co.uk.</p>
  `;
  return transporter.sendMail({
    from: 'Relokates Removals <info@relokates.co.uk>',
    to: customer.email,
    subject: `Move confirmed - ${when} - Relokates Removals`,
    html: shellHtml(body),
  });
}

export async function sendRescheduleNotice({ customer, oldWhen, scheduledFor, type, address, notes, service }) {
  const newWhen = formatDateTime(scheduledFor);
  const oldStr = oldWhen ? formatDateTime(oldWhen) : null;
  const label = type === 'survey' ? 'pre-move survey' : (service ? service.toLowerCase() : 'moving date');
  const body = `
    <p style="font-size:15px">Hello ${customer.name},</p>
    <p style="font-size:15px;line-height:1.7">Your <strong>${label}</strong> with Relokates Removals has been <strong>rescheduled</strong>.</p>
    ${oldStr ? `<p style="font-size:14px;line-height:1.7">Previous time: <s style="color:#9CA3AF">${oldStr}</s></p>` : ''}
    <p style="font-size:14px;line-height:1.7">New time: <strong style="color:#B8932A">${newWhen}</strong></p>
    ${address ? `<p style="font-size:14px;line-height:1.7"><strong>Address:</strong><br>${address}</p>` : ''}
    ${notes ? `<p style="font-size:14px;line-height:1.7"><strong>Notes:</strong><br>${notes}</p>` : ''}
    <p style="font-size:14px;line-height:1.7">Your calendar invite has been updated automatically. If the new time does not work, call us on 07359 724844.</p>
  `;
  return transporter.sendMail({
    from: 'Relokates Removals <info@relokates.co.uk>',
    to: customer.email,
    subject: `${type === 'survey' ? 'Survey' : 'Move'} rescheduled to ${newWhen}`,
    html: shellHtml(body),
  });
}

export async function sendCancellationNotice({ customer, scheduledFor, type, service }) {
  const when = scheduledFor ? formatDateTime(scheduledFor) : '';
  const label = type === 'survey' ? 'pre-move survey' : (service ? service.toLowerCase() : 'moving date');
  const body = `
    <p style="font-size:15px">Hello ${customer.name},</p>
    <p style="font-size:15px;line-height:1.7">Your <strong>${label}</strong>${when ? ` on ${when}` : ''} has been <strong>cancelled</strong>.</p>
    <p style="font-size:14px;line-height:1.7">If this was unexpected please call us on 07359 724844 and we will sort it out straight away.</p>
    <p style="font-size:14px;line-height:1.7">To book a new date, reply to this email or visit relokates.co.uk/contact.</p>
  `;
  return transporter.sendMail({
    from: 'Relokates Removals <info@relokates.co.uk>',
    to: customer.email,
    subject: `${type === 'survey' ? 'Survey' : 'Move'} cancelled`,
    html: shellHtml(body),
  });
}
