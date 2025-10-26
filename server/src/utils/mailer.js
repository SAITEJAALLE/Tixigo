// server/src/utils/mailer.js
import nodemailer from 'nodemailer';

// small helper to read booleans from env
function bool(v) {
  if (v === true) return true;
  const s = String(v || '').toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

/**
 * Provider + connection options
 * We use MAIL_* variables (ignores SMTP_*), so set these in .env:
 *   MAIL_PROVIDER=gmail
 *   MAIL_HOST=smtp.gmail.com
 *   MAIL_PORT=465
 *   MAIL_SECURE=true
 *   MAIL_USER=your@gmail.com
 *   MAIL_PASS=your-app-password     <-- app password, no spaces
 *   MAIL_FROM="Trixigo <no-reply@tixigo.local>"
 */
const provider = (process.env.MAIL_PROVIDER || 'gmail').toLowerCase();

const user = process.env.MAIL_USER || '';
let pass = process.env.MAIL_PASS || '';
// Gmail app passwords sometimes get pasted with spaces; strip them:
pass = pass.replace(/\s+/g, '');

const host =
  process.env.MAIL_HOST || (provider === 'gmail' ? 'smtp.gmail.com' : undefined);
const port = Number(
  process.env.MAIL_PORT || (provider === 'gmail' ? 465 : 587)
);
const secure = bool(
  process.env.MAIL_SECURE ?? (provider === 'gmail' ? 'true' : 'false')
);

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: user && pass ? { user, pass } : undefined,
});

/**
 * Low-level send function used everywhere.
 */
export async function sendMail({ to, subject, html, text }) {
  const from = process.env.MAIL_FROM || `Tixigo <no-reply@localhost>`;
  try {
    const info = await transporter.sendMail({ from, to, subject, html, text });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    // keep logging concise but helpful
    console.error('sendMail error:', err?.response || err?.message || err);
    return { ok: false, error: err?.message || 'mailer_error' };
  }
}

/**
 * Convenience wrapper used by orders flow to email tickets.
 * Accepts a flat array of tickets with (at least) these fields:
 *   { ticketNumber, code, eventTitle, showTime }
 */
export async function sendTicketEmail({ to, tickets = [], extraText }) {
  const subject = `Your Tixigo tickets (${tickets.length})`;

  // simple ticket list (works in all email clients)
  const items = tickets
    .map(
      (t) => `
        <tr>
          <td style="padding:12px;border:1px solid #eee;">
            <div style="font:14px system-ui,Segoe UI,Roboto,Arial">
              <div style="font-weight:600">Ticket #: ${t.ticketNumber}</div>
              <div>Event: ${t.eventTitle || t.event || '—'}</div>
              <div>Show time: ${
                t.showTime ? new Date(t.showTime).toLocaleString() : '—'
              }</div>
              <div style="word-break:break-all">Code: ${t.code}</div>
            </div>
          </td>
        </tr>`
    )
    .join('');

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial;margin:0;padding:24px;background:#f6f7fb">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e9eaf3">
        <tr>
          <td style="padding:20px 24px;background:#4F46E5;color:#fff;font-weight:700;font-size:18px">
            Your tickets are ready 🎟️
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;color:#111;font:14px system-ui,Segoe UI,Roboto,Arial">
            ${extraText || 'Show this email at the venue. Staff can scan the code or read the ticket number.'}
          </td>
        </tr>
        ${items ? `<tr><td style="padding:0 24px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #eee;border-radius:10px;overflow:hidden">${items}</table></td></tr>` : ''}
        <tr>
          <td style="padding:18px 24px;color:#6b7280;font:12px system-ui,Segoe UI,Roboto,Arial">
            Tip: You can always find your tickets in the app under <b>My Tickets</b>.
          </td>
        </tr>
      </table>
    </div>`;

  return sendMail({ to, subject, html, text: `Your tickets (${tickets.length}) are attached above.` });
}
