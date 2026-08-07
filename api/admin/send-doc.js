// Emails a branded document PDF (invoice or receipt) to the customer, from the
// same Gmail/Nodemailer setup used elsewhere. BCCs the office inbox and appends
// a note to the lead. Unlike send-quote, it does NOT change the lead status -
// invoices and receipts don't move a lead through the pipeline.

import nodemailer from 'nodemailer';
import { requireAuth } from './_session.js';
import { appendNote } from './_db.js';

const FROM = 'Relokates Removals <info@relokates.co.uk>';
const OFFICE_INBOX = 'info@relokates.co.uk';
const LABELS = { invoice: 'Invoice', receipt: 'Receipt', quote: 'Quote' };

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
});

function htmlWrap(body) {
  const safe = String(body || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#1A3C6E;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#A8C5BC;margin:0;font-size:18px">Relokates Removals</h2>
      </div>
      <div style="background:#fff;padding:28px;border:1px solid #c8ddd8;border-top:none;border-radius:0 0 8px 8px;color:#1f2937;font-size:14px;line-height:1.7">
        ${safe}
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

  const { lead_id, doc_type, to, subject, body, pdf_base64, filename } = req.body || {};
  const type = LABELS[doc_type] ? doc_type : 'invoice';
  const Label = LABELS[type];

  if (!lead_id) return res.status(400).json({ error: 'lead_id required' });
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return res.status(400).json({ error: 'valid recipient email required' });
  if (!subject || !subject.trim()) return res.status(400).json({ error: 'subject required' });
  if (!body || !body.trim()) return res.status(400).json({ error: 'message body required' });
  if (!pdf_base64) return res.status(400).json({ error: 'pdf attachment required' });

  const safeName = String(filename || `RLK-${Label}.pdf`).replace(/[^\w.\- ]/g, '').trim() || `RLK-${Label}.pdf`;

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

  // Log it against the lead (non-fatal).
  try { await appendNote(lead_id, `${Label} emailed to ${to}`); } catch (_) { /* non-fatal */ }

  return res.status(200).json({ ok: true, to });
}
