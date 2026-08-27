// Gentle quote follow-up email, sent on demand from the lead page. Gmail.
import nodemailer from 'nodemailer';

const FROM = 'Relokates Removals <info@relokates.co.uk>';
const OFFICE_INBOX = 'info@relokates.co.uk';
const PHONE = '07359 724844';
const WA = 'https://wa.me/447359724844';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 465, secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
});

export async function sendFollowup(quote) {
  const first = String(quote.name || 'there').trim().split(/\s+/)[0] || 'there';
  const text =
`Hi ${first},

Just checking you received the removal quote we sent over. If you have any questions, or if anything about the move has changed, give us a shout and we will happily update it.

If you are ready to go ahead, a quick reply or a call on ${PHONE} is all it takes to secure your date.

Kind regards,
The Relokates Removals Team
${PHONE} | WhatsApp ${PHONE}
relokates.co.uk`;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#1A3C6E;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#A8C5BC;margin:0;font-size:18px">Relokates Removals</h2>
      </div>
      <div style="background:#fff;padding:28px;border:1px solid #c8ddd8;border-top:none;border-radius:0 0 8px 8px;color:#1f2937;font-size:15px;line-height:1.7">
        <p>Hi ${first},</p>
        <p>Just checking you received the removal quote we sent over. If you have any questions, or if anything about the move has changed, give us a shout and we will happily update it.</p>
        <p>If you are ready to go ahead, a quick reply or a call is all it takes to secure your date.</p>
        <div style="text-align:center;margin:20px 0 4px">
          <a href="tel:07359724844" style="background:#B8932A;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:9px;display:inline-block;margin:4px">&#128222; Call ${PHONE}</a>
          <a href="${WA}" style="background:#25D366;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:9px;display:inline-block;margin:4px">&#128172; WhatsApp us</a>
        </div>
        <hr style="border:none;border-top:1px solid #c8ddd8;margin:24px 0">
        <p style="font-size:12px;color:#556070;margin:0">Relokates Removals &middot; Company No. 13441775 &middot; ${PHONE} &middot; info@relokates.co.uk</p>
      </div>
    </div>`;

  return transporter.sendMail({
    from: FROM, to: quote.email, bcc: [OFFICE_INBOX], replyTo: OFFICE_INBOX,
    subject: 'Your removal quote from Relokates Removals', text, html,
  });
}
