// Daily cron (see vercel.json "crons"). Emails a call reminder for every
// reminder whose date has arrived, then purges recycle-bin leads older than
// 30 days. Secured by CRON_SECRET: Vercel adds
// "Authorization: Bearer <CRON_SECRET>" to cron requests when that env is set.
import nodemailer from 'nodemailer';
import {
  fetchDueReminders, markReminderSent, getQuote,
  fetchExpiredDeleted, deleteQuote, logActivity, appendNote,
} from './_db.js';
import { useDb, branchDbUrl, q } from './_sql.js';
import { sendLetter } from './_followup.js';

const TO = 'info@relokates.co.uk';
const FROM = 'Relokates Reminders <info@relokates.co.uk>';
const SITE = 'https://www.relokates.co.uk';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
});

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function emailHtml(lead, rem) {
  const name = (lead && lead.name) || 'Customer';
  const phone = (lead && lead.phone) || '';
  const phoneClean = phone.replace(/[^\d+]/g, '');
  const note = rem.note || 'Follow up with this customer.';
  const link = `${SITE}/admin/quote/${rem.lead_id}`;
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1A3C6E;padding:22px 30px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;font-size:19px;margin:0">&#128222; Call reminder</h1>
        <p style="color:#A8C5BC;margin:6px 0 0;font-size:14px">Relokates Removals</p>
      </div>
      <div style="background:#fff;padding:26px 30px;border:1px solid #c8ddd8;border-top:none;border-radius:0 0 8px 8px;color:#1f2937">
        <p style="font-size:16px;margin:0 0 16px">Time to call <strong>${esc(name)}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;font-size:15px">
          <tr><td style="padding:8px 0;color:#556070;width:34%">Phone</td><td style="padding:8px 0;font-weight:600">${phone ? `<a href="tel:${esc(phoneClean)}" style="color:#B8932A">${esc(phone)}</a>` : '-'}</td></tr>
          <tr><td style="padding:8px 0;color:#556070">Service</td><td style="padding:8px 0;font-weight:600">${esc((lead && lead.service) || '-')}</td></tr>
          <tr><td style="padding:8px 0;color:#556070;vertical-align:top">Note</td><td style="padding:8px 0;font-weight:600">${esc(note)}</td></tr>
        </table>
        <p style="margin-top:22px"><a href="${link}" style="display:inline-block;background:#B8932A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px">Open this lead</a></p>
      </div>
    </div>`;
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  if (!secret || auth !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' });

  // ?welcome=1 (cron, every 5 minutes): a follow-up to the instant
  // auto-reply, sent 5 to 60 minutes after a head-office website enquiry
  // while it is still status new. The "Welcome follow-up sent" note is
  // the dedupe marker. Branch (franchise) leads are left alone.
  if (req.query && req.query.welcome) {
    useDb(null);
    const out = { checked: 0, sent: 0, errors: [] };
    try {
      const fresh = await q(
        `SELECT * FROM relokates_quote_request
          WHERE created_at <= now() - interval '5 minutes'
            AND created_at >  now() - interval '60 minutes'
            AND coalesce(email, '') <> ''
            AND source = 'relokates.co.uk'
            AND (status IS NULL OR status = 'new')
          ORDER BY created_at ASC LIMIT 20`,
      );
      for (const lead of fresh) {
        out.checked++;
        const notes = Array.isArray(lead.notes) ? lead.notes : [];
        if (notes.some((n) => /^Welcome follow-up sent/.test(String(n && n.text)))) continue;
        const first = String(lead.name || 'there').split(/\s+/)[0];
        const lines = [
          `Hi ${first},`, '',
          `A quick follow-up on your ${lead.service || 'removals'} enquiry: it is with the team now and one of us will be in touch with you shortly.`, '',
          'If it is easier, you can start a WhatsApp chat with us right away using the green button below, or call us on 07359 724844.', '',
          'Kind regards,', 'The Relokates Removals Team', '07359 724844 | WhatsApp 07359 724844', 'relokates.co.uk',
        ].join('\n');
        try {
          await sendLetter(lead, 'We are on your removals enquiry', lines, `Hi, it's ${lead.name || 'a customer'} about my removals enquiry.`);
          await appendNote(lead.id, `Welcome follow-up sent to ${lead.email} (automatic, 5 minutes after the enquiry)`);
          await logActivity({ actor: 'welcome-bot', action: 'sent welcome follow-up', lead_id: lead.id, lead_name: lead.name, detail: '' });
          out.sent++;
        } catch (e) {
          out.errors.push({ id: lead.id, message: String(e.message || e) });
        }
      }
      return res.status(200).json(out);
    } catch (e) {
      console.error('welcome cron', e);
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const results = { checked: 0, sent: 0, purged: 0, errors: [] };

  // One pass per database: head office first, then each configured branch DB
  // (branches keep their own data, but reminders still need running).
  const passes = [{ label: 'head-office', url: null, notify: TO }];
  for (const slug of ['birmingham']) {
    const url = branchDbUrl(slug);
    if (url) passes.push({ label: slug, url, notify: process.env[`${slug.toUpperCase()}_NOTIFY_EMAIL`] || TO });
  }

  try {
    for (const pass of passes) {
      useDb(pass.url);
      const due = await fetchDueReminders(today);
      results.checked += due.length;
      for (const rem of due) {
        try {
          const lead = await getQuote(rem.lead_id);
          await transporter.sendMail({
            from: FROM,
            to: pass.notify,
            subject: `Call reminder: ${(lead && lead.name) || 'Customer'}${rem.note ? ' - ' + rem.note : ''}`,
            html: emailHtml(lead, rem),
          });
          await markReminderSent(rem.id);
          results.sent += 1;
        } catch (e) {
          results.errors.push({ db: pass.label, id: rem.id, message: String(e.message || e) });
        }
      }

      // Recycle-bin housekeeping: purge leads soft-deleted more than 30 days ago.
      try {
        const expired = await fetchExpiredDeleted(30);
        for (const q of expired) {
          await deleteQuote(q.id);
          await logActivity({ actor: 'System', action: 'purged', lead_id: q.id, lead_name: q.name, detail: 'recycle bin, 30 days' });
        }
        results.purged += expired.length;
      } catch (e) { results.purge_error = String(e.message || e); }
    }
    useDb(null);

    return res.status(200).json({ ok: true, ...results });
  } catch (e) {
    useDb(null);
    return res.status(500).json({ ok: false, error: String(e.message || e), ...results });
  }
}
