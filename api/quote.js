// Relokates Removals — Quote form API
// Supabase (leads table) + Nodemailer/Gmail (email) + HubSpot (CRM)

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,       // info@relokates.co.uk
    pass: process.env.GMAIL_APP_PASS,   // 16-char Google App Password
  },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    name, email, phone, service,
    move_from, move_to, move_date, property, message
  } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, email and phone are required' });
  }

  const timestamp = new Date().toISOString();
  const errors = [];

  // ── 1. SUPABASE ──
  try {
    const sbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/relokates_quote_request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        name, email, phone, service,
        move_from, move_to, move_date, property, message,
        source: 'relokates.co.uk',
        created_at: timestamp
      })
    });
    if (!sbRes.ok) errors.push('supabase');
  } catch (e) {
    errors.push('supabase');
  }

  // ── 2. INTERNAL NOTIFICATION EMAIL ──
  try {
    await transporter.sendMail({
      from: 'Relokates Quotes <info@relokates.co.uk>',
      to: 'info@relokates.co.uk',
      replyTo: email,
      subject: `New Quote Request — ${service || 'Removal'} | ${name}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <div style="background:#1A3C6E;padding:20px 24px;border-radius:8px 8px 0 0">
            <h2 style="color:#A8C5BC;margin:0;font-size:18px">New Quote Request — Relokates Removals</h2>
          </div>
          <div style="background:#F4F8F6;padding:24px;border:1px solid #c8ddd8;border-top:none;border-radius:0 0 8px 8px">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;font-weight:600;color:#1A3C6E;width:140px">Name</td><td style="padding:8px 0;color:#444">${name}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;color:#1A3C6E">Phone</td><td style="padding:8px 0;color:#444"><a href="tel:${phone}" style="color:#B8932A">${phone}</a></td></tr>
              <tr><td style="padding:8px 0;font-weight:600;color:#1A3C6E">Email</td><td style="padding:8px 0;color:#444"><a href="mailto:${email}" style="color:#B8932A">${email}</a></td></tr>
              <tr><td style="padding:8px 0;font-weight:600;color:#1A3C6E">Service</td><td style="padding:8px 0;color:#444">${service || '—'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;color:#1A3C6E">Moving from</td><td style="padding:8px 0;color:#444">${move_from || '—'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;color:#1A3C6E">Moving to</td><td style="padding:8px 0;color:#444">${move_to || '—'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;color:#1A3C6E">Move date</td><td style="padding:8px 0;color:#444">${move_date || '—'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:600;color:#1A3C6E">Property</td><td style="padding:8px 0;color:#444">${property || '—'}</td></tr>
              ${message ? `<tr><td style="padding:8px 0;font-weight:600;color:#1A3C6E;vertical-align:top">Message</td><td style="padding:8px 0;color:#444">${message}</td></tr>` : ''}
            </table>
            <div style="margin-top:20px;padding:16px;background:#fff;border-radius:6px;border-left:4px solid #B8932A">
              <p style="margin:0;font-size:13px;color:#666">Received: ${new Date(timestamp).toLocaleString('en-GB')} | Source: relokates.co.uk</p>
            </div>
          </div>
        </div>
      `
    });
  } catch (e) {
    console.error('Internal email failed:', e.message);
    errors.push('email-internal');
  }

  // ── 3. AUTO-REPLY TO CUSTOMER ──
  try {
    await transporter.sendMail({
      from: 'Relokates Removals <info@relokates.co.uk>',
      to: email,
      subject: 'Your quote request has been received — Relokates Removals',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <div style="background:#1A3C6E;padding:20px 24px;border-radius:8px 8px 0 0">
            <h2 style="color:#A8C5BC;margin:0;font-size:18px">Relokates Removals</h2>
          </div>
          <div style="background:#fff;padding:28px;border:1px solid #c8ddd8;border-top:none;border-radius:0 0 8px 8px">
            <p style="color:#1A3C6E;font-size:16px;font-weight:600">Hi ${name},</p>
            <p style="color:#556070;line-height:1.8">Thank you for requesting a quote from Relokates Removals. We have received your enquiry and a member of our team will be in touch within 60 minutes during business hours.</p>
            <p style="color:#556070;line-height:1.8">If your move is urgent or you would like to speak to us immediately, please call us directly:</p>
            <div style="text-align:center;margin:24px 0">
              <a href="tel:07359724844" style="display:inline-block;background:#B8932A;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">&#9990; 07359 724844</a>
            </div>
            <p style="color:#556070;line-height:1.8">Our office hours are Monday to Friday 7am to 7pm, Saturday 8am to 5pm, and Sunday 9am to 2pm.</p>
            <p style="color:#556070;line-height:1.8">We look forward to helping with your move.</p>
            <p style="color:#1A3C6E;font-weight:600">The Relokates Team</p>
          </div>
          <p style="text-align:center;font-size:12px;color:#aaa;margin-top:16px">Relokates Removals | 07359 724844 | info@relokates.co.uk</p>
        </div>
      `
    });
  } catch (e) {
    console.error('Auto-reply failed:', e.message);
    // auto-reply failure is non-critical
  }

  // ── 4. HUBSPOT CRM ──
  try {
    const hsRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HUBSPOT_TOKEN}`
      },
      body: JSON.stringify({
        properties: {
          firstname: name.split(' ')[0] || name,
          lastname: name.split(' ').slice(1).join(' ') || '',
          email,
          phone,
          hs_lead_status: 'NEW',
          lifecyclestage: 'lead',
          lead_source: 'Website — Relokates',
          removal_service: service || '',
          moving_from: move_from || '',
          moving_to: move_to || '',
          move_date: move_date || '',
          property_size: property || '',
          message: message || ''
        }
      })
    });
    if (!hsRes.ok) errors.push('hubspot');
  } catch (e) {
    errors.push('hubspot');
  }

  return res.status(200).json({ success: true, errors });
}
