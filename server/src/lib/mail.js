import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
export async function sendMail(to, subject, html){
  await transporter.sendMail({ from: process.env.SMTP_FROM || 'Tixigo <noreply@tixigo.local>', to, subject, html });
}
