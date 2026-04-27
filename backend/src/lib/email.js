const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
  }
  const port = parseInt(process.env.SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendBugNotificationEmail({ id, project, type, description, page, extraFields }) {
  const typeLabel = type === 'feature' ? 'Feature Request' : 'Bug Report';
  const extraHtml = extraFields
    ? Object.entries(extraFields).map(([k, v]) => `<tr><td style="padding:6px 12px;color:#a1a1aa;font-size:13px;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 12px;color:#fafafa;font-size:13px">${escapeHtml(v)}</td></tr>`).join('')
    : '';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:24px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#18181b;border-radius:8px;overflow:hidden;max-width:560px;width:100%">
  <tr><td style="padding:24px 24px 16px">
    <span style="display:inline-block;padding:4px 10px;background:${type === 'feature' ? '#1e3a5f' : '#5f1e1e'};color:${type === 'feature' ? '#93c5fd' : '#fca5a5'};border-radius:4px;font-size:12px;font-weight:600">${typeLabel}</span>
    <span style="margin-left:8px;color:#a1a1aa;font-size:13px">${escapeHtml(project)}</span>
  </td></tr>
  <tr><td style="padding:0 24px 16px">
    <p style="margin:0;color:#fafafa;font-size:15px;line-height:1.5;white-space:pre-wrap">${escapeHtml(description)}</p>
  </td></tr>
  ${page ? `<tr><td style="padding:0 24px 12px"><p style="margin:0;color:#71717a;font-size:12px">Page: ${escapeHtml(page)}</p></td></tr>` : ''}
  ${extraHtml ? `<tr><td style="padding:0 24px 16px"><table width="100%" cellpadding="0" cellspacing="0" style="background:#27272a;border-radius:6px">${extraHtml}</table></td></tr>` : ''}
  <tr><td style="padding:0 24px 20px">
    <p style="margin:0;color:#52525b;font-size:11px">ID: ${escapeHtml(id)}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = `[${typeLabel}] ${project}\n\n${description}${page ? `\n\nPage: ${page}` : ''}${extraFields ? `\n\nExtra: ${JSON.stringify(extraFields)}` : ''}\n\nID: ${id}`;

  try {
    await getTransporter().sendMail({
      from: 'PublicWerx <admin@publicwerx.org>',
      to: 'shettysuraj74@gmail.com',
      subject: `[${typeLabel}] ${project}: ${description.slice(0, 80)}`,
      text,
      html,
    });
  } catch (err) {
    console.error('Bug notification email failed:', err.message);
  }
}

async function sendBugReplyEmail({ to, project, bugId, body, originalDescription }) {
  const snippet = (originalDescription || '').slice(0, 280);
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:24px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#18181b;border-radius:8px;overflow:hidden;max-width:560px;width:100%">
  <tr><td style="padding:24px 24px 8px">
    <h1 style="margin:0;font-size:18px;color:#fafafa;font-weight:700">Update on your ${escapeHtml(project)} bug report</h1>
  </td></tr>
  <tr><td style="padding:8px 24px 16px">
    <p style="margin:0;color:#a1a1aa;font-size:13px">Your original report:</p>
    <div style="margin-top:8px;padding:12px;background:#27272a;border-radius:6px;color:#d4d4d8;font-size:13px;white-space:pre-wrap">${escapeHtml(snippet)}${originalDescription && originalDescription.length > 280 ? '…' : ''}</div>
  </td></tr>
  <tr><td style="padding:0 24px 16px">
    <p style="margin:0 0 8px;color:#a1a1aa;font-size:13px">Reply from the team:</p>
    <div style="padding:14px;background:#0a0a0a;border:1px solid #3f3f46;border-radius:6px;color:#fafafa;font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(body)}</div>
  </td></tr>
  <tr><td style="padding:0 24px 20px">
    <p style="margin:0;color:#52525b;font-size:11px">Reply to this email if you need to follow up.</p>
    <p style="margin:6px 0 0;color:#52525b;font-size:11px">Report ID: ${escapeHtml(bugId)}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = `Update on your ${project} bug report\n\nYour report:\n${snippet}${originalDescription && originalDescription.length > 280 ? '...' : ''}\n\nReply from the team:\n${body}\n\nReply to this email to follow up.\nReport ID: ${bugId}`;

  await getTransporter().sendMail({
    from: 'PublicWerx <admin@publicwerx.org>',
    replyTo: 'admin@publicwerx.org',
    to,
    subject: `Re: your ${project} bug report`,
    text,
    html,
  });
}

module.exports = { sendBugNotificationEmail, sendBugReplyEmail };
