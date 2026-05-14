// Envío de email vía SMTP de Gmail. Usa nodemailer y un App Password de
// Google (NO la clave normal). Requiere creds desde Settings → Integraciones.

import nodemailer from 'nodemailer';

export async function sendEmail({ user, appPassword, fromName, to, subject, html, text }) {
  if (!user || !appPassword) {
    throw new Error('Credenciales de Gmail no configuradas (Settings → Integraciones)');
  }
  if (!to || (!html && !text)) {
    throw new Error('Faltan campos: to + (html o text)');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass: appPassword.replace(/\s+/g, '') },
  });

  const info = await transporter.sendMail({
    from: fromName ? `"${fromName}" <${user}>` : user,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject: subject || '(sin asunto)',
    html: html || undefined,
    text: text || undefined,
  });

  return { ok: true, messageId: info.messageId, accepted: info.accepted };
}
