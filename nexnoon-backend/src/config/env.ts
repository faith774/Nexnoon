import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 4000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/nexnoon',
  MONGODB_DNS_SERVERS: process.env.MONGODB_DNS_SERVERS || '',

  // JWT
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'change-me-access',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'change-me-refresh',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',

  // Email (Nodemailer)
  EMAIL_FROM: process.env.EMAIL_FROM || 'no-reply@nexnon.com',
  CONTACT_EMAIL: process.env.CONTACT_EMAIL || 'support@nexnoon.com',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',

  // Frontend URL for links in emails
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Zoom Server-to-Server OAuth (optional - for automatic meeting creation)
  ZOOM_ACCOUNT_ID: process.env.ZOOM_ACCOUNT_ID || '',
  ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID || '',
  ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET || '',

  // Zoom Meeting SDK (optional - for embedded student joining)
  ZOOM_MEETING_SDK_CLIENT_ID: process.env.ZOOM_MEETING_SDK_CLIENT_ID || '',
  ZOOM_MEETING_SDK_CLIENT_SECRET: process.env.ZOOM_MEETING_SDK_CLIENT_SECRET || '',

  // Zoom webhook signature verification (optional - webhook route fails closed without it)
  ZOOM_WEBHOOK_SECRET_TOKEN: process.env.ZOOM_WEBHOOK_SECRET_TOKEN || '',

  // Live class join-window policy (see src/config/liveClassPolicy.ts)
  LIVE_CLASS_JOIN_EARLY_MINUTES: Number(process.env.LIVE_CLASS_JOIN_EARLY_MINUTES) || 15,
  LIVE_CLASS_LATE_JOIN_GRACE_MINUTES: Number(process.env.LIVE_CLASS_LATE_JOIN_GRACE_MINUTES) || 30,

  // Cloudinary (optional - instructor material/assignment file uploads are disabled without it)
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
};


