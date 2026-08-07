// Google review-request email, sent from the same Gmail/Nodemailer setup used
// across the site. Used by the lead page (manual send) and the auto-ask on
// completion. The review link and contact details are Relokates'.
import nodemailer from 'nodemailer';

export const REVIEW_LINK = 'https://g.page/r/CcjSY9w6bkHoEBM/review';
const FROM = 'Relokates Removals <info@relokates.co.uk>';
const OFFICE_INBOX = 'info@relokates.co.uk';
const PHONE = '07359 724844';
const WA = 'https://wa.me/447359724844';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
});

export async function sendReviewRequest(quote) {
  const first = String(quote.name || 'there').trim().split(/\s+/)[0] || 'there';
  const text =
`Hi ${first},

Thank you for choosing Relokates Removals. We hope your move went smoothly.

If you have a moment, we would really appreciate a quick Google review - it genuinely helps our small team:
${REVIEW_LINK}

Any questions, just call us on ${PHONE} or reply to this email.

Kind regards,
The Relokates Removals Team
${PHONE}
relokates.co.uk`;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#1A3C6E;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#A8C5BC;margin:0;font-size:18px">Relokates Removals</h2>
      </div>
      <div style="background:#fff;padding:28px;border:1px solid #c8ddd8;border-top:none;border-radius:0 0 8px 8px;color:#1f2937;font-size:15px;line-height:1.7">
        <p>Hi ${first},</p>
        <p>Thank you for choosing Relokates Removals. We hope your move went smoothly.</p>
        <p>If you have a moment, a quick Google review would mean a lot to our small team.</p>
        <div style="text-align:center;margin:26px 0">
          <a href="${REVIEW_LINK}" style="display:inline-block;background:#B8932A;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 30px;border-radius:8px">Leave us a Google review</a>
        </div>
        <div style="text-align:center;margin:0 0 8px">
          <a href="tel:07359724844" style="display:inline-block;margin:4px;background:#1A3C6E;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 20px;border-radius:8px">Call ${PHONE}</a>
          <a href="${WA}" style="display:inline-block;margin:4px;background:#25D366;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 20px;border-radius:8px">WhatsApp</a>
        </div>
        <hr style="border:none;border-top:1px solid #c8ddd8;margin:24px 0">
        <p style="font-size:12px;color:#556070;margin:0">Relokates Removals &middot; Company No. 13441775 &middot; ${PHONE} &middot; info@relokates.co.uk</p>
      </div>
    </div>`;

  return transporter.sendMail({
    from: FROM,
    to: quote.email,
    bcc: [OFFICE_INBOX],
    replyTo: OFFICE_INBOX,
    subject: 'Thank you from Relokates Removals',
    text,
    html,
  });
}
