// Customer confirmation emails for survey + move bookings.
// Reuses the same Gmail/Nodemailer setup as api/quote.js.

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
        <p style="margin-top:20px;font-size:14px;color:#556070;line-height:1.6">If anything needs to change, just reply to this email, or reach us whichever way suits you:</p>
        <div style="text-align:center;margin:14px 0 4px">
          <a href="tel:07359724844" style="background:#B8932A;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:9px;display:inline-block;margin:4px">&#128222; Call 07359 724844</a>
          <a href="https://wa.me/447359724844" style="background:#25D366;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:9px;display:inline-block;margin:4px">&#128172; WhatsApp us</a>
        </div>
        <hr style="border:none;border-top:1px solid #c8ddd8;margin:20px 0">
        <p style="font-size:13px;color:#556070;margin:0">Relokates Removals - Company No. 13441775 - 07359 724844 - info@relokates.co.uk</p>
      </div>
    </div>
  `;
}

export async function sendSurveyConfirmation({ customer, scheduledFor, address, notes }) {
  const when = formatDateTime(scheduledFor);
  const body = `
    <p style="font-size:15px">Hello ${customer.name},</p>
    <p style="font-size:15px;line-height:1.7">Your <strong>pre-move survey</strong> with Relokates Removals is confirmed for <strong style="color:#B8932A">${when}</strong>.</p>
    ${address ? `<p style="font-size:14px;line-height:1.7"><strong>Survey address:</strong><br>${address}</p>` : ''}
    ${notes ? `<p style="font-size:14px;line-height:1.7"><strong>Notes:</strong><br>${notes}</p>` : ''}
    <p style="font-size:14px;line-height:1.7">The survey usually takes 30-45 minutes. We will walk through every room with you, confirm access details and finalise a fixed-price quote.</p>
    <p style="font-size:14px;line-height:1.7">You will also receive a calendar invite from info@relokates.co.uk - accept it to add the appointment to your calendar.</p>
  `;
  return transporter.sendMail({
    from: 'Relokates Removals <info@relokates.co.uk>',
    to: customer.email,
    subject: `Survey confirmed - ${when} - Relokates Removals`,
    html: shellHtml(body),
  });
}

export async function sendPackingConfirmation({ customer, scheduledFor, address, notes }) {
  const when = formatDateTime(scheduledFor);
  const body = `
    <p style="font-size:15px">Hello ${customer.name},</p>
    <p style="font-size:15px;line-height:1.7">Your <strong>packing day</strong> with Relokates Removals is confirmed for <strong style="color:#B8932A">${when}</strong>.</p>
    ${address ? `<p style="font-size:14px;line-height:1.7"><strong>Address:</strong><br>${address}</p>` : ''}
    ${notes ? `<p style="font-size:14px;line-height:1.7"><strong>Notes:</strong><br>${notes}</p>` : ''}
    <p style="font-size:14px;line-height:1.7">Our crew will carefully pack and label everything by room so it is all ready for moving day. Please set aside your valuables, documents and anything you need overnight.</p>
    <p style="font-size:14px;line-height:1.7">You will also receive a calendar invite from info@relokates.co.uk.</p>
  `;
  return transporter.sendMail({
    from: 'Relokates Removals <info@relokates.co.uk>',
    to: customer.email,
    subject: `Packing day confirmed - ${when} - Relokates Removals`,
    html: shellHtml(body),
  });
}

export async function sendBookingConfirmation({ customer, scheduledFor, address, notes }) {
  const when = formatDateTime(scheduledFor);
  const body = `
    <p style="font-size:15px">Hello ${customer.name},</p>
    <p style="font-size:15px;line-height:1.7">Your <strong>moving date</strong> with Relokates Removals is booked for <strong style="color:#B8932A">${when}</strong>.</p>
    ${address ? `<p style="font-size:14px;line-height:1.7"><strong>Collection address:</strong><br>${address}</p>` : ''}
    ${notes ? `<p style="font-size:14px;line-height:1.7"><strong>Notes:</strong><br>${notes}</p>` : ''}
    <p style="font-size:14px;line-height:1.7">We will be in touch the week before with the arrival window and your crew's contact details. If anything about your move changes, call us on 07359 724844 - we are flexible.</p>
    <p style="font-size:14px;line-height:1.7">You will also receive a calendar invite from info@relokates.co.uk.</p>
  `;
  return transporter.sendMail({
    from: 'Relokates Removals <info@relokates.co.uk>',
    to: customer.email,
    subject: `Move confirmed - ${when} - Relokates Removals`,
    html: shellHtml(body),
  });
}
