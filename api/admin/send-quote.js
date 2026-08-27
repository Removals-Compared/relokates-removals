// Emails a branded quote PDF to the customer, from the same Gmail/Nodemailer
// setup used across the site. BCCs the office inbox so every quote lands there
// as a sent record, appends a note, and moves the lead to "quote_sent".

import nodemailer from 'nodemailer';
import { requireAuth } from './_session.js';
import { appendNote, updateQuote } from './_db.js';

const FROM = 'Relokates Removals <info@relokates.co.uk>';
const OFFICE_INBOX = 'info@relokates.co.uk';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
});

function htmlWrap(body) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  // If the message contains an accept-quote link, render it as a big 3D button.
  const acceptMatch = String(body || '').match(/https:\/\/www\.relokates\.co\.uk\/api\/accept-quote\?\S+/);
  let inner;
  if (acceptMatch) {
    const [before, after] = String(body).split(acceptMatch[0]);
    const btn = `<div style="text-align:center;margin:22px 0"><a href="${acceptMatch[0]}" style="background:linear-gradient(180deg,#22b558,#0f803a);color:#ffffff;text-decoration:none;font-weight:700;font-family:Arial,Helvetica,sans-serif;font-size:16px;padding:15px 36px;border-radius:10px;display:inline-block;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 3px 0 #0c6b30,0 7px 16px rgba(22,163,74,.35)">&#10003; Click here to accept this quote</a></div>`;
    inner = esc((before || '').trimEnd()) + btn + esc((after || '').trimStart());
  } else {
    inner = esc(body);
  }
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#1A3C6E;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#A8C5BC;margin:0;font-size:18px">Relokates Removals</h2>
      </div>
      <div style="background:#fff;padding:28px;border:1px solid #c8ddd8;border-top:none;border-radius:0 0 8px 8px;color:#1f2937;font-size:14px;line-height:1.7">
        ${inner}
        <hr style="border:none;border-top:1px solid #c8ddd8;margin:24px 0">
        <p style="font-size:12px;color:#556070;margin:0">Relokates Removals &middot; Company No. 13441775 &middot; 07359 724844 &middot; info@relokates.co.uk</p>
      </div>
    </div>
  `;
}

export default async function handler(req, res) {
  const role = requireAuth(req, res);
  if (!role) return;
  if (role === 'staff') return res.status(403).json({ error: 'staff cannot send priced documents' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { lead_id, to, subject, body, pdf_base64, filename } = req.body || {};
  if (!lead_id) return res.status(400).json({ error: 'lead_id required' });
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return res.status(400).json({ error: 'valid recipient email required' });
  if (!subject || !subject.trim()) return res.status(400).json({ error: 'subject required' });
  if (!body || !body.trim()) return res.status(400).json({ error: 'message body required' });
  if (!pdf_base64) return res.status(400).json({ error: 'pdf attachment required' });

  const safeName = String(filename || 'RLK-Quote.pdf').replace(/[^\w.\- ]/g, '').trim() || 'RLK-Quote.pdf';

  // 1. Send the email with the PDF attached.
  try {
    await transporter.sendMail({
      from: FROM,
      to,
      bcc: [OFFICE_INBOX],
      replyTo: OFFICE_INBOX,
      subject: subject.trim(),
      text: body,
      html: htmlWrap(body),
      attachments: [{
        filename: safeName,
        content: pdf_base64,
        encoding: 'base64',
        contentType: 'application/pdf',
      }],
    });
  } catch (e) {
    return res.status(502).json({ error: 'email send failed: ' + e.message });
  }

  // 2. Log a note and move the lead into the follow-up group. Non-fatal.
  try { await appendNote(lead_id, `Quote emailed to ${to}`); } catch (_) { /* non-fatal */ }
  try { await updateQuote(lead_id, { status: 'quote_sent' }); } catch (_) { /* non-fatal */ }

  return res.status(200).json({ ok: true, to });
}
