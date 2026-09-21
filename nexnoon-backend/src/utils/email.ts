import nodemailer from 'nodemailer';
import { ENV } from '../config/env';

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

export const sendEmail = async (to: string, subject: string, html: string) => {
  if (!ENV.SMTP_HOST || !ENV.SMTP_USER) {
    console.warn('SMTP not configured, skipping email send');
    return;
  }

  await transporter.sendMail({
    from: ENV.EMAIL_FROM,
    to,
    subject,
    html,
  });
};

export const buildPasswordResetEmail = (token: string) => {
  const resetUrl = `${ENV.FRONTEND_URL}/reset-password?token=${token}`;
  return `
    <h1>Reset your Nexnoon password</h1>
    <p>Click the link below to reset your password. This link is valid for 1 hour.</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
  `;
};

export const buildVerifyEmail = (token: string) => {
  const verifyUrl = `${ENV.FRONTEND_URL}/verify-email?token=${token}`;
  return `
    <h1>Verify your Nexnoon email</h1>
    <p>Click the link below to verify your email address.</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
  `;
};


