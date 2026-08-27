// Public endpoint: customer clicks the "Accept" button in their quote email.
// GET /api/accept-quote?id=<leadId>&t=<token>
// Verifies an HMAC token (keyed by ADMIN_SESSION_SECRET), moves the lead to
// "accepted", logs it, notifies the office (Gmail), and shows a branded page.
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { getQuote, updateQuote, appendNote, logActivity } from './admin/_db.js';

const PHONE = '07359 724844';
const WA = '447359724844';
const OFFICE = 'info@relokates.co.uk';
const SITE = 'https://www.relokates.co.uk';

function token(id) {
  return crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || '')
    .update('accept.' + String(id)).digest('hex').slice(0, 32);
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 465, secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
});

function page(title, bodyHtml) {
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--navy:#1A3C6E;--gold:#B8932A}
*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:#F4F8F6;color:#1f2937;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
.box{background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(15,23,42,.18);max-width:480px;width:100%;padding:40px 34px;text-align:center}
.tick{width:76px;height:76px;border-radius:50%;margin:0 auto 18px;background:linear-gradient(160deg,#22b558,#0f803a);display:flex;align-items:center;justify-content:center;color:#fff;font-size:40px;box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 6px 16px rgba(22,163,74,.35)}
h1{font-family:Montserrat,sans-serif;color:var(--navy);font-size:24px;margin:0 0 10px}
p{font-size:15px;line-height:1.7;color:#556070;margin:0 0 14px}
.btns{margin:22px 0 6px}
a.phone,a.wa{display:inline-block;margin:5px;text-decoration:none;color:#fff;font-family:Montserrat,sans-serif;font-weight:800;font-size:15px;padding:13px 24px;border-radius:10px}
a.phone{background:linear-gradient(180deg,#cda63f,#B8932A);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 3px 0 #806619,0 6px 14px rgba(184,147,42,.35)}
a.wa{background:#1EBE57;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 3px 0 #128a3e,0 6px 14px rgba(30,190,87,.35)}
.foot{margin-top:22px;font-size:12px;color:#9aa4b2}
</style></head><body><div class="box">${bodyHtml}</div></body></html>`;
}

function contactButtons(waText) {
  return `<div class="btns">
    <a class="phone" href="tel:07359724844">Call ${PHONE}</a>
    <a class="wa" href="https://wa.me/${WA}?text=${encodeURIComponent(waText)}">&#128172; WhatsApp us</a>
  </div>`;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const { id, t } = req.query || {};

  const fail = () => res.status(400).send(page('Link not valid', `
    <h1>This link is not valid</h1>
    <p>The accept link may have expired or already been used. No problem - just reach us directly and we will get your move booked in.</p>
    ${contactButtons('Hi, I would like to accept my removals quote')}
    <div class="foot">Relokates Removals &middot; Fixed prices, no hidden charges</div>`));

  if (!id || !t || t !== token(id)) return fail();

  let q;
  try { q = await getQuote(id); } catch (_) { return fail(); }
  if (!q || q.status === 'deleted') return fail();

  const first = String(q.name || 'there').trim().split(/\s+/)[0] || 'there';
  const already = q.status === 'accepted' || q.status === 'move_booked' || q.status === 'won';

  if (!already) {
    try {
      await updateQuote(id, { status: 'accepted' });
      await appendNote(id, 'Quote accepted by the customer (email link)');
      await logActivity({ actor: q.name || 'Customer', action: 'accepted quote', lead_id: id, lead_name: q.name, detail: 'via email link' });
    } catch (_) { /* still show success */ }
    // Notify the office (best-effort).
    try {
      await transporter.sendMail({
        from: 'Relokates Removals <info@relokates.co.uk>',
        to: OFFICE,
        subject: `Quote ACCEPTED: ${q.name || 'Customer'}`,
        text: `${q.name || 'A customer'} has accepted their quote via the email link.\n\n`
          + `Phone: ${q.phone || '-'}\nEmail: ${q.email || '-'}\nMove date: ${q.move_date || '-'}\n`
          + `From: ${q.move_from || '-'}  To: ${q.move_to || '-'}\n\n`
          + `Open the lead: ${SITE}/admin/quote/${id}\n\n`
          + `Next step: call to confirm the date and take the £50 deposit.`,
      });
    } catch (_) { /* non-fatal */ }
  }

  return res.status(200).send(page('Quote accepted', `
    <div class="tick">&#10003;</div>
    <h1>Thank you, ${first}!</h1>
    <p>Your quote is accepted and your move is now with our booking team. We will be in touch shortly to confirm your date and arrange your &pound;50 deposit.</p>
    <p>Need us sooner? We are here 7 days a week.</p>
    ${contactButtons('Hi, I just accepted my removals quote')}
    <div class="foot">Relokates Removals &middot; Fixed prices, no hidden charges</div>`));
}
