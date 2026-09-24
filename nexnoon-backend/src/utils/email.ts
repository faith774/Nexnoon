import nodemailer from 'nodemailer';
import { ENV } from '../config/env';
import { isEmailConfiguredHonest } from './integrations';

/**
 * Platform email via SMTP.
 * Brevo: SMTP_HOST=smtp-relay.brevo.com, PORT=587,
 * SMTP_USER=your Brevo login, SMTP_PASS=SMTP key from Brevo.
 */
const transporter = nodemailer.createTransport({
  host: ENV.SMTP_HOST,
  port: ENV.SMTP_PORT,
  secure: ENV.SMTP_PORT === 465,
  auth: ENV.SMTP_USER
    ? {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      }
    : undefined,
});

export function isEmailConfigured() {
  return isEmailConfiguredHonest();
}

function wrapEmail(title: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f6f4f0;font-family:Georgia,'Times New Roman',serif;color:#14110e;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4f0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e4dfd6;">
        <tr><td style="padding:28px 28px 12px;border-bottom:1px solid #eee9e0;">
          <p style="margin:0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8a847a;">Nexnoon</p>
          <h1 style="margin:8px 0 0;font-size:22px;font-weight:normal;color:#14110e;">${title}</h1>
        </td></tr>
        <tr><td style="padding:24px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#3d3933;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 28px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#8a847a;border-top:1px solid #eee9e0;">
          You’re receiving this because you have a Nexnoon account.
          <br/>Need help? <a href="${ENV.FRONTEND_URL}/contact" style="color:#c45c26;">Contact support</a>
          · <a href="${ENV.FRONTEND_URL}/profile#email-preferences" style="color:#c45c26;">Manage email settings</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function cta(href: string, label: string) {
  return `<p style="margin:24px 0 8px;"><a href="${href}" style="display:inline-block;background:#14110e;color:#f6f4f0;text-decoration:none;padding:12px 20px;font-size:14px;">${label}</a></p>`;
}

export const sendEmail = async (to: string, subject: string, html: string) => {
  if (!isEmailConfigured()) {
    console.warn(`[email] SMTP not configured — skipped: ${subject} → ${to}`);
    return { sent: false as const };
  }

  await transporter.sendMail({
    from: ENV.EMAIL_FROM,
    to,
    subject,
    html,
  });
  return { sent: true as const };
};

export async function sendEmailSafe(to: string, subject: string, html: string) {
  try {
    return await sendEmail(to, subject, html);
  } catch (err) {
    console.error(`[email] Failed ${subject} → ${to}:`, err instanceof Error ? err.message : err);
    return { sent: false as const };
  }
}

export async function sendBulkEmailSafe(
  recipients: string[],
  subject: string,
  html: string
) {
  const unique = [...new Set(recipients.filter(Boolean))];
  await Promise.all(unique.map((to) => sendEmailSafe(to, subject, html)));
}

export const buildPasswordResetEmail = (token: string) => {
  const resetUrl = `${ENV.FRONTEND_URL}/reset-password?token=${token}`;
  return wrapEmail(
    'Reset your password',
    `<p>We received a request to reset your Nexnoon password. This link expires in 1 hour.</p>
     ${cta(resetUrl, 'Reset password')}
     <p style="font-size:13px;color:#8a847a;">If you didn’t ask for this, you can ignore this email.</p>`
  );
};

export const buildVerifyEmail = (token: string) => {
  const verifyUrl = `${ENV.FRONTEND_URL}/verify-email?token=${token}`;
  return wrapEmail(
    'Verify your email',
    `<p>Welcome to Nexnoon. Confirm your email to finish setting up your account.</p>
     ${cta(verifyUrl, 'Verify email')}`
  );
};

export const buildWelcomeInstructorPendingEmail = (name: string) =>
  wrapEmail(
    'Instructor application received',
    `<p>Hi ${name || 'there'},</p>
     <p>Thanks for applying to teach on Nexnoon. Our team will review your application. You’ll get another email when you’re approved.</p>
     ${cta(`${ENV.FRONTEND_URL}/instructor/pending`, 'Check status')}`
  );

export const buildInstructorDecisionEmail = (
  name: string,
  status: boolean | 'approved' | 'rejected' | 'suspended'
) => {
  const resolved =
    typeof status === 'boolean' ? (status ? 'approved' : 'rejected') : status;

  if (resolved === 'approved') {
    return wrapEmail(
      'You’re approved to teach',
      `<p>Hi ${name || 'there'},</p>
         <p>Your instructor application was approved. You can create classes, invite support instructors, and host live sessions.</p>
         ${cta(`${ENV.FRONTEND_URL}/instructor/dashboard`, 'Open instructor studio')}`
    );
  }

  if (resolved === 'suspended') {
    return wrapEmail(
      'Instructor account suspended',
      `<p>Hi ${name || 'there'},</p>
         <p>Your Nexnoon instructor privileges have been suspended. You cannot create or host classes until an admin reactivates your account.</p>
         ${cta(`${ENV.FRONTEND_URL}/contact`, 'Contact support')}`
    );
  }

  return wrapEmail(
    'Instructor application update',
    `<p>Hi ${name || 'there'},</p>
         <p>Your instructor application was not approved at this time. Contact support if you have questions.</p>
         ${cta(`${ENV.FRONTEND_URL}/contact`, 'Contact support')}`
  );
};

export const buildTeachingInviteEmail = (params: {
  inviteeName: string;
  leadName: string;
  classTitle: string;
  classId: string;
}) =>
  wrapEmail(
    'Teaching invite',
    `<p>Hi ${params.inviteeName || 'there'},</p>
     <p><strong>${params.leadName}</strong> invited you as a support instructor on <strong>${params.classTitle}</strong>.</p>
     ${cta(`${ENV.FRONTEND_URL}/classroom/${params.classId}`, 'View invite')}`
  );

export const buildSessionScheduledEmail = (params: {
  learnerName: string;
  classTitle: string;
  sessionTitle: string;
  when: string;
  classId: string;
  sessionId: string;
  isUpdate?: boolean;
}) =>
  wrapEmail(
    params.isUpdate ? 'Session rescheduled' : 'New session added',
    `<p>Hi ${params.learnerName || 'there'},</p>
     <p>${params.isUpdate ? 'A session was rescheduled' : 'A new session was added'} for <strong>${params.classTitle}</strong>.</p>
     <p style="margin:16px 0;padding:14px 16px;background:#faf8f5;border:1px solid #e4dfd6;">
       <strong>${params.sessionTitle}</strong><br/>
       <span style="color:#6b655c;">${params.when}</span>
     </p>
     ${cta(
       `${ENV.FRONTEND_URL}/classroom/${params.classId}?sessionId=${params.sessionId}`,
       'Open classroom'
     )}`
  );

export const buildAdminMessageEmail = (params: {
  recipientName: string;
  subjectLine: string;
  body: string;
}) =>
  wrapEmail(
    params.subjectLine,
    `<p>Hi ${params.recipientName || 'there'},</p>
     <p style="white-space:pre-wrap;">${params.body}</p>
     ${cta(`${ENV.FRONTEND_URL}/notifications`, 'Open Nexnoon')}`
  );

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const buildClassUpdateEmail = (params: {
  learnerName: string;
  heading: string;
  body: string;
  actionUrl: string;
  actionLabel?: string;
}) =>
  wrapEmail(
    escapeHtml(params.heading),
    `<p>Hi ${escapeHtml(params.learnerName || 'there')},</p>
     <p style="white-space:pre-wrap;">${escapeHtml(params.body)}</p>
     ${cta(`${ENV.FRONTEND_URL}${params.actionUrl}`, params.actionLabel || 'Open Nexnoon')}`
  );

export const buildEnrollmentConfirmationEmail = (params: {
  learnerName: string;
  classTitle: string;
  classId: string;
}) =>
  wrapEmail(
    'Enrollment confirmed',
    `<p>Hi ${params.learnerName || 'there'},</p>
     <p>You’re enrolled in <strong>${params.classTitle}</strong>. Open your classroom anytime to join sessions and find materials.</p>
     ${cta(`${ENV.FRONTEND_URL}/classroom/${params.classId}`, 'Go to classroom')}`
  );
